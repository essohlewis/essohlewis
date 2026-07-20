# Backend Node.js (Express) — Espace client en base + vérification d'identité

Backend de Marché CI. Il apporte deux briques, sans toucher à la marketplace
front (servie telle quelle) :

1. **Espace client persisté en base de données SQLite** : comptes clients,
   catalogue produits, panier et **commandes** (achats, paiement à la livraison).
2. **Vérification d'identité des vendeurs** : pièce + selfie en direct,
   **reconnaissance faciale** et **détection de vivacité** automatiques, avec un
   back-office de revue **stylé Tailwind CSS**.

La base client utilise le module **SQLite intégré à Node.js** (`node:sqlite`) :
aucune dépendance à installer, aucun service externe — juste un fichier
`data/marche.db`. Le front bascule automatiquement dessus quand le serveur est
présent (écriture des inscriptions et commandes en base) ; en `file://`, tout
reste en localStorage.

## Prérequis
- **Node.js 18+** (testé sur Node 22).
- Pour la reconnaissance faciale **automatique** : **Python 3** avec
  `face_recognition` (dlib). Sans lui, tout fonctionne mais la comparaison des
  visages devient une **décision manuelle de l'administrateur**.
  ```bash
  pip install face_recognition face_recognition_models dlib Pillow numpy
  ```

## Installation & lancement
```bash
cd server
npm install
npm run build:css      # compile Tailwind → public/tailwind.css (déjà fourni)
npm start              # démarre sur http://localhost:3000
```
Ouvrez ensuite :
- **Marketplace** : http://localhost:3000/
- **Vérification vendeur** (page Tailwind) : http://localhost:3000/verify
- **Revue admin** (page Tailwind) : http://localhost:3000/admin/kyc
  (jeton par défaut `admin-demo-token`, modifiable via `KYC_ADMIN_TOKEN`)

Le front détecte automatiquement le serveur : le bouton « Vérifier mon
identité » du vendeur ouvre alors la page `/verify`, et l'onglet Sécurité de
l'admin propose un lien vers `/admin/kyc`. Sans serveur (ouverture `file://`),
la vérification retombe sur le mode 100 % local (localStorage).

## Pile technique
- **Express** : API + service statique (marketplace + pages Tailwind).
- **Tailwind CSS** (`src/input.css` → `public/tailwind.css`) : nouvelles pages.
- **Reconnaissance faciale** : `face.js` délègue à `face_match.py`
  (dlib/ResNet, embeddings 128-D, modèles fournis par PyPI — aucun CDN).
- **Détection de vivacité (anti-photo)** : `face.js` délègue à `liveness.py`
  (68 repères dlib). Le vendeur capture une **rafale** pendant qu'il cligne des
  yeux et bouge la tête ; on mesure le clignement (Eye Aspect Ratio) et le
  mouvement du visage. Une photo imprimée ou un écran figé **échoue** au test.
- **Stockage** : fichier JSON (`data/kyc.json`) + images sur disque
  (`data/uploads/`, ignorés par Git).

## Endpoints (`/api/kyc/…`)
| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET | `/health` | public | État du service + reconnaissance faciale + vivacité |
| POST | `/liveness` | vendeur | rafale d'images → présence en direct (anti-photo) |
| POST | `/submit` | vendeur | pièce + selfie (+ rafale) → comparaison + vivacité + statut `pending` |
| GET | `/status?vendorId=` | vendeur | statut d'un vendeur |
| GET | `/list?status=` | admin | file des vérifications |
| POST | `/review` | admin | `approve` / `reject` (+ motif) |
| GET | `/image/:id/:kind` | admin | sert une image (`id`/`selfie`) |

## API de l'espace client (`/api/shop/…`) — base SQLite
| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | `/health` | public | État de la base + nombre de produits |
| POST | `/register` | public | Création de compte client → jeton de session |
| POST | `/login` | public | Connexion → jeton de session |
| POST | `/logout` | client | Fin de session |
| GET | `/me` | client | Profil du client connecté |
| GET | `/products` | public | Catalogue (`?category=`, `?q=`, `?storeId=`) |
| GET | `/products/:id` | public | Détail d'un produit |
| POST | `/products` | admin | Ajout / mise à jour de produit(s) |
| GET / PUT | `/cart` | client | Panier du client |
| POST | `/orders` | client/invité | **Passer commande** (total recalculé serveur) |
| GET | `/orders` | client | Mes commandes |
| GET | `/orders/:id` | client | Détail d'une commande |
| GET | `/admin/orders` | admin | Toutes les commandes |
| POST | `/admin/orders/:id/status` | admin | Change le statut (pending→…→delivered) |
| GET | `/admin/stats` | admin | Comptes, produits, commandes, chiffre d'affaires |

