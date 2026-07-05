# Architecture — Transouscris

Plateforme de recharge de crédit et de forfaits mobiles (Côte d'Ivoire) en
**PHP 8.2+ MVC pur (PDO, sans framework)**, front **Vanilla JS + Tailwind**
(PWA installable), base **MySQL 8+**.

## 1. Vue d'ensemble

```
Navigateur / PWA
      │  HTTPS
      ▼
public/index.php  ── front controller unique
      │
      ▼
Core\App ──► Router ──► [Middlewares] ──► Controller ──► Service(s) ──► Model(s) ──► PDO/MySQL
                                                             │
                                                             ├─ WalletService (grand livre partie double)
                                                             ├─ PaymentService (+ PaymentGatewayInterface)
                                                             ├─ RechargeService / OperatorDispatcher
                                                             ├─ OtpService / SmsService
                                                             └─ RefundGuaranteeService (worker)
```

Le flux est strictement unidirectionnel : les **contrôleurs** ne contiennent pas
de logique métier financière — ils délèguent aux **services**, seuls autorisés à
écrire dans le grand livre.

## 2. Arborescence

```
transouscris/
├── public/                     # racine web (seul dossier exposé)
│   ├── index.php               # front controller
│   ├── .htaccess               # rewrite → index.php + durcissement
│   ├── manifest.webmanifest    # PWA
│   ├── service-worker.js       # app shell + mode hors-ligne
│   └── assets/js/app.js        # logique front + file d'attente hors-ligne
├── app/
│   ├── Core/                   # noyau (framework maison)
│   │   ├── App.php             # bootstrap + pipeline middleware + erreurs
│   │   ├── Router.php          # routage {param}, groupes, middlewares
│   │   ├── Controller.php      # base : vue/json/redirect + garde IDOR
│   │   ├── Database.php        # PDO singleton + helper transaction()
│   │   ├── Request/Response    # HTTP
│   │   ├── Session/Csrf        # session sécurisée + jeton CSRF
│   │   ├── Validator.php       # validation par règles
│   │   ├── RateLimiter.php     # fenêtre glissante persistée (FOR UPDATE)
│   │   ├── Config/Env/Logger   # config, .env, logs
│   │   └── Exceptions/         # HttpException, ValidationException, InsufficientFunds
│   ├── Middleware/             # Auth, Admin, Csrf, RateLimit
│   ├── Controllers/            # Auth, Home, Recharge, Wallet, Payment, Pot, Agent, Admin\*
│   ├── Models/                 # Active Record léger (User, LedgerAccount, Recharge...)
│   ├── Services/               # logique métier
│   │   └── Payment/            # PaymentGatewayInterface + implémentations + factory
│   ├── Views/                  # templates PHP (layouts, pages)
│   ├── routes.php              # table de routage
│   └── helpers.php             # e(), money(), csrf_field()...
├── config/                     # config.php, operators.php
├── database/                   # schema.sql, seeds.sql, migrations/
├── bin/console.php             # CLI : migrate, guarantee:run, scheduled:run
├── tests/                      # PHPUnit (Unit + Feature)
└── docs/                       # ARCHITECTURE, DEVELOPMENT_PLAN, TESTING
```

## 3. Le grand livre en partie double (cœur financier)

Toute variation d'argent est une **transaction équilibrée** (`ledger_transactions`)
composée d'au moins deux **écritures** (`ledger_entries`) telles que
`Σ débits = Σ crédits`. Chaque portefeuille utilisateur, chaque flotte d'agent et
chaque compte système est un **compte** (`ledger_accounts`).

Comptes système fournis (voir `seeds.sql`) :

| Code                  | Rôle                                                    |
|-----------------------|---------------------------------------------------------|
| `GATEWAY_CLEARING`    | Compensation des entrées d'argent (mobile money/carte). |
| `OPERATOR_SETTLEMENT` | Séquestre entre le débit wallet et la confirmation opérateur. |
| `PLATFORM_REVENUE`    | Revenus de la plateforme.                               |
| `CASHBACK_RESERVE`    | Réserve pour le cashback / fidélité.                    |

Exemples de flux :

- **Approvisionnement wallet** : `GATEWAY_CLEARING` (débit) → `wallet utilisateur` (crédit).
- **Recharge** : `wallet` (débit) → `OPERATOR_SETTLEMENT` (crédit) ; à la confirmation
  opérateur : `OPERATOR_SETTLEMENT` (débit) → `PLATFORM_REVENUE` (crédit).
- **Remboursement garanti** : `OPERATOR_SETTLEMENT` (débit) → `wallet` (crédit).

### Garanties d'intégrité (`WalletService::post`)

1. **Équilibre** vérifié avant toute écriture (`Σ débits = Σ crédits`).
2. **Idempotence** via `reference` unique (rejeu de webhook, double-clic → no-op).
3. **Verrou pessimiste** : `SELECT ... FOR UPDATE` sur chaque compte, pris dans
   l'ordre croissant des `id` pour éviter les interblocages.
4. **Solde positif** garanti pour les comptes non système (`InsufficientFundsException`).
5. **Atomicité** : tout dans une seule transaction SQL (rollback global sinon).
6. **Contrôle d'intégrité global** : `SUM(balance)` de tous les comptes = 0
   (affiché sur le tableau de bord admin).

## 4. Paiements : re-vérification serveur obligatoire

`PaymentGatewayInterface` unifie CinetPay, PayDunya, Wave (et Stripe pour la
diaspora). Le webhook suit toujours :

1. **Vérifier la signature** HMAC du webhook (rejet immédiat sinon).
2. **Extraire** la référence + l'identifiant fournisseur (le statut annoncé
   dans le webhook n'est **pas** cru).
3. **Re-vérifier côté serveur** le statut *et le montant* via l'API du fournisseur
   (`gateway->verify()`).
4. **Créditer** le wallet uniquement si succès confirmé + montant concordant, de
   manière **idempotente**.

Ajouter un fournisseur = implémenter l'interface + l'enregistrer dans
`PaymentGatewayFactory` — aucun autre code métier à modifier (principe Open/Closed).

## 5. Sécurité (transverse)

- **CSRF** : jeton synchronisé sur toutes les routes mutantes (`CsrfMiddleware`) ;
  les webhooks en sont exclus et reposent sur la signature HMAC.
- **IDOR** : `Controller::authorizeOwnership()` vérifie l'appartenance de chaque
  ressource à l'utilisateur connecté (ex. reçu de recharge).
- **Rate limiting** : `RateLimiter` (persisté, `FOR UPDATE`) sur OTP et paiement.
- **OTP** : jamais stocké en clair (SHA-256 + `APP_KEY`), comparaison temps constant,
  invalidation après consommation ou trop de tentatives.
- **Audit** : `AuditLogger` trace toute opération wallet, connexion, paiement.
- **Secrets** : aucun secret de paiement stocké en clair ; clés en `.env`
  (jamais committé).

## 6. Détection d'opérateur

`OperatorDetector` normalise le numéro puis applique le mapping préfixe
(`07→Orange`, `01→Moov`, `05→MTN`). La détection par préfixe est marquée
`authoritative=false` ; un point d'extension `resolveViaHlr()` permet de brancher
un lookup HLR en production (portabilité des numéros — MNP).

## 7. Mode dégradé hors-ligne (PWA)

Le Service Worker sert la coquille d'application depuis le cache. Les demandes de
recharge émises hors-ligne sont mises en **file d'attente locale** (`localStorage`)
et **rejouées automatiquement** à la reconnexion, avec notification de reprise.
