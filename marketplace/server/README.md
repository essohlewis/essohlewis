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