**Tables SQLite** : `users`, `products`, `carts`, `orders`, `order_items`,
`sessions`, `reviews`, `stores`, `payments`, `documents`. Mots de passe hachés
(scrypt + sel). Le **total de commande est toujours recalculé côté serveur** à
partir du catalogue (sécurité anti-fraude) ; le stock est décrémenté et le
panier vidé dans une transaction.

### Paiement (mobile money / carte) — `payments.js`
Architecture **enfichable** : chaque moyen (Orange Money, MTN MoMo, Moov Money,
Wave, carte) est un adaptateur. Sans clés d'API, tout bascule sur un
**simulateur** qui reproduit le déroulé réel (initiation → référence +
instructions USSD/appli → confirmation par « J'ai payé » / webhook). Endpoints :
`GET /payments/methods`, `POST /payments/initiate`, `POST /payments/:id/confirm`,
`POST /payments/webhook/:provider`, `GET /payments/:id`, `GET /admin/payments`.
Un paiement encaissé **confirme automatiquement** la commande. Page vendeur
client : `/paiement`. **Production** : renseignez `CINETPAY_API_KEY` (ou
`PAYSTACK_SECRET_KEY`) et implémentez l'appel réel dans `payments.initiate/verify`
— le reste de l'application ne change pas.

### Comptes & sécurité (domaine B)
- **Jetons** : jeton d'accès à durée de vie (`SESSION_TTL`, défaut 7 j) + jeton
  de **rafraîchissement** (`REFRESH_TTL`, 30 j) à usage unique (rotation).
  `POST /refresh`, `POST /logout`, `POST /logout-all`, `GET /sessions`.
- **Réinitialisation de mot de passe** : `POST /password/forgot` → code à usage
  unique ; `POST /password/reset` (révoque toutes les sessions) ;
  `POST /password/change` (connecté). Page publique `/mot-de-passe`.
- **Vérification e-mail** : code à l'inscription ; `POST /verify/email`,
  `POST /verify/email/resend`. Statut exposé dans `GET /me`.
- **2FA (TOTP)** : `POST /2fa/setup` (secret + URI otpauth), `POST /2fa/enable`,
  `POST /2fa/disable` ; connexion en 2 étapes (`/login` → `twofaRequired` →
  `/login/2fa`). Compatible Google Authenticator/Authy (`totp.js`, sans dépendance).
- **Envoi e-mail/SMS** : simulateur tant qu'aucun fournisseur n'est configuré
  (le code est renvoyé dans la réponse `devCode`). Production : définir
  `EMAIL_PROVIDER`/`SMS_PROVIDER` et brancher l'envoi réel.
- Page compte : `/securite` (vérification, mot de passe, 2FA, sessions).
- **Rôles (RBAC)** : `client` / `vendeur` / `admin` appliqués par endpoint
  (`requireRole`). Devenir vendeur = créer une boutique ; admin = jeton
  d'administration **ou** compte de rôle admin (liste `ADMIN_EMAILS`).
- **Sessions multi‑appareils** : `GET /sessions`, révocation d'un appareil
  précis (`POST /sessions/:id/revoke`) et globale (`/logout-all`).
- **Connexion par OTP téléphone** : `POST /login/otp/request` + `/verify`
  (SMS simulé — adapté au marché ivoirien).
- **Connexion biométrique** : `POST /api/shop/login/face` compare un selfie au
  visage KYC de référence du compte (nécessite la reconnaissance faciale).

### Escrow, commission & retraits vendeurs
La part vendeur d'une commande est **séquestrée** (escrow) tant que la commande
n'est pas **livrée** ; à la livraison, elle est **libérée** dans le portefeuille
du vendeur, déduction faite de la **commission plateforme** (`COMMISSION_RATE`,
défaut 10 %). Le vendeur voit `escrow / disponible / retiré / commission` sur
`/mes-ventes` et **demande un retrait** ; l'administrateur valide (payé/refusé)
dans l'onglet **Retraits**. Endpoints : `GET /vendor/wallet`,
`POST /vendor/payouts`, `GET /admin/payouts`, `POST /admin/payouts/:id/status`.

### Base de données : migrations, pagination & sauvegardes (domaine A)
- **Catalogue = source unique** (`../shared/catalogue.js`) : un **référentiel
  produits partagé** (module UMD) alimente à la fois le front
  (`window.MP.Catalogue`, via `<script>`) **et** le serveur
  (`require("../shared/catalogue")`). Le `seed.js` du front comme celui du
  serveur en **dérivent** : mêmes identifiants (`prd_1`…`prd_16`), mêmes
  boutiques (`sto_1`…`sto_4`), mêmes prix. Fini les deux catalogues divergents.
  Le serveur y stocke le **prix effectif** (promo si active) pour que le total
  recalculé côté serveur corresponde à ce que le client paie côté front.
- **Migrations versionnées** (`migrations.js`) : table `schema_migrations` +
  runner appliqué automatiquement au démarrage (`shopdb.init`). Chaque migration
  a un numéro et s'exécute **une seule fois**, dans une transaction. Fini les
  `ALTER` ad hoc : le schéma est reproductible sur toute base.
  `GET /admin/schema` expose la version courante et la liste des migrations.
- **Pagination** de toutes les listes : `?limit=` (1–500, défaut 50) et
  `?offset=`. La réponse contient `{ items, total, limit, offset, hasMore }`.
  Appliquée à `/products`, `/reviews`, `/admin/orders`, `/admin/stores`,
  `/admin/payments`, `/admin/transactions` (la synthèse `reconciliation` est
  conservée en plus des `items` paginés).
- **Sauvegarde & restauration** (admin) : `GET /admin/backup` exporte toute la
  base en JSON (toutes les tables + `schemaVersion`) ; `POST /admin/restore`
  remplace intégralement le contenu des tables dans une transaction
  (`ROLLBACK` en cas d'erreur, base intacte). À archiver hors ligne.
- **Versionnement de l'API** : le chemin **canonique est `/api/v1`** (ex.
  `/api/v1/shop/products`, `/api/v1/kyc/health`). Une réécriture en amont mappe
  `/api/v1/*` → `/api/*`, si bien que **`/api/*` reste un alias rétro-compatible**
  (le front actuel et les intégrations en place continuent de fonctionner sans
  changement). Les futures ruptures se feront sur `/api/v2` sans casser v1.
- **Documentation OpenAPI/Swagger** : contrat **OpenAPI 3.0** généré sans
  dépendance (`openapi.js`), servi en JSON sur `GET /api/openapi.json` et rendu
  par une **page navigable** `/api/docs` (renderer autonome, sans CDN, conforme
  à la CSP stricte). Recherche/filtre, regroupement par domaine, schémas de
  sécurité (session `Bearer` + `X-Admin-Token`) documentés.
- **Journalisation structurée** (`logger.js`, sans dépendance) : logs à
  **niveaux** (`debug`/`info`/`warn`/`error`, filtrés par `LOG_LEVEL`), au
  format **JSON une ligne** (`LOG_FORMAT=json`, défaut en production —
  exploitable par Loki/ELK/CloudWatch) ou **lisible** en dev. **Corrélation** :
  chaque requête reçoit un `X-Request-Id` (repris de l'appelant s'il en fournit
  un valide, sinon généré) renvoyé dans la réponse et **injecté
  automatiquement** dans tous les logs de l'appel (via `AsyncLocalStorage`).
  Un log d'**accès HTTP** par requête (méthode, route, statut, durée, IP).
- **Middleware d'erreurs & format uniforme** : gestionnaire terminal renvoyant
  `{ ok:false, error, requestId }` avec le bon code HTTP, et **journalisant**
  l'erreur (message + pile) corrélée au `requestId` — l'utilisateur ne voit
  jamais de pile, mais le support relie le ticket au log par l'identifiant.
  Variables : `LOG_LEVEL` (défaut `info`), `LOG_FORMAT` (`json`/`pretty`).

### Questions / réponses produit en base (domaine H)
Q&R **partagées et persistées** (table `product_questions`), branchées sur la
fiche produit du front :
- `POST /questions` (client connecté) pose une question ; `GET /questions?productId=`
  liste les questions **visibles** (public, paginé) ; `POST /questions/:id/answer`
  réservé au **vendeur propriétaire** de la boutique (ou admin, sinon **403**).
- **Modération** : `GET /admin/questions`, `POST /admin/questions/:id/status`
  (`visible`/`hidden`).
- **Front** : panneau « Questions en ligne (base de données) » en tête de la
  section Q&R ; l'envoi d'une question est **écrit en base** (write‑through) et
  le vendeur peut répondre depuis la fiche. Dégradation propre sans backend.

### Programme de fidélité / points (domaine G)
Points **réels et dépensables**, source de vérité serveur (table
`loyalty_ledger`, journal signé earn/redeem) :
- **Gain à la livraison** : quand l'admin passe une commande à `delivered`, le
  client est crédité de `floor(itemsTotal × LOYALTY_EARN_RATE)` points
  (défaut **1 pt / 100 FCFA**), **idempotent** par commande (pas de double
  crédit) + notification push.
- **Dépense au paiement** : `POST /orders` accepte `redeemPoints` ; le serveur
  plafonne au **solde** et au **sous-total**, convertit en remise
  (`LOYALTY_REDEEM_VALUE`, défaut **1 pt = 5 FCFA**) et débite le journal — le
  tout dans la transaction de commande.
- **Consultation** : `GET /loyalty` (solde, règles, journal) ; `GET /me` expose
  `loyaltyPoints`. Le front affiche une carte **« Mes points à dépenser »** dans
  le profil (solde + valeur + journal), distincte du niveau de fidélité local.

Variables : `LOYALTY_EARN_RATE` (points/FCFA), `LOYALTY_REDEEM_VALUE` (FCFA/point).

### Notifications push web (domaine G) — `webpush.js`
Implémentation **complète et sans dépendance** du protocole Web Push :
- **VAPID** (RFC 8292) : JWT **ES256** signé avec la clé privée du serveur.
- **Chiffrement de charge utile** (RFC 8291, `aes128gcm`) : ECDH P‑256 +
  HKDF‑SHA256 → CEK/nonce, AES‑128‑GCM (round‑trip validé par test).
- **Service Worker** (`sw.js`) : événements `push` (affiche la notification) et
  `notificationclick` (focalise/ouvre la bonne page).
- **Front** (`js/push.js`, `MP.Push`) : permission, abonnement `PushManager`,
  enregistrement serveur ; encart d'activation dans la page **Notifications**.
- **Serveur** : `GET /push/vapidPublicKey`, `POST /push/subscribe`,
  `POST /push/unsubscribe`, `POST /push/test`. Un **changement de statut de
  commande** déclenche un **rappel** push au client abonné. Abonnements stockés
  par appareil (table `push_subs`) ; les endpoints expirés (404/410) sont purgés.

**Production** : définissez des clés VAPID **persistantes**
(`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`, générables via
`node -e "console.log(require('./webpush').generateVapidKeys())"`) et
`VAPID_SUBJECT` (mailto:…). La **livraison réelle** requiert HTTPS et un accès
réseau au service de push du navigateur (FCM/Mozilla/…) ; sans cela, le serveur
chiffre et signe correctement mais l'envoi échoue proprement (journalisé).

## Résultats de référence (validés)
- Reconnaissance faciale : même personne → `match:true`, score ~87 ;
  personnes différentes → `match:false`, score ~19 ; absence de visage → rejet.
- Vivacité : rafale figée (photo/écran) → `live:false` ; visage qui cligne des
  yeux / bouge → `live:true`. La page vendeur **bloque** la suite tant que la
  présence n'est pas confirmée.

## Durcissement production (`security.js`)
Middlewares Express **sans dépendance** activés automatiquement :
- **En-têtes de sécurité** : CSP, HSTS (sur HTTPS), `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`,
  `Cross-Origin-Opener-Policy`. `X-Powered-By` masqué.
- **CORS restreint** : autorise uniquement les origines de `ALLOWED_ORIGINS`
  (liste séparée par des virgules) ; préflight `OPTIONS` géré.
- **Anti-CSRF** : l'API s'authentifie par jeton d'en-tête (non-cookie, donc non
  vulnérable au CSRF classique) ; en défense en profondeur, toute requête
  mutante d'une origine connue mais non autorisée est refusée (403).
