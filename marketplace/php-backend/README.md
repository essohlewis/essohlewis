# Backend PHP (vanilla + PDO) — Espace client de Marché CI

Réimplémentation de l'**API de l'espace client** en **PHP pur, sans aucun
framework**, avec **PDO** pour l'accès à la base. Elle expose le **même contrat**
que le backend Node (`/api/shop/…`), si bien que la **marketplace front existante
fonctionne telle quelle** dessus (détection automatique du backend, write‑through
des inscriptions/commandes/avis, synchro des collections).

## Pourquoi PDO
Le code métier n'écrit **jamais** de SQL spécifique à un moteur : il passe par
PDO avec des requêtes préparées. Par défaut la base est **SQLite** (un simple
fichier, zéro installation) ; pour la production, il suffit de définir `DB_DSN`
(et `DB_USER`/`DB_PASS`) pour basculer vers **MySQL** ou **PostgreSQL** — sans
changer une ligne de logique. Le schéma s'adapte (auto‑increment portable).

## Prérequis
- **PHP 8.1+** (testé sur 8.4) avec les extensions **PDO** (`pdo_sqlite`,
  éventuellement `pdo_mysql`/`pdo_pgsql`), `json`, `mbstring`, `openssl`.
- Aucune dépendance Composer.

## Lancement (développement)
Un seul serveur intégré sert **le front ET l'API** :
```bash
cd php-backend
php -S localhost:8000 -t public public/index.php
```
Ouvrez ensuite **http://localhost:8000/** — la marketplace détecte le backend et
persiste comptes, commandes et avis en base (`data/marche.db`).

## Déploiement (Apache / nginx)
Pointez la racine web sur le dossier `marketplace/` (le front) et routez
`/api/shop` (et `/api/kyc/health`) vers `php-backend/public/index.php`.
Exemple Apache (`.htaccess` à la racine) :
```apache
RewriteEngine On
RewriteRule ^api/(shop|kyc)/ php-backend/public/index.php [QSA,L]
```

## Endpoints (`/api/shop/…`)
| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | `/health` | public | État + nombre de produits |
| POST | `/register` \| `/login` \| `/logout` | public/client | Comptes + jeton de session |
| GET | `/me` | client | Profil connecté |
| GET | `/products` | public | Catalogue paginé (`?category=`, `?q=`, `?storeId=`) |
| GET | `/products/search` | public | Recherche pondérée (accents + tolérance aux fautes) |
| GET | `/products/facets` | public | Compteurs par catégorie / boutique / tranche de prix |
| GET | `/products/:id` | public | Détail |
| POST | `/products` | admin | Ajout / mise à jour |
| GET | `/categories` | public | Catégories (liste + arborescence) |
| GET / PUT | `/cart` | client | Panier |
| POST | `/orders` | client/invité | Passer commande (**total recalculé serveur**) |
| GET | `/orders` \| `/orders/:id` | client | Mes commandes |
| GET / POST | `/reviews` | public/client | Avis + note agrégée |
| GET / PUT | `/data`, `/data/meta`, `/data/:collection` | client | Synchro des collections (favoris, souhaits…) |
| GET | `/payments/methods` | public | Moyens de paiement (COD ; mobile money à brancher) |
| GET | `/admin/orders`, `/admin/stats` | admin | Back‑office |
| POST | `/admin/orders/:id/status` | admin | Change le statut |

Versionnement : `/api/v1/shop/…` est un **alias** de `/api/shop/…`.

## Sécurité
- Mots de passe **hachés** (`password_hash`, algorithme par défaut de PHP —
  bcrypt/argon2 selon la version).
- Sessions par **jeton porteur** (`Authorization: Bearer …`) à durée de vie.
- **Total de commande recalculé côté serveur** à partir du catalogue (anti‑fraude) ;
  stock décrémenté et panier vidé dans une **transaction PDO**.
- **CORS** restreint via `ALLOWED_ORIGINS` ; en‑tête `X-Content-Type-Options`.
- Admin : jeton `X-Admin-Token` (`ADMIN_TOKEN`, défaut `admin-demo-token`) **ou**
  compte de rôle admin (liste `ADMIN_EMAILS`).

## Variables d'environnement
`DB_DSN`, `DB_USER`, `DB_PASS` (sinon SQLite `data/marche.db`), `SHOP_DB`,
`SHOP_DATA_DIR`, `ADMIN_TOKEN`, `ADMIN_EMAILS`, `ALLOWED_ORIGINS`.

## Périmètre
Ce socle couvre l'**espace client** (comptes, catalogue, recherche, facettes,
catégories, panier, commandes, avis, collections, admin de base). La
**reconnaissance faciale KYC** et le **mobile money réel** ne sont pas inclus ici
(le front retombe proprement sur la revue manuelle / le paiement à la livraison) ;
ils restent branchables comme dans le backend Node.
