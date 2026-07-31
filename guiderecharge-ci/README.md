# GuideRecharge CI 📶

**Portail intelligent des recharges et forfaits mobiles en Côte d'Ivoire.**

GuideRecharge CI centralise toute l'information utile sur les recharges de crédit et les forfaits mobiles (internet, appels, SMS, pass réseaux sociaux) des trois opérateurs ivoiriens — **Orange, MTN et Moov**. Le site n'effectue **aucun paiement en ligne** : il agit comme un **comparateur intelligent + guide pratique**. L'utilisateur trouve le meilleur forfait, obtient le **code USSD exact à composer**, et lance l'appel directement depuis son téléphone via un bouton « Composer ».

> Préfixes Côte d'Ivoire (2025) : **Orange → 07**, **MTN → 05**, **Moov → 01**.

---

## ✨ Fonctionnalités

### Front public
- **Générateur de code USSD** ⭐ — saisie du numéro → détection automatique de l'opérateur par préfixe, choix de l'action + montant, génération du **code exact** avec bouton **« Composer »** (lien `tel:` avec `#` encodé en `%23`) et **« Copier »**.
- **Catalogue des forfaits** — filtres dynamiques (opérateur, catégorie, prix, tri) sans rechargement, cartes avec prix FCFA, data/min/SMS, validité et code d'activation.
- **Comparateur** — 2 à 3 forfaits côte à côte, calcul automatique du **prix au Go** et mise en évidence du meilleur rapport.
- **Guides & procédures** — transfert d'argent, activation, réclamation, numéros utiles.
- **Recherche globale** — forfaits + guides + codes, résultats catégorisés.
- **PWA** installable, thème **clair/sombre**, mobile-first.

### Espace administration
- Connexion sécurisée (Argon2id, rate-limiting anti-force-brute, CSRF).
- Tableau de bord avec statistiques.
- CRUD complet : **Opérateurs**, **Forfaits**, **Codes USSD**, **Guides**.
- Journalisation des actions admin.

---

## 🧱 Stack technique

| Couche | Technologie |
|--------|-------------|
| Front-end | HTML5 sémantique, CSS3 (variables, flexbox, grid), JavaScript vanilla (ES6+) — **aucun framework front** |
| Back-end | **PHP 8.2+ natif**, architecture **MVC maison**, **PDO** en requêtes préparées — **aucun framework PHP** |
| Base de données | MySQL 8+ / MariaDB (InnoDB, utf8mb4) |
| PWA | manifest + service worker (cache hors-ligne) |

Aucun Composer requis : l'autoload PSR-4 est fait maison dans `public/index.php`.

---

## 📁 Arborescence

```
guiderecharge-ci/
├── public/                  # Racine web (seul dossier exposé)
│   ├── index.php            # Front controller (point d'entrée unique)
│   ├── .htaccess            # Réécriture d'URL
│   ├── assets/{css,js,img}  # Design system, logique front, icônes
│   ├── manifest.json        # PWA
│   └── service-worker.js    # Cache offline
├── app/
│   ├── Core/                # Router, Controller, Model, Database, Request,
│   │                        # Response, Session, Csrf, Auth
│   ├── Controllers/         # Home, Forfait, Compare, Ussd, Guide, Search
│   │   └── Admin/           # Auth, Dashboard, Operateur, Forfait, Code, Guide
│   ├── Models/              # Operateur, Forfait, CategorieForfait, CodeUssd,
│   │                        # Guide, AdminUser, Log
│   ├── Views/               # layouts + vues front & admin
│   └── Helpers/             # functions.php, operator_detect.php
├── config/config.php        # Constantes BDD, base URL, sécurité
├── database/
│   ├── schema.sql           # Structure complète
│   ├── seed.sql             # Données réelles (3 opérateurs, ~18 forfaits, codes, 5 guides, admin)
│   └── create_admin.php     # Script CLI de création d'admin
└── routes/web.php           # Déclaration des routes
```

