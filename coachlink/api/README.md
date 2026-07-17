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
| POST | `/auth/mot-de-passe/oubli` | – | Demande de réinitialisation (email) |
| POST | `/auth/mot-de-passe/reset` | – | Réinitialise via `{ token, motDePasse }` |
| GET  | `/auth/oauth/:provider` | – | URL d'autorisation (facebook/linkedin) |
| GET  | `/auth/oauth/:provider/callback` | – | Retour OAuth → redirige le front avec le JWT |
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
| POST | `/posts/:id/like` | connecté | Basculer le « J'aime » → `{ likes, aime }` |
| GET  | `/mes-likes` | connecté | Publications aimées (liste d'IDs) |
| POST | `/coachs/:id/avis` | client | Laisser un avis (recalcule la note) |
| PATCH| `/avis/:id/reponse` | coach | Répondre à un avis |
| GET  | `/favoris` | connecté | Mes coachs favoris |
| POST | `/favoris` | connecté | Basculer un favori `{ coachId }` |
| POST | `/uploads` | connecté | Téléverser un fichier (multipart, champ `fichier`) → `{ url }` |
| POST | `/reservations` | client | Créer une réservation |
| GET  | `/reservations/mes` | connecté | Mes réservations (client) |
| GET  | `/reservations/coach` | coach | Demandes reçues |
| POST | `/reservations/:id/payer` | client | Paiement Mobile Money (+ promo) — passerelle |
| PATCH| `/reservations/:id/statut` | connecté | Changer le statut |
| POST | `/paiements/callback` | – (webhook) | Confirmation asynchrone d'un opérateur |
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
| POST | `/litiges` | connecté | Ouvrir une réclamation `{ coachNom, motif }` |
| GET  | `/admin/litiges` | admin | File des réclamations |
| PATCH| `/admin/litiges/:id` | admin | Changer le statut d'un litige |

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

> **En production**, ne comptez pas sur `localStorage` : créez `js/config.js`
> (depuis `js/config.example.js`) avec `window.CL_CONFIG = { apiBase:"/api",
> apiActif:true }` et chargez-le dans `index.html`. Voir **`DEPLOIEMENT.md`**
> (Apache/Nginx + HTTPS + checklist de configuration et de sécurité).

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

**Slice 4 — finalisation fonctionnelle**
- **« J'aime »** sur les publications : bascule par utilisateur
  (`POST /posts/:id/like`, table `post_likes`), état hydraté via `GET /mes-likes`.
- **Litiges** : le client ouvre une réclamation (`POST /litiges`), l'admin la
  suit et la résout (`GET`/`PATCH /admin/litiges`) — persistés en base.
- **Réinitialisation de mot de passe** : flux à jeton
  (`/auth/mot-de-passe/oubli` → `/reset`), table `resets` avec expiration.
  L'envoi d'email est **simulé** (le jeton est renvoyé pour la démo — à
  remplacer par un vrai service d'email en production).

**Slice 5 — durcissement pour la production**
- **Limitation de débit** (anti-abus / anti-brute-force) : `core/RateLimiter.php`,
  fenêtre fixe par IP, stockage fichier avec verrou. Seau **global** (240/min
  par défaut) appliqué à toutes les routes + seau **auth** (12/min) sur
  `login`, `register` et les routes mot de passe. Au-delà → **429** +
  `Retry-After`. Réglable dans `config.php` (`rate_limit`), désactivable (0).
- **En-têtes de sécurité** sur toutes les réponses : `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Content-Security-Policy`.
- **Pagination** optionnelle des listes (`core/Pagination.php`) : `?page=&parPage=`
  sur `/coachs`, `/admin/utilisateurs`, `/admin/reservations`. **Non-intrusive**
  (sans paramètre → liste complète, pour l'hydratation du front) ; total exposé
  via l'en-tête `X-Total-Count`.

**Slice 6 — messagerie temps réel (front)**
- `js/services/realtimeService.js` : interrogation périodique (polling) de
  `GET /notifications` en mode API. Nouvelle notification → mise à jour de la
  cloche (`cl:notif`) ; nouveau message → rechargement des conversations +
  `cl:message` (le fil ouvert se met à jour en direct, sans recharger).
- Économe : en pause quand l'onglet est masqué, une seule requête en vol,
  démarré/arrêté avec la session, aucun effet hors-ligne. Intervalle réglable
  via `localStorage.cl_poll_ms` (8 s par défaut). Aucun changement backend requis.

**Slice 7 — paiement Mobile Money (architecture passerelle)**
- Abstraction `PaiementGateway` + fabrique `PaiementService` : sélectionne la
  passerelle selon l'opérateur et la config. **Simulateur par défaut** (aucun
  identifiant requis, code à 4 chiffres = succès), donc rien ne change en démo.
- **4 opérateurs prêts pour la production** : `PaiementOrangeMoney` (OAuth +
  Web/Push Payment), `PaiementWave` (Checkout), `PaiementMtn` (MoMo Collections
  RequestToPay) et `PaiementMoov` (OAuth + paiement) — squelettes suivant les
  vraies API, activés en renseignant les identifiants marchands dans
  `config.php → paiement` (`mode: 'reel'` + `<op>.actif`).
- **Flux asynchrone réel** : `POST /reservations/:id/payer` renvoie **202**
  `{ paiement_statut: 'en_attente', reference, lien }` ; l'opérateur confirme via
  le webhook **`POST /paiements/callback`** (garde-fou par secret partagé
  `X-Callback-Secret`) qui marque la réservation payée. Le front gère les deux
  cas (succès immédiat / en attente).
- `core/HttpClient.php` : petit client cURL (sans dépendance) pour les appels
  opérateurs. **Aucun secret dans le dépôt** (tout est dans `config.php`).

**Slice 8 — envoi d'email réel (réinitialisation de mot de passe)**
- Abstraction `MailTransport` + `MailService` (même patron que le paiement).
  **`MailLog` par défaut** : aucun email n'est envoyé, ils sont écrits dans
  `cache_dir/mails/*.eml` (démo/test). **`MailSmtp`** : client SMTP réel en
  **sockets bruts** (STARTTLS/SSL + AUTH LOGIN), compatible Gmail / SendGrid /
  Mailgun / OVH… Activez avec `mail.mode = 'smtp'` + identifiants dans `config.php`.
- `POST /auth/mot-de-passe/oubli` **envoie l'email** de réinitialisation
  (lien `#/reinitialiser?token=…`, valable 1 h). En mode démo (log) le jeton est
  aussi renvoyé pour tester sans boîte mail ; en mode SMTP il ne l'est pas.
- Front : page **`#/reinitialiser`** (ouverte depuis le lien email) → nouveau
  mot de passe → `POST /auth/mot-de-passe/reset`.

**Slice 9 — connexion sociale (OAuth Facebook / LinkedIn)**
- Abstraction `OAuthProvider` + `OAuthService` (même patron adaptateur).
  `OAuthFacebook` (Graph API) et `OAuthLinkedIn` (OpenID Connect) — squelettes
  réels, activés via `config.php → oauth` (`<reseau>.actif` + `client_id`/
  `client_secret` + `redirect_base`/`front_url`).
- Flux : `GET /auth/oauth/:provider` renvoie l'URL d'autorisation (state signé
  JWT = anti-CSRF) → l'utilisateur autorise → `GET /auth/oauth/:provider/callback`
  échange le code, crée/retrouve le compte, émet un JWT et **redirige le front**
  (`#/connexion?oauth=<jwt>`). Front : `auth.connecterAvecToken` connecte
  l'utilisateur. **Repli** : si un réseau n'est pas configuré, le front bascule
  sur la simulation (hors-ligne) ou informe l'utilisateur.

### Reste (améliorations, non bloquantes)
HTTPS/prod, notifications push (WebSocket/SSE pour remplacer le polling),
rafraîchissement/révocation de token, journalisation structurée.

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
│                         #   Jwt, Auth, Validator, RateLimiter, Pagination,
│                         #   HttpClient, PaiementGateway/Service/Simulateur/…,
│                         #   MailTransport/Service/Log/Smtp,
│                         #   OAuthProvider/Service/Facebook/LinkedIn
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
- **Limitation de débit** par IP (`core/RateLimiter.php`) : seau global + seau
  auth renforcé (anti-brute-force). Réglable via `rate_limit` dans `config.php`.
- **En-têtes de sécurité** sur chaque réponse (`nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy`, `Content-Security-Policy`).
- CORS configurable ; en production, restreignez `cors_origins` à votre domaine.
- Pensez à servir l'API en **HTTPS** et à changer `jwt_secret` + le mot de passe admin.

> **Note uploads (dev vs prod)** : `uploads_url` vaut `/api/uploads` (Apache,
> racine web au-dessus de `api/`). Avec le serveur PHP intégré (racine = `api/`),
> les fichiers sont servis sur `/uploads/...` — réglez `uploads_url` en
> conséquence dans `config.php` pour le développement.

## 7. Tests automatisés

Le backend est couvert par une suite **PHPUnit** (SQLite en base temporaire,
isolée). PHPUnit est la **seule** dépendance, et uniquement pour le développement
(le code d'exécution reste sans dépendance).

```bash
cd coachlink/api
composer install          # installe PHPUnit (dossier vendor/, ignoré par git)
composer test             # ou : vendor/bin/phpunit
```

Couverture : JWT (aller-retour, signature altérée, expiration), Validator
(email, téléphone CI, min, listes), modèle User (hachage/vérification),
modèle Coach (recherche, remplacement de tarifs, « J'aime » par utilisateur),
flux de réservation (création → statut → paiement avec remise), Pagination et
RateLimiter. **20 tests / 59 assertions.**

### Intégration continue
`.github/workflows/ci.yml` exécute à chaque *push* / *pull request* : `php -l`
sur tout le PHP, `composer install` + **PHPUnit** (PHP 8.2 et 8.4), et
`node --check` sur tout le JavaScript du front.

## 8. Prochaines étapes possibles
- ✅ Upload réel de fichiers, rate limiting, en-têtes de sécurité, pagination — **fait**.
- ✅ Bascule complète du front sur l'API (service par service, cf. §4) — **fait**.
- ✅ Tests automatisés (PHPUnit) + intégration continue — **fait**.
- ✅ Messagerie temps réel (polling front) — **fait**.
- ✅ Paiement Mobile Money (architecture passerelle + Orange/Wave + webhook) — **fait**.
- ✅ Envoi d'email réel (transport SMTP + flux réinitialisation par lien) — **fait**.
- ✅ 4 opérateurs Mobile Money (Orange, Wave, MTN, Moov) — **fait**.
- ✅ Connexion sociale OAuth (Facebook, LinkedIn) — **fait**.
- Rafraîchissement de token / révocation ; journalisation structurée.
- Push WebSocket/SSE, HTTPS/prod.
