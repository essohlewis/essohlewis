# MarchéFraîch CI 🧺

**Marché de quartier digitalisé** — commande en ligne de vivriers et produits
frais, paiement Mobile Money, livraison locale. MVP (Phase 1) pour un marché
pilote en Côte d'Ivoire.

Application **PHP 8 / MySQL / PDO**, architecture MVC légère sans framework,
front **mobile-first installable en PWA**, interface **entièrement en français**,
devise **Franc CFA (XOF)**.

---

## ✨ Fonctionnalités du MVP

| Espace | Fonctions |
|--------|-----------|
| **Client** | Inscription/connexion, catalogue par marché → vendeuse, panier, commande, paiement Mobile Money (CinetPay) ou espèces, suivi de commande en temps réel |
| **Vendeuse** | Inscription simplifiée, gestion des produits (photo, prix, stock), commandes du jour, revenus du jour, avancement des statuts |
| **Coursier** | Disponibilité, liste des courses disponibles, acceptation atomique, confirmation de livraison |
| **Administrateur** | Statistiques (volume, commissions), gestion des marchés, validation/suspension des vendeuses, supervision des coursiers |

Suivi de commande : `Reçue → En préparation → En livraison → Livrée` (ou `Annulée`).

---

## 🗂️ Architecture des fichiers

```
marchefraich-ci/
├── config/
│   └── config.php            # Configuration (surchargée par variables d'env.)
├── sql/
│   ├── schema.sql            # Schéma MySQL normalisé (à exécuter en premier)
│   └── seed.sql              # Données de démonstration (marché pilote)
├── src/
│   ├── bootstrap.php         # Autoload PSR-4, config, connexion DB
│   ├── Core/                 # Database, Router, Controller, Session, Panier…
│   ├── Models/               # Marche, Vendeuse, Produit, Client, Coursier,
│   │                         # Commande (+ lignes), Paiement, Admin
│   ├── Services/
│   │   └── CinetPay.php      # Passerelle Mobile Money (mode simulation intégré)
│   ├── Controllers/          # Home, Auth, Client, Vendeuse, Coursier, Admin
│   └── Views/                # Gabarits PHP (layout + vues par espace)
└── public/                   # Racine web exposée
    ├── index.php             # Front controller (toutes les routes)
    ├── .htaccess             # Réécriture d'URL Apache
    ├── manifest.webmanifest  # Manifeste PWA
    ├── service-worker.js     # Cache hors-ligne
    ├── css/app.css           # Style mobile-first
    ├── js/app.js             # SW, quantités, rafraîchissement du suivi
    └── icons/                # Icônes PWA
```

Le schéma de données couvre déjà les champs préparant la **vision long terme**
(points de fidélité, notes, zones) sans que ces fonctions soient activées :
la base est extensible sans refonte.

---

## 🚀 Installation

### Prérequis
- PHP 8.1+ avec extensions `pdo_mysql` et `gd`
- MySQL / MariaDB 10.4+
- Apache avec `mod_rewrite` (ou le serveur PHP intégré pour le développement)

### 1. Base de données
```bash
mysql -u root -p < sql/schema.sql
mysql -u root -p < sql/seed.sql      # facultatif : données de démonstration
```

### 2. Configuration
Les réglages par défaut conviennent à un poste local. En production, définissez
les variables d'environnement (aucune modification de code nécessaire) :

| Variable | Rôle | Défaut |
|----------|------|--------|
| `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASS` | Connexion MySQL | `127.0.0.1` / `3306` / `marchefraich` / `root` / *(vide)* |
| `APP_BASE_URL` | Préfixe si l'app n'est pas à la racine du domaine | *(vide)* |
| `APP_DEBUG` | Affichage des erreurs (`1`/`0`) | `1` |
| `TAUX_COMMISSION` | Commission plateforme (%) | `5` |
| `FRAIS_LIVRAISON` | Frais de livraison fixes (XOF) | `500` |
| `CINETPAY_API_KEY` `CINETPAY_SITE_ID` `CINETPAY_MODE` `CINETPAY_NOTIFY_URL` | Paiement CinetPay | *(mode `simulation`)* |

> Sans clés CinetPay, le paiement Mobile Money fonctionne en **mode simulation**
> (accepté immédiatement) pour tester le parcours de bout en bout. Le passage en
> production ne change que la configuration.

### 3. Lancement

**Développement** (serveur PHP intégré) :
```bash
cd public
php -S localhost:8000 index.php
```
Ouvrir http://localhost:8000

**Production** : pointez le *DocumentRoot* Apache sur le dossier `public/`.

---

## 🔐 Comptes de démonstration

Après avoir chargé `seed.sql` — mot de passe commun : **`motdepasse`**

| Rôle | Identifiant |
|------|-------------|
| Client | `0500000001` |
| Vendeuse (validée) | `0700000001` |
| Coursier | `0100000001` |
| Administrateur | `admin@marchefraich.ci` |

---

## 🧱 Modèle de données (résumé)

`marches` · `vendeuses` · `produits` · `clients` · `coursiers` ·
`commandes` · `lignes_commande` · `paiements` · `admins`

- Montants entiers en **XOF**, prix et noms **historisés** dans les lignes de
  commande (une commande reste juste même si le produit change ensuite).
- Attribution de coursier **atomique** (le premier qui accepte obtient la course).
- Création de commande **transactionnelle** avec décrément du stock.

---

## 🔒 Sécurité

- Requêtes **préparées** partout (PDO, anti-injection SQL).
- Échappement HTML systématique dans les vues (anti-XSS).
- Jetons **CSRF** sur tous les formulaires sensibles.
- Mots de passe hachés avec `password_hash()` (bcrypt).
- Téléversement d'images restreint (type MIME + taille).

---

## 🛣️ Hors périmètre du MVP (vision future)

Commande groupée par zone, fidélité/cagnotte, pré-commande J-1, notation,
achat groupé vendeuses, attribution automatique géolocalisée des coursiers.
Le schéma est conçu pour les accueillir sans refonte majeure.