---

## 🚀 Installation locale (XAMPP / LAMP / WAMP)

### 1. Récupérer le projet
Placez le dossier `guiderecharge-ci/` dans le répertoire web de votre serveur (`htdocs` sous XAMPP, `/var/www` sous LAMP).

### 2. Créer et importer la base de données

Via **phpMyAdmin** : importez `database/schema.sql` puis `database/seed.sql`.

Ou en ligne de commande :

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```

Le schéma crée la base `guiderecharge_ci` et le seed la remplit (opérateurs, catégories, forfaits, codes USSD, guides, compte admin).

### 3. Configurer la connexion

Éditez `config/config.php` (ou définissez des variables d'environnement) :

```php
define('DB_HOST', '127.0.0.1');
define('DB_NAME', 'guiderecharge_ci');
define('DB_USER', 'root');
define('DB_PASS', '');        // votre mot de passe MySQL
define('BASE_URL', '');       // ex : '/guiderecharge-ci/public' si sous-dossier
```

> **`BASE_URL`** : laissez `''` si le site est servi à la racine du domaine ou via le VirtualHost pointant sur `public/`. Si vous accédez au site via un sous-dossier (`http://localhost/guiderecharge-ci/public/`), mettez `BASE_URL` à `/guiderecharge-ci/public` et adaptez `RewriteBase` dans `public/.htaccess`.

### 4. Pointer le serveur sur `public/`

La racine web **doit** être le dossier `public/` (seul dossier exposé). Sous XAMPP, configurez un VirtualHost :

```apache
<VirtualHost *:80>
    ServerName guiderecharge.local
    DocumentRoot "C:/xampp/htdocs/guiderecharge-ci/public"
    <Directory "C:/xampp/htdocs/guiderecharge-ci/public">
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

Activez `mod_rewrite` (`LoadModule rewrite_module ...` dans `httpd.conf`).

### 5. (Alternative rapide) Serveur intégré PHP

Pour un test rapide sans Apache :

```bash
php -S 127.0.0.1:8000 -t public public/index.php
```

Puis ouvrez <http://127.0.0.1:8000>. Le front controller sert automatiquement les assets statiques dans ce mode.

---

## 🔐 Espace administration

Accès : **`/admin/login`**

**Identifiants par défaut (à changer immédiatement en production) :**

| Champ | Valeur |
|-------|--------|
| Email | `admin@guiderecharge.ci` |
| Mot de passe | `Admin@2025` |

### Créer / réinitialiser un administrateur

```bash
php database/create_admin.php "Votre Nom" votre@email.ci "MotDePasseFort"
```

Le script hache le mot de passe en **Argon2id** et fait un upsert sur l'email.

---

## 🛡️ Sécurité

- **PDO en requêtes préparées** partout — aucune concaténation SQL.
- **Échappement de sortie** systématique via `e()` (htmlspecialchars) dans les vues.
- **CSRF token** sur tous les formulaires POST (admin + générateur USSD).
- **Sessions sécurisées** : `httponly`, `samesite=Lax`, régénération d'ID à la connexion.
- **Rate-limiting** sur le login admin et le générateur USSD.
- **Validation serveur** de toutes les entrées (jamais confiance au seul JS).
- Mots de passe en **Argon2id**.
- En-têtes de sécurité : `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, CSP de base.

---

## 📝 Notes

- Les **codes USSD** fournis dans le seed sont réalistes et représentatifs du marché ivoirien, mais restent **entièrement administrables** depuis le back-office. Vérifiez-les auprès des opérateurs avant une mise en production.
- Les logos d'opérateurs (`assets/img/orange.svg`, etc.) ne sont pas fournis : les cartes utilisent des badges colorés. Ajoutez vos propres logos si besoin et renseignez le champ `logo` de chaque opérateur.
- Devise : **FCFA (XOF)**. Langue : **Français**.

---

*GuideRecharge CI — Le bon forfait, le bon code, en un clic.*
