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
| PATCH| `/coachs/moi` | coach | Modifier ma fiche (titre, bio, commune, spécialités, tarifs, photo, couverture) |
| POST | `/coachs/moi/tarifs` | coach | Ajouter un tarif |
| DELETE | `/tarifs/:id` | coach | Supprimer un tarif |
| PUT  | `/coachs/moi/disponibilites` | coach | Remplacer la grille de disponibilités |
| POST | `/coachs/moi/diplomes` | coach | Soumettre un diplôme (→ en_attente) |
| POST | `/coachs/moi/galerie` | coach | Ajouter une photo à la galerie |
| DELETE | `/galerie/:id` | coach | Retirer une photo |
| POST | `/coachs/moi/posts` | coach | Publier sur le mur (texte/image/vidéo) |
| DELETE | `/posts/:id` | coach | Supprimer une publication |
| POST | `/coachs/:id/avis` | client | Laisser un avis (recalcule la note) |
| PATCH| `/avis/:id/reponse` | coach | Répondre à un avis |
| GET  | `/favoris` | connecté | Mes coachs favoris |
| POST | `/favoris` | connecté | Basculer un favori `{ coachId }` |
| POST | `/uploads` | connecté | Téléverser un fichier (multipart, champ `fichier`) → `{ url }` |
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
| GET  | `/admin/reservations` | admin | Toutes les réservations |
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
`js/services/`. Le pont **`js/services/apiService.js`** est déjà inclus.

### Activation (une ligne, sans modifier le code)
Ouvrez la console du navigateur sur l'app et faites :
```js
localStorage.cl_api_base = "http://127.0.0.1:8000"; // URL de votre API
location.reload();
```
L'app bascule alors sur le backend. Pour revenir hors-ligne :
`delete localStorage.cl_api_base; location.reload();`.

### Ce qui est déjà branché (slices 1 & 2 — testés)
**Slice 1**
- **Authentification** : inscription / connexion / déconnexion via l'API,
  **JWT** stocké et envoyé automatiquement, `courant()` reste synchrone.
- **Catalogue coachs** : au démarrage, le catalogue est **hydraté** depuis
  `GET /coachs` dans le store local → home, recherche et profils affichent
  les données réelles **sans réécriture des pages**.
- **Réservations** : création + **paiement Mobile Money** (avec promo) via
  l'API ; la liste des réservations client reflète le serveur.
- **Avis** : publication via l'API (note recalculée côté serveur).

**Slice 2 — boucle transactionnelle client ↔ coach**
- **Hydratation adaptée au rôle** : le client charge ses réservations
  (`GET /reservations/mes`) + favoris (`GET /favoris`), le coach charge les
  demandes reçues (`GET /reservations/coach`) ; les deux chargent leurs
  notifications (`GET /notifications`).
- **Gestion des demandes par le coach** : accepter / refuser / terminer →
  `PATCH /reservations/:id/statut` (le serveur notifie le client).
- **Favoris** : `POST /favoris` (bascule) synchronisé en tâche de fond.
- **Notifications** : marquer une (`PATCH /notifications/:id/lue`) ou toutes
  (`POST /notifications/toutes-lues`) comme lues, synchronisé en tâche de fond.

**Slice 3 — espace coach, uploads, messagerie, admin**
- **Espace coach** : édition de la fiche (titre, bio, commune, spécialités,
  **tarifs** remplacés en bloc) via `PATCH /coachs/moi` ; **disponibilités**
  (`PUT /coachs/moi/disponibilites`) ; **diplômes** (`POST /coachs/moi/diplomes`) ;
  **galerie** (`POST`/`DELETE`) ; **mur/posts** (`POST`/`DELETE`) ;
  **réponses aux avis** (`PATCH /avis/:id/reponse`).
- **Téléversements** : les images (photo, couverture, galerie, posts) sont
  **téléversées** (`POST /uploads`, multipart) au lieu d'être stockées en
  data-URL ; le serveur renvoie un chemin, préfixé à l'affichage (`urlMedia`).
- **Messagerie** : conversations hydratées (`GET /conversations`), ouverture
  (`POST /conversations`), envoi (`POST /conversations/:id/messages`), accusé
  de lecture (`POST /conversations/:id/lu`) — la réponse automatique de démo
  est désactivée en mode API (le vrai interlocuteur répond).
- **Admin** : hydratation des comptes (`GET /admin/utilisateurs`) et de toutes
  les réservations (`GET /admin/reservations`, ajouté) ; **modération des
  diplômes** (`PATCH /admin/diplomes/:id`).

Le mécanisme : **hydratation** (l'API remplit le store local au démarrage /
à la connexion) pour les lectures synchrones, et **appels API** dans les
gestionnaires d'événements pour les écritures — soit `await` (création,
paiement, avis, messagerie), soit « écriture locale optimiste + appel en
tâche de fond puis re-synchronisation de la fiche » (favoris, statut,
notifications lues, espace coach) pour garder les signatures synchrones.
Tant que `cl_api_base` n'est pas défini, l'app fonctionne 100 % hors-ligne.

> **Uploads en développement** : avec le serveur PHP intégré (racine = `api/`),
> réglez `'uploads_url' => '/uploads'` dans `config.php` (au lieu de
> `/api/uploads`) pour que les fichiers soient servis correctement.

### Reste (améliorations, non bloquantes)
« J'aime » sur les posts (pas d'endpoint), messagerie **temps réel**
(WebSocket/polling au lieu du rafraîchissement à l'ouverture), litiges admin
(actuellement locaux), Mobile Money réel, OAuth social, réinitialisation de
mot de passe par email, pagination, rate limiting, HTTPS/prod, tests PHPUnit/CI.

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

> **Note uploads (dev vs prod)** : `uploads_url` vaut `/api/uploads` (Apache,
> racine web au-dessus de `api/`). Avec le serveur PHP intégré (racine = `api/`),
> les fichiers sont servis sur `/uploads/...` — réglez `uploads_url` en
> conséquence dans `config.php` pour le développement.

## 7. Prochaines étapes possibles
- ✅ Upload réel de fichiers (photos, diplômes) via `multipart/form-data` — **fait**.
- Rafraîchissement de token / révocation ; limitation de débit (rate limiting).
- Pagination des listes, cache, journalisation.
- Tests automatisés (PHPUnit) et intégration continue.
- Bascule complète du front sur l'API (service par service, cf. §4).
