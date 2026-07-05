# Transouscris

**Plateforme web/mobile (PWA) de recharge de crédit mobile et de forfaits
internet en Côte d'Ivoire** — Orange, MTN, Moov — avec paiement mobile money
(CinetPay, PayDunya, Wave) et portefeuille sécurisé à **grand livre en partie
double**.

> Stack imposé : **PHP 8.2+ en MVC pur (PDO, sans framework)**, **MySQL 8+**,
> front **Vanilla JS + Tailwind** (PWA installable).

---

## ✨ Fonctionnalités

**MVP**
- Inscription / connexion par **OTP SMS**
- **Détection automatique de l'opérateur** par préfixe (`07→Orange`, `01→Moov`,
  `05→MTN`) + point d'extension **HLR**
- Recharge crédit + souscription de **forfaits** (internet, appel, SMS)
- **Portefeuille** avec **grand livre en partie double** et verrou pessimiste
- Réseau d'**agents** (disponibilité, notation, score de fiabilité)
- Paiement CinetPay/PayDunya avec **re-vérification serveur obligatoire** par webhook
- **Historique** + **reçu téléchargeable**
- **Back-office admin** (agents, transactions, statistiques, contrôle d'intégrité)

**Différenciantes**
- 🤝 **Cagnotte** de recharge collective (lien partageable)
- 🛡️ **Garantie de remboursement automatique** si la recharge n'est pas confirmée
- 📶 **Mode dégradé hors-ligne** (file d'attente locale + rejeu à la reconnexion)
- ⏱️ Recharge programmée, 🎯 cashback/gamification, 🌍 support diaspora (Stripe),
  🔁 fidélité inter-plateformes — *fondations posées, voir le plan de dev*

---

## 🏗️ Architecture

Front controller unique → routeur → middlewares → contrôleurs → **services** →
modèles (PDO). Toute la logique financière est confinée dans les services
(`WalletService`, `PaymentService`, `RechargeService`).

📖 Détail complet : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

```
public/index.php  →  Core\App  →  Router  →  [CSRF|Auth|Admin|RateLimit]  →  Controller
                                                                                │
                                        WalletService (partie double, FOR UPDATE)
                                        PaymentService (PaymentGatewayInterface)
                                        RechargeService · OtpService · ...
```

### Grand livre en partie double
Chaque mouvement est une transaction équilibrée (`Σ débits = Σ crédits`) d'au
moins deux écritures. Idempotence par `reference` unique, verrou pessimiste
`SELECT ... FOR UPDATE` ordonné par `id`, solde ≥ 0 garanti, `SUM(balance)=0`
vérifiable. Voir [`app/Services/WalletService.php`](app/Services/WalletService.php).

### Paiement : re-vérification serveur
Le contenu d'un webhook n'est **jamais** cru : on vérifie la **signature**, puis
on **re-vérifie le statut et le montant** auprès de l'API du fournisseur avant
tout crédit (idempotent). Ajouter un fournisseur = implémenter
[`PaymentGatewayInterface`](app/Services/Payment/PaymentGatewayInterface.php) +
l'enregistrer dans la fabrique.

---

## 🚀 Démarrage

### Option A — Docker (une seule commande, recommandé)

Prérequis : Docker + Docker Compose.

```bash
docker compose up --build
#   puis ouvrir http://localhost:8080
```

Le service `app` attend MySQL, applique automatiquement le schéma et les données
de départ (si la base est vide), puis sert l'application. Un service `worker`
rejoue périodiquement la garantie de remboursement. MySQL est exposé sur le port
hôte `3307` pour un client SQL. Les identifiants et clés de développement sont
définis dans `docker-compose.yml` (à régénérer en production).

Arrêt : `docker compose down` (ajouter `-v` pour effacer aussi la base).

### Option B — Installation locale

Prérequis : PHP 8.2+, MySQL 8+, extensions `pdo_mysql`, `curl`, `openssl`.

```bash
# 1. Configuration
cp .env.example .env          # renseigner DB_*, clés CinetPay/PayDunya, APP_KEY
#    APP_KEY : openssl rand -base64 32

# 2. Base de données (schéma + données de départ)
php bin/console.php migrate

# 3. Serveur de développement
php -S localhost:8000 -t public
#    puis ouvrir http://localhost:8000
```

En mode `APP_DEBUG=true`, les SMS OTP ne sont pas envoyés mais **journalisés**
(`storage/logs/app.log`) et le code s'affiche sur la page de connexion —
pratique pour tester la connexion sans crédit SMS.

### 🧪 Tester un paiement en local (sans compte marchand)

En mode `APP_DEBUG=true`, une passerelle de **simulation** apparaît dans le
sélecteur de moyen de paiement (« Simulateur (dev) »). Sur *Approvisionner le
portefeuille*, choisissez-la : vous êtes redirigé vers une page interne où
**Confirmer** crédite réellement le portefeuille via le même circuit de
re-vérification que les vraies passerelles. Vous pouvez alors enchaîner sur une
recharge. Cette passerelle est automatiquement masquée en production.

### Tâches planifiées (cron)
```bash
* * * * *  php /chemin/bin/console.php guarantee:run   # remboursements garantis
```

---

## 🧪 Tests

```bash
composer install && composer test      # PHPUnit
# ou sans Composer : php phpunit.phar --testsuite unit
```

Tests critiques prioritaires (financier, webhooks, IDOR) :
[`docs/TESTING.md`](docs/TESTING.md). Les tests unitaires (16, verts) couvrent la
détection d'opérateur, les invariants de partie double, la validation et la
signature de webhook — sans base de données.

---

## 📚 Documentation

| Document | Contenu |
|----------|---------|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Arborescence, grand livre, paiement, sécurité |
| [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md) | Plan en 6 phases et état d'avancement |
| [`docs/TESTING.md`](docs/TESTING.md) | Liste ordonnée des tests critiques |

---

## 🔒 Sécurité

CSRF sur toutes les routes mutantes · protection IDOR (vérification
d'appartenance) · rate limiting OTP/paiement · OTP hashé (jamais en clair) ·
journal d'audit sur le wallet · secrets en `.env` (jamais committé) · aucune
donnée de paiement sensible stockée en clair.

---

*Projet original. Aucun code, texte, structure de menu ou design d'une plateforme
concurrente n'a été repris.*
