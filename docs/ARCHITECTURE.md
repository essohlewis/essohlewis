# Architecture technique — Plateforme de pronostics (West Africa)

> Document de conception. Cible : MVP web, foot Côte d'Ivoire, extensible mobile + multi-pays.
> Stack retenue : **Laravel 11 (API) · MySQL · React (web) · Expo (mobile)**.

---

## 1. Principes directeurs

Le produit vend **de la confiance**, pas des pronostics. Toute décision technique découle de trois invariants :

1. **Immuabilité du track record** — un pronostic ne peut jamais être modifié ni supprimé après le verrouillage. Le score de fiabilité doit être auditable par n'importe qui.
2. **Argent traçable** — chaque mouvement de wallet (recharge, abonnement, commission, payout) est une écriture comptable idempotente et réconciliable.
3. **Séparation claire des rôles** — un utilisateur peut être *consumer* (achète des pronostics) et/ou *tipster* (en vend). Les permissions ne se déduisent pas d'un booléen mais d'un statut vérifié.

---

## 2. Vue d'ensemble

```
┌─────────────┐     ┌─────────────┐
│  React web  │     │  Expo app   │
└──────┬──────┘     └──────┬──────┘
       │  HTTPS / JSON (Sanctum tokens)
       └──────────┬────────┘
                  ▼
        ┌───────────────────┐        ┌──────────────────┐
        │   Laravel 11 API  │◄──────►│  MySQL (primary) │
        │  ─ Auth (Sanctum) │        └──────────────────┘
        │  ─ Domain services│        ┌──────────────────┐
        │  ─ Queue workers  │◄──────►│  Redis (cache/Q) │
        └───┬───────────┬───┘        └──────────────────┘
            │           │
   ┌────────▼──┐   ┌────▼─────────────┐
   │ Sports    │   │ Mobile Money     │
   │ data API  │   │ Orange / MTN     │
   │ (fixtures │   │ (collect+payout) │
   │ +results) │   │ via webhooks     │
   └───────────┘   └──────────────────┘
```

Composants asynchrones (queue Redis + Horizon) :
- `SettleFixtureJob` — note les pronostics dès qu'un résultat officiel arrive.
- `MobileMoneyReconcileJob` — vérifie/rejoue les transactions en attente.
- `RecomputeReliabilityJob` — recalcule les scores tipsters (débatché).
- `SendNotificationJob` — push/SMS/in-app.

---

## 3. Modèle de données (cœur)

Tables principales et champs sensibles (le reste = timestamps, soft-deletes **interdits** sur les paris).

### `users`
| champ | type | note |
|---|---|---|
| id | bigint PK | |
| phone | string, unique | identifiant principal en Afrique de l'Ouest (pas l'email) |
| email | string, nullable | |
| password | string | |
| country_code | char(2) | `CI`, `SN`… |
| role_flags | json | `{tipster:false, admin:false}` — capacités, pas identité |
| tipster_status | enum | `none · pending · approved · suspended` |
| kyc_status | enum | `none · pending · verified` (requis avant payout) |

### `wallets` (1–1 avec user)
| champ | type | note |
|---|---|---|
| balance_cents | bigint | **entier**, jamais de float sur de l'argent |
| currency | char(3) | `XOF` |
| version | int | optimistic locking |

### `wallet_transactions` (ledger append-only)
| champ | type | note |
|---|---|---|
| id | bigint PK | |
| wallet_id | FK | |
| type | enum | `topup · subscription_debit · subscription_credit · commission · payout · refund · tip` |
| amount_cents | bigint | signé (+ crédit / − débit) |
| balance_after_cents | bigint | snapshot pour audit |
| reference | string unique | **clé d'idempotence** (ex. id transaction Mobile Money) |
| related_id / related_type | morph | rattache la ligne à un abonnement, payout… |
| status | enum | `pending · completed · failed · reversed` |

> Règle : le solde `wallets.balance_cents` est toujours dérivable par somme du ledger. Toute divergence = alerte.

### `sports` / `competitions` / `teams` / `fixtures`
`fixtures` est la source de vérité des matchs :
| champ | type | note |
|---|---|---|
| external_ref | string | id chez le fournisseur de données |
| kickoff_at | datetime (UTC) | **verrou temporel** des pronostics |
| status | enum | `scheduled · live · finished · postponed · cancelled` |
| result | json, nullable | score final normalisé, rempli au settlement |