- **Limitation de débit** (en mémoire) : global sur `/api` (`RATE_MAX_API`,
  défaut 600/min) + limites renforcées sur `login`/`register` (`RATE_MAX_AUTH`,
  défaut 30/min), `payments/initiate` (60/min) et `kyc/submit` (15/min).
- **HTTPS** : `FORCE_HTTPS=1` redirige HTTP→HTTPS derrière un proxy TLS
  (`X-Forwarded-Proto`). En production, terminez le TLS au reverse-proxy et
  définissez un `KYC_ADMIN_TOKEN` fort.

Variables : `ALLOWED_ORIGINS`, `FORCE_HTTPS`, `CSP_REPORT_ONLY`, `RATE_MAX_API`,
`RATE_MAX_AUTH`, `KYC_ADMIN_TOKEN`, `NODE_ENV=production`.

## Sécurité / production
- Servez en **HTTPS**, changez `KYC_ADMIN_TOKEN`, restreignez le CORS.
- **Chiffrez** et **purgez** les pièces d'identité après décision (RGPD).
- La détection de vivacité incluse est **active** (défi-réponse) : elle stoppe
  les photos et captures d'écran. Pour un usage à fort risque, ajoutez en plus
  un modèle **anti-deepfake vidéo** (texture / rPPG) côté serveur.
