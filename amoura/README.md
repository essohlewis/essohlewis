# 💞 Amoura — Plateforme SaaS de rencontres en ligne

Réseau social de rencontres complet : profils riches, découverte & matching,
**chat temps réel**, **messages vocaux**, **appels audio/vidéo WebRTC**, statuts
éphémères, mur d'actualité, abonnements Premium multi‑pays (cartes + Mobile Money)
et un **espace d'administration / CMS** complet.

Construit **sans framework** : PHP 8.2+ en **MVC pur**, HTML/CSS/JS vanilla, MySQL (PDO),
WebSocket (Ratchet) pour le temps réel et le signaling WebRTC.

---

## 🧱 Stack technique

| Couche | Technologie |
|---|---|
| Frontend | HTML5, CSS3 (design system maison), JavaScript vanilla (aucun framework) |
| Backend | PHP 8.2+, architecture **MVC maison** (routeur, autoloader PSR‑4, PDO singleton, chargeur `.env`) |
| Base de données | MySQL 8 / MariaDB 10.6 via **PDO, requêtes préparées uniquement** |
| Temps réel | Serveur WebSocket PHP dédié (`cboden/ratchet`) — chat, présence, notifications, **signaling WebRTC** |
| Appels A/V | **WebRTC** pair‑à‑pair + STUN/TURN (coturn) pour la traversée NAT |
| Messages vocaux | `MediaRecorder` (navigateur) → upload → stockage serveur, waveform |
| Paiements | Stripe, PayPal, **CinetPay & PayDunya** (Mobile Money Afrique de l'Ouest) |

---

## 📂 Structure du projet

```
amoura/
├── public/                     # Racine web (seul dossier exposé)
│   ├── index.php               # Contrôleur frontal (front controller)
│   ├── .htaccess               # Réécriture + durcissement
│   ├── assets/{css,js,img}     # Design system + modules JS vanilla
│   └── uploads/                # Médias téléversés (hors VCS)
├── app/
│   ├── Core/                   # Framework maison
│   │   ├── Autoloader.php  Env.php  Database.php  Router.php
│   │   ├── Controller.php  Model.php  View.php  Request.php  Response.php  Session.php
│   │   └── Security/           # Csrf, RateLimiter, Validator, Sanitizer, Auth (Argon2id), WsTicket
│   ├── Middleware/             # Authenticate, VerifyCsrf, RequireStaff, RedirectIfAuth
│   ├── Controllers/            # Auth, Profile, Discover, Match, Message, Call, Post, Story,
│   │   │                       # Notification, Subscription, Webhook … + Admin/ + Api/
│   ├── Models/                 # User, Profile, Photo, Swipe, Matching, Message, Call, Story,
│   │                           # Post, Comment, Plan, Subscription, Transaction, Report, Setting…
│   ├── Services/               # Mailer, OtpService, Uploader, Payment/ (passerelles)
│   ├── Views/                  # Vues PHP natives (layouts, partials, pages)
│   ├── Helpers/functions.php   # e(), csrf_field(), age_from(), time_ago()…
│   └── routes.php              # Table de routage
├── websocket/
│   ├── server.php              # Point d'entrée du serveur WebSocket
│   └── ChatServer.php          # Chat, présence, notifications, signaling WebRTC
├── database/
│   ├── schema.sql              # Schéma complet (25+ tables)
│   └── seed.sql                # Rôles, plans, paramètres, pages CMS
├── scripts/                    # migrate.php, make_admin.php, gen_key.php
├── composer.json               # Autoload PSR‑4 + Ratchet
└── .env.example
```

---

## 🚀 Installation

```bash
cd amoura
cp .env.example .env
php scripts/gen_key.php          # copiez APP_KEY dans .env
# Renseignez DB_*, WS_*, et vos clés de paiement dans .env

composer install                 # installe Ratchet (temps réel)

# Base de données
php scripts/migrate.php --fresh  # crée le schéma + les données de démarrage
php scripts/make_admin.php admin@amoura.example 'MotDePasse123'

# Serveur web (dev)
php -S localhost:8080 -t public server.php

# Serveur temps réel (dans un autre terminal)
php websocket/server.php
```

Ouvrez <http://localhost:8080>. L'espace admin est sur `/admin`.

> Sans `composer install`, l'application web fonctionne (autoloader maison) ;
> seul le serveur WebSocket requiert Ratchet.

### 🪟 Démarrage avec XAMPP / WAMP (Windows)

Placez le dossier dans `C:\xampp\htdocs\amoura`, démarrez **Apache** et **MySQL**, puis :

1. Ouvrez <http://localhost/phpmyadmin> → onglet **Importer** → sélectionnez
   **`database/install.sql`**. Ce fichier crée en une fois : la base `amoura`,
   l'utilisateur applicatif (`amoura` / `secret`), le schéma et les données.
2. Copiez `.env.example` en `.env`. Les valeurs par défaut conviennent à XAMPP,
   mais si vous préférez l'utilisateur `root` (sans mot de passe sous XAMPP) :
   ```
   DB_HOST=127.0.0.1
   DB_NAME=amoura
   DB_USER=root
   DB_PASS=
   ```
3. Créez un admin : `php scripts/make_admin.php admin@amoura.example "Admin@1234"`
4. Ouvrez <http://localhost/amoura/public> (ou configurez un VirtualHost sur `public/`).

> ⚠️ L'erreur `SQLSTATE[HY000] [1045] Access denied for user 'amoura'@'localhost'`
> signifie simplement que la base/l'utilisateur n'ont pas encore été créés :
> importez `database/install.sql` (étape 1). L'application affiche désormais un
> guide d'installation clair à la place d'une erreur brute.

### 🐳 Démarrage avec Docker (pile complète)

```bash
docker compose up -d --build     # web + MySQL + WebSocket + coturn
docker compose exec web php scripts/make_admin.php admin@amoura.example 'MotDePasse123'
```

- Web : <http://localhost:8080> · WebSocket : `ws://localhost:8090`
- Le schéma et les données de démarrage sont chargés automatiquement au premier
  lancement de MySQL (`database/*.sql` montés dans `docker-entrypoint-initdb.d`).
- `coturn` (STUN/TURN) tourne en `network_mode: host` pour l'allocation des ports relais.

---

## ✅ Tests

Suite **PHPUnit** : tests unitaires (sans base) + tests d'intégration (MySQL réel).

```bash
composer test                 # toute la suite
vendor/bin/phpunit --testsuite Unit          # logique pure (routeur, sécurité, validation, paiements)
vendor/bin/phpunit --testsuite Integration   # matching, messagerie, facturation sur MySQL

# Base de test dédiée (les tests d'intégration sont ignorés si MySQL est absent) :
DB_HOST=127.0.0.1 DB_PORT=3306 DB_USER=root DB_PASS=secret DB_NAME=amoura_test \
  vendor/bin/phpunit
```

Couverture cœur : hachage Argon2id, CSRF, échappement/anti-XSS, tickets WebSocket,
validation, routeur (paramètres/groupes/middlewares), détection opérateur Mobile Money,
**like → match mutuel → conversation → message**, exclusion découverte (swipés/bloqués),
et **activation d'abonnement idempotente** (webhook + retour navigateur).

---

## 🗺️ Livraison modulaire

1. **Schéma SQL** — `database/schema.sql` (utilisateurs, profils, photos, matchs,
   messages, appels, statuts, publications, abonnements, transactions, signalements,
   rôles, paramètres CMS, journaux d'audit, rate‑limit).
2. **Core MVC** — `app/Core/*` : routeur léger, autoloader PSR‑4, PDO singleton, `.env`.
3. **Authentification** — email + OTP, vérification, connexion, reset, Argon2id.
4. **Profils & découverte** — profil riche, photos, filtres, like/pass, **match mutuel**.
5. **Messagerie temps réel** — chat WebSocket, frappe, accusés lu/reçu, présence,
   **messages vocaux + waveform**, images, réactions.
6. **Appels WebRTC** — signaling WebSocket + STUN/TURN, audio & vidéo P2P.
7. **Social** — statuts éphémères (24 h) + mur (posts, likes, commentaires) + notifications.
8. **Abonnements/paiements** — plans Premium/VIP, Stripe/PayPal/CinetPay/PayDunya,
   **vérification serveur systématique + webhooks idempotents**.
9. **Admin / CMS** — tableau de bord, gestion membres, modération, facturation,
   paramètres du site, pages éditables, rôles/permissions, journal d'audit, notifications de masse.

---

## 🔒 Sécurité & conformité

- **Injection SQL** : requêtes préparées PDO partout ; noms de colonnes validés (`assertColumn`).
- **XSS** : échappement systématique en sortie (`e()`), liste blanche HTML pour le contenu riche, **CSP stricte par nonce** (sans `unsafe-inline` pour les scripts).
- **CSRF** : jeton synchronisé vérifié sur toute requête mutative (`VerifyCsrf`).
- **Mots de passe** : **Argon2id** (64 Mo / t=4), ré‑hachage transparent.
- **Sessions** : cookies `HttpOnly` + `SameSite`, régénération d'ID, anti‑fixation.
- **Rate limiting** : persistant, avec `SELECT … FOR UPDATE` (login, OTP, reset).
- **Opérations sensibles** : transactions + verrouillage de ligne (matchs, paiements idempotents).
- **Paiements** : jamais activés sur un retour navigateur — **re‑vérification serveur** + webhook signé.
- **Modération** : signalements, revue photos/publications, blocage, gestion des faux profils.
- **RGPD** : consentement, **export** et **suppression/anonymisation** des données.
- **18+** : vérification d'âge à l'inscription, signalement des mineurs.

---

## 🎨 Design system

Palette premium **corail/rose + accents violets**, thème **clair/sombre** automatique,
typographies Inter/Poppins, coins arrondis, ombres douces, micro‑interactions
(swipe animé, bulles de chat animées, indicateur de frappe, waveform vocale),
**entièrement responsive** (mobile‑first avec barre de navigation basse). Tokens dans
`public/assets/css/tokens.css`.

---

## 🔌 API REST interne (extrait)

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/discover` | Fil de découverte filtré |
| POST | `/api/swipe` | Like / pass / superlike (+ détection de match) |
| GET/POST | `/api/conversations/{id}/messages` | Historique / envoi de message |
| POST | `/api/conversations/{id}/voice` | Message vocal |
| POST | `/api/calls` · `/api/calls/{id}/status` | Cycle de vie d'un appel |
| GET | `/api/webrtc/config` | Serveurs ICE (STUN/TURN) |
| GET/POST | `/api/feed` · `/api/posts` | Mur d'actualité |
| GET/POST | `/api/stories` | Statuts éphémères |
| GET | `/api/ws-ticket` | Ticket d'authentification WebSocket |
| POST | `/webhooks/{gateway}` | Webhooks de paiement (vérifiés serveur) |

---

## 🖥️ Production (recommandations)

- Servez `public/` uniquement ; PHP‑FPM + Nginx.
- Terminez le WebSocket en **wss://** derrière Nginx (`proxy_pass` vers `WS_PORT`).
- Déployez **coturn** (TURN) pour les appels derrière NAT symétrique.
- `APP_ENV=production`, `APP_DEBUG=false`, HTTPS obligatoire.
- Purge périodique des statuts expirés (`Story::purgeExpired`) via cron.