### `predictions` (append-only, immuable après lock)
| champ | type | note |
|---|---|---|
| tipster_id | FK users | |
| fixture_id | FK | |
| market | enum | `1x2 · over_under · btts · handicap`… |
| selection | string | ex. `home`, `over_2.5` |
| odds | decimal(6,2) | cote au moment du pronostic (fige le ROI) |
| stake_units | decimal(4,2) | 1–10, mise conseillée en unités |
| confidence | tinyint | 1–5 |
| locked_at | datetime | = min(now, kickoff_at) figé à la création |
| visibility | enum | `free · subscribers` |
| outcome | enum, nullable | `won · lost · void · half_won · half_lost` (settlement) |

**Contrainte dure** : `INSERT` autorisé seulement si `now() < fixtures.kickoff_at`. Aucune route `UPDATE`/`DELETE` n'existe côté API. L'immuabilité est une propriété du schéma, pas une politesse applicative.

### `subscriptions`
| champ | type | note |
|---|---|---|
| consumer_id / tipster_id | FK | |
| price_cents | bigint | prix figé à la souscription |
| period_start / period_end | datetime | 30 jours |
| status | enum | `active · expired · cancelled` |
| auto_renew | bool | renouvellement depuis le wallet prépayé (voir §6) |

### `reliability_snapshots`
Historise le score pour afficher une courbe et empêcher le recalcul rétroactif « magique » (cf. §5).

---

## 4. API (REST, versionnée `/api/v1`)

Groupes de routes et garde-fous :

```
POST   /auth/register            phone + OTP
POST   /auth/verify-otp
POST   /auth/login
GET    /me

# Tipsters
GET    /tipsters                 tri par reliability, filtres sport/pays
GET    /tipsters/{id}            profil public + track record vérifiable
POST   /tipster/apply            passe tipster_status → pending

# Pronostics
GET    /fixtures                 matchs à venir
POST   /predictions             (tipster) refusé si kickoff dépassé
GET    /predictions/{id}         flouté si visibility=subscribers & non-abonné
GET    /tipsters/{id}/predictions

# Abonnements & wallet
POST   /wallet/topup             initie une collecte Mobile Money
GET    /wallet                   solde + historique
POST   /subscriptions            débit wallet, crée l'abonnement
DELETE /subscriptions/{id}       coupe auto_renew (garde l'accès jusqu'à period_end)

# Payout tipster
POST   /payouts                  nécessite kyc_status=verified

# Webhooks (hors auth Sanctum, signés)
POST   /webhooks/momo/orange
POST   /webhooks/momo/mtn
POST   /webhooks/sports/results
```

Conventions : pagination cursor, réponses enveloppées `{data, meta}`, erreurs RFC-7807, rate-limit par phone + IP.

---

## 5. Système de scoring / fiabilité (le différenciateur)

Un simple « win rate » est manipulable (spammer des paris à cote 1.05). Score composite, recalculé **seulement en avant** (jamais rétroactif) :

