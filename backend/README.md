# Pronos API — Backend (Laravel 13)

API de la plateforme de pronostics sportifs (Phase 1 MVP : foot, Côte d'Ivoire).
Conçue autour de trois invariants : **track record immuable**, **argent traçable**,
**rôles séparés**. Voir [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

## Stack

- Laravel 13 · PHP 8.4
- Auth : Sanctum (tokens), identité = numéro de téléphone + OTP
- DB : SQLite en dev, MySQL en prod
- Files : queue Redis (prod), synchrone en dev

## Démarrage

```bash
cd backend
cp .env.example .env
composer install
php artisan key:generate
touch database/database.sqlite
php artisan migrate --seed        # crée un tipster noté + des matchs
php artisan serve
```

Le seed crée un pronostiqueur approuvé (`+2250700000001`), un consommateur avec
un wallet approvisionné (`+2250700000002`), 40 pronostics réglés (donc un score de
fiabilité réel) et 5 matchs à venir.

## Concepts clés

| Domaine | Où | Garantie |
|---|---|---|
| Immuabilité des paris | `PredictionController::store` | Création uniquement avant le coup d'envoi ; `locked_at` = horloge serveur ; aucune route update/delete. |
| Wallet & idempotence | `Services/WalletService` | Ledger append-only, idempotent sur `reference`, verrou pessimiste, solde jamais négatif. |
| Mobile Money | `Services/MobileMoney/*` + `WebhookController::mobileMoney` | Wallet prépayé, webhooks signés (HMAC), `pending → completed` idempotent. |
| Scoring | `Services/ReliabilityService` | Score composite (yield pondéré récence), gating volume ≥ 30, snapshots non écrasés. |
| Settlement | `Services/SettlementService` + `WebhookController::results` | Résultat depuis webhook signé uniquement ; markets 1x2 / over-under / btts ; void = mise rendue. |
| Abonnements | `Services/SubscriptionService` | Débit wallet prépayé, commission 20 % retenue, crédit net au tipster. |

## API (préfixe `/api/v1`)

```
POST   auth/request-otp           { phone }
POST   auth/verify-otp            { phone, code } -> { token }
GET    me                         (auth)
POST   auth/logout                (auth)

GET    tipsters                   classement par fiabilité
GET    tipsters/{id}
GET    tipsters/{id}/predictions  picks abonnés masqués si non-abonné
GET    fixtures                   matchs à venir

POST   tipster/apply              (auth) devenir pronostiqueur
POST   predictions                (auth, tipster) publier — refusé après le coup d'envoi
GET    predictions/{id}           (auth)

GET    wallet                     (auth) solde + historique
POST   wallet/topup               (auth) initie une collecte Mobile Money
GET    subscriptions              (auth)
POST   subscriptions              { tipster_id } débit wallet
DELETE subscriptions/{id}         coupe l'auto-renew

POST   webhooks/momo              signé (X-Signature HMAC)
POST   webhooks/results           signé (X-Signature HMAC)
```

## Tests

```bash
php artisan test
```

Couvre les invariants critiques : refus de pronostic après le coup d'envoi,
idempotence du wallet (rejeu de webhook), masquage/révélation des picks abonnés,
commission reversée au tipster.

## Reste à faire (hors périmètre MVP)

- Drivers Mobile Money réels (Orange / MTN) derrière `MobileMoneyProvider`.
- Intégration d'un fournisseur de données sportives (fixtures + résultats).
- Renouvellement automatique des abonnements (job planifié sur le wallet prépayé).
- Payouts tipsters (endpoint + gate KYC) et réconciliation Mobile Money.
- KYC, modération, notifications temps réel (broadcast/push/SMS).
