# CoachLink CI — Backend (PHP pur, MVC + PDO)

API REST **sans framework** (ni Laravel, ni Symfony…). Architecture MVC légère,
PDO avec requêtes préparées, authentification **JWT** (HS256, maison),
`password_hash` (bcrypt), validation des entrées, CORS.

Compatible **MySQL** (production) et **SQLite** (développement/tests).

---

## 1. Prérequis
- PHP **8.1+** avec extensions `pdo`, `pdo_mysql` (ou `pdo_sqlite`), `json`, `mbstring`.
- MySQL 5.7+/MariaDB (en production). SQLite suffit pour tester.

## 2. Installation

```bash
cd coachlink/api
cp config/config.example.php config/config.php   # puis éditez les valeurs
```

Éditez `config/config.php` : identifiants base de données et **`jwt_secret`**
(mettez une longue chaîne aléatoire en production).

### Option A — MySQL (production)
```bash
mysql -u root -p -e "CREATE DATABASE coachlink CHARACTER SET utf8mb4;"
mysql -u root -p coachlink < database/schema.sql   # schéma
php database/migrate.php                            # + admin & 12 coachs de démo
```
> `migrate.php` crée aussi les tables si elles n'existent pas et importe les
> 12 coachs depuis `../data/coachs.json`. Vous pouvez donc n'utiliser que
> `migrate.php` (le `schema.sql` est fourni comme référence SQL).

### Option B — SQLite (test rapide, sans serveur MySQL)
Dans `config.php`, mettez `'driver' => 'sqlite'`, puis :
```bash
php database/migrate.php          # crée coachlink.sqlite + données de démo
php -S 127.0.0.1:8000 server-router.php   # serveur de développement
```
L'API répond sur `http://127.0.0.1:8000` (ex : `GET /ping`, `GET /coachs`).

### Production (Apache)
Placez le dossier `api/` sous votre racine web. Le `.htaccess` fourni réécrit
tout vers `index.php`. L'API est alors disponible sur `https://votredomaine/api`.
(Sous Nginx, redirigez `try_files $uri /api/index.php;`.)

**Compte admin par défaut** : `admin@coachlink.ci` / `admin123` (à changer).

---

## 3. Points d'entrée (endpoints)

Toutes les réponses ont la forme `{ "ok": true, "data": ... }` ou
`{ "ok": false, "message": "...", "erreurs": {...} }`.
Les routes protégées attendent un en-tête `Authorization: Bearer <token>`.

| Méthode | Chemin | Rôle | Description |
|--------|--------|------|-------------|
| POST | `/auth/register` | – | Inscription (client/coach) → `{ user, token }` |
| POST | `/auth/login` | – | Connexion → `{ user, token }` |
| GET  | `/auth/me` | connecté | Profil courant |
| GET  | `/coachs` | – | Liste + filtres `?texte=&specialite=&commune=&langue=&noteMin=&prixMax=&tri=` |
| GET  | `/coachs/:id` | – | Profil coach complet (tarifs, avis, galerie, TrustScore…) |
| GET  | `/coachs/moi` | coach | Ma fiche coach |
| PATCH| `/coachs/moi` | coach | Modifier ma fiche (titre, bio, commune, photo, couverture) |
| POST | `/coachs/:id/avis` | client | Laisser un avis (recalcule la note) |
| PATCH| `/avis/:id/reponse` | coach | Répondre à un avis |
| POST | `/reservations` | client | Créer une réservation |
| GET  | `/reservations/mes` | connecté | Mes réservations (client) |
| GET  | `/reservations/coach` | coach | Demandes reçues |
| POST | `/reservations/:id/payer` | client | Paiement Mobile Money (+ promo) |
| PATCH| `/reservations/:id/statut` | connecté | Changer le statut |
| GET  | `/notifications` | connecté | `{ items, nonLues }` |
| PATCH| `/notifications/:id/lue` | connecté | Marquer lue |
| POST | `/notifications/toutes-lues` | connecté | Tout marquer lu |
| GET  | `/conversations` | connecté | Mes conversations |
| POST | `/conversations` | connecté | Ouvrir/récupérer une conversation |
| POST | `/conversations/:id/messages` | connecté | Envoyer un message |
| GET  | `/admin/stats` | admin | Statistiques plateforme |
| GET  | `/admin/utilisateurs` | admin | Liste des comptes |
| GET  | `/admin/diplomes` | admin | Diplômes en attente |
| PATCH| `/admin/diplomes/:id` | admin | Valider/refuser un diplôme |

### Exemple
```bash
# Connexion
curl -X POST http://127.0.0.1:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@coachlink.ci","motDePasse":"admin123"}'

# Liste des coachs sportifs, triés par note
curl "http://127.0.0.1:8000/coachs?specialite=sport&tri=note"
```

---

## 4. Brancher le front-end sur l'API

Le front a été conçu pour ça : toute la donnée passe par la couche
`js/services/`. Un client prêt à l'emploi est fourni : **`js/services/apiService.js`**.

Étapes :
1. Incluez `apiService.js` dans `index.html` (avant les pages).
2. Dans `apiService.js`, réglez `CL.API.base` (URL de l'API) et `CL.API.actif = true`.
3. Dans chaque service front, remplacez les accès `localStorage` par des appels
   `CL.API.*`. Le format des objets renvoyés est identique → **les pages ne
   changent pas**. Exemple pour l'authentification :

```js
// authService.connecter() — version API
async connecter(email, motDePasse) {
  const res = await CL.API.connecter({ email, motDePasse });
  CL.API.definirToken(res.token);   // stocke le JWT
  return { ok: true, user: res.user };
}
```

Tant que `CL.API.actif` reste `false`, l'application continue de fonctionner
100 % hors-ligne (localStorage) — la bascule se fait service par service.

---

## 5. Architecture

```
api/
├── index.php            # Front controller (point d'entrée unique)
├── .htaccess            # Réécriture Apache → index.php
├── routes.php           # Table des routes → contrôleurs
├── server-router.php    # Routeur du serveur PHP intégré (dev uniquement)
├── config/
│   ├── config.example.php
│   └── config.php        # (ignoré par git — secrets)
├── core/                 # App, Router, Request, Response, Database (PDO),
│                         #   Jwt, Auth, Validator
├── models/               # Model (CRUD PDO) + User, Coach, Reservation,
│                         #   Review, Message, Notification
├── controllers/          # Auth, Coach, Reservation, Review, Notification,
│                         #   Message, Admin, Health
├── database/
│   ├── schema.sql        # Schéma MySQL de référence
│   ├── migrate.php       # Migration + seed (MySQL ou SQLite)
│   └── coachlink.sqlite  # (généré en mode SQLite — ignoré par git)
└── uploads/              # Fichiers téléversés (ignoré par git)
```

## 6. Sécurité
- **Requêtes préparées** partout (PDO) → protection contre l'injection SQL.
- Mots de passe **hachés** avec `password_hash` (bcrypt).
- **JWT** signés HMAC-SHA256, vérifiés à chaque requête protégée (expiration).
- Validation systématique des entrées (`core/Validator.php`).
- CORS configurable ; en production, restreignez `cors_origins` à votre domaine.
- Pensez à servir l'API en **HTTPS** et à changer `jwt_secret` + le mot de passe admin.

## 7. Prochaines étapes possibles
- Upload réel de fichiers (photos, diplômes) via `multipart/form-data`.
- Rafraîchissement de token / révocation.
- Pagination des listes, cache, journalisation.
- Tests automatisés (PHPUnit) et intégration continue.