- **Yield / ROI** = Σ(gain_net en unités) / Σ(mises). Métrique reine — récompense la valeur, pas le volume.
- **Win rate** pondéré par cote (un 1x2 gagné à 3.0 pèse plus qu'à 1.2).
- **Volume minimum** : pas de score affiché sous 30 pronostics settled (anti-« coup de chance »).
- **Récence** : demi-vie de 90 jours, un tipster en froid redescend.
- **Consistance** : pénalité sur la variance (les martingales sont punies).

Score final = combinaison normalisée 0–100, borné, avec **badge de confiance** (bronze/argent/or) plutôt qu'un chiffre trompeusement précis.

Settlement (`SettleFixtureJob`) :
1. Webhook résultat → normalise le score.
2. Pour chaque `prediction` du match : calcule `outcome` selon le `market`.
3. Gère `void` (match reporté/annulé → mise rendue, exclu des stats).
4. Écrit un `reliability_snapshot`, jamais d'écrasement.

> Anti-fraude clé : le résultat vient **uniquement** du fournisseur de données via webhook signé, jamais d'une saisie manuelle tipster/admin sans double validation.

---

## 6. Wallet & Mobile Money (Orange Money / MTN MoMo)

**Contrainte métier majeure** : les API Mobile Money d'Afrique de l'Ouest ne supportent pas les prélèvements récurrents fiables (pas de « card on file »). Conséquence sur le design :

- L'abonnement **ne prélève pas** la carte/le compte MoMo tous les mois.
- L'utilisateur **recharge un wallet prépayé** (collecte MoMo ponctuelle), puis **les abonnements se débitent du solde**.
- `auto_renew` = au `period_end`, si `balance ≥ price` → renouvellement automatique interne (zéro appel MoMo). Sinon → notification « rechargez ».

Flux de recharge (collect) :
```
app → POST /wallet/topup → provider MoMo (STK/USSD push)
   → utilisateur confirme sur son téléphone
   → webhook signé /webhooks/momo/* → wallet_transactions (idempotent via reference)
   → crédit wallet si status=completed
```

Règles non négociables :
- **Idempotence** sur `wallet_transactions.reference` (rejouer un webhook ne double pas le solde).
- **Machine à états** stricte : `pending → completed | failed`, jamais l'inverse.
- **Réconciliation** : `MobileMoneyReconcileJob` interroge l'API provider pour les `pending` de plus de N minutes.
- **Payout tipster** : commission de 20 % retenue à la source (`type=commission`), reste versé après `kyc_status=verified`, avec seuil minimum et anti-blanchiment (plafonds).

---

## 7. Sécurité, anti-fraude & conformité

- **OTP SMS** à l'inscription (le phone est l'identité) + throttling anti-bombing.
- **Immuabilité** des paris garantie par l'absence de route d'écriture + horodatage serveur (jamais de timestamp client).
- **Sybil / faux track record** : détection multi-comptes (device fingerprint, réutilisation de numéro), et surtout — un tipster ne peut pas se sur-noter puisque le résultat vient de la source externe.
- **Conformité (à valider juridiquement)** : vendre des pronostics sportifs payants en Côte d'Ivoire touche la réglementation des jeux (LONACI) et la protection du consommateur. **La plateforme ne prend aucun pari** — elle vend un service d'information. Cette frontière doit rester nette dans les CGU et le produit (pas de cote « à parier », mentions « jouer comporte des risques », vérification d'âge 18+).
- **RGPD-like / données perso** : le numéro de téléphone et les transactions financières sont sensibles → chiffrement au repos, journal d'accès admin.

---

## 8. Temps réel & notifications

- Résultats live et settlement → événement `broadcast` (Laravel Echo + WebSocket, ou Pusher-compatible) vers web/mobile.
- Notifications multi-canal via une abstraction : **in-app** (toujours), **push** (Expo), **SMS** (fallback critique : nouvel abonné, payout, échec de recharge).
- File dédiée basse latence pour « coup d'envoi dans 15 min » (le pronostic va se verrouiller).

---

## 9. Infrastructure & déploiement

- **Env** : Laravel API + queue workers (Horizon) + MySQL + Redis. Débute mono-VPS (Abidjan/Europe proche), CDN pour les assets.
- **Files** : Redis pour les jobs, table `jobs` en fallback.
- **Observabilité** : logs structurés, alertes sur divergence de solde et webhooks échoués.
- **CI/CD** : GitHub Actions (tests + phpstan) → déploiement sur merge `main`.
- **Sauvegardes** : dump MySQL chiffré quotidien (les données financières sont critiques).

---

## 10. Découpage produit (rappel des phases)

| Phase | Périmètre technique |
|---|---|
| **1 — MVP web** | Auth OTP, profils tipsters, pronostics immuables, settlement auto (1 sport/1 pays), wallet + recharge MoMo, abonnements prépayés, scoring v1. |
| **2 — Mobile** | App Expo, push notifications, parité fonctionnelle. |
| **3 — Expansion** | Multi-sports, multi-pays (Sénégal, Mali…), i18n, providers MoMo additionnels. |
| **4 — Monétisation avancée** | Affiliation/bookmakers (dans le respect §7), tips/dons, analytics avancés tipsters. |

---

## Prochaines décisions à trancher

1. **Fournisseur de données sportives** (API-Football, Sportmonks…) — conditionne fixtures + settlement.
2. **Agrégateur Mobile Money** (intégration directe Orange/MTN vs agrégateur type CinetPay/PayDunya) — impacte §6 et le time-to-market.
3. **Validation juridique** de la frontière « service d'info vs jeu » avant toute prise de paiement.
