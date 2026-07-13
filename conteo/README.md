# CONTEO — Contes africains illustrés & narrés (2–7 ans)

Application multiplateforme de contes du patrimoine africain, illustrés et
narrés, avec **adaptation automatique du contenu selon l'âge** (3 niveaux de
lecture). Marché cible : **Côte d'Ivoire / Afrique de l'Ouest francophone**.
Interface en **français**, devise **FCFA**.

- **Frontend** : HTML5 / CSS3 / JavaScript **vanilla** (modules ES natifs) — *aucun framework*.
- **Backend** : PHP 8.2+ **MVC pur** (PDO) — *aucun framework*.
- **Base de données** : MySQL 8.
- **Offline intégral** : Service Worker + Cache API + IndexedDB.
- **Multiplateforme** : PWA (cœur) + **Capacitor** (Android/iOS) + **Tauri** (desktop).
- **Paiement** : CinetPay & PayDunya (Wave, Orange Money, MTN MoMo, Moov Money) avec **re-vérification serveur-à-serveur systématique**.

---

## 1. Prérequis

| Outil | Version |
|---|---|
| PHP | ≥ 8.2 (extensions `pdo_mysql`, `curl`, `gd` pour les icônes) |
| MySQL | ≥ 8.0 |
| Node.js | ≥ 18 (uniquement pour les builds Capacitor / Tauri) |
| Rust + Cargo | pour Tauri (desktop) |

---

## 2. Installation (développement)

```bash
# 1. Configuration
cp .env.example .env
#   → renseignez DB_*, APP_KEY (chaîne aléatoire longue), et les clés de paiement.

# 2. Base de données
mysql -u root -p -e "CREATE DATABASE conteo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
php database/seeds/run.php migrate     # applique database/migrations/*.sql
php database/seeds/run.php seed        # données de démo (conte + admin)

# 3. Assets de démonstration (SVG placeholders viewables)
php database/seeds/gen_demo_assets.php

# 4. Lancer le serveur de développement
php -S 127.0.0.1:8000 -t public public/router.php
#   → http://127.0.0.1:8000            (application enfant/parent)
#   → http://127.0.0.1:8000/admin      (back-office)
```

> `public/router.php` reproduit le comportement du `.htaccess` Apache pour le
> serveur intégré de PHP. En production, servez le dossier `public/` avec
> Apache (le `.htaccess` fourni gère la réécriture) ou Nginx.

### Compte administrateur de démonstration

| Téléphone | Mot de passe |
|---|---|
| `+2250700000000` | `conteo-admin` |

*(à changer / supprimer en production.)*

---

## 3. Configuration `.env`

Voir [`.env.example`](.env.example) — chaque variable est documentée. Points clés :

- `APP_KEY` : secret long et aléatoire (signature/dérivation).
- `DB_*` : connexion MySQL.
- `CDN_BASE_URL` : préfixe des médias (images `.webp/.avif`, audio `.opus`). Vide en local (les médias sont servis depuis `public/`).
- `CINETPAY_*` / `PAYDUNYA_*` : clés API **et** `*_WEBHOOK_IPS` (whitelist des IP de webhook — **obligatoire en production**).
- `SMS_PROVIDER=log` en développement : les OTP sont écrits dans `storage/logs/`.

---

## 4. Architecture

```
conteo/
├── public/            # Racine web : front controller, PWA (SW, manifest), assets, médias
│   ├── index.php      # Front controller unique
│   ├── router.php     # Routeur du serveur PHP intégré (dev)
│   ├── sw.js          # Service Worker (offline, écrit à la main)
│   ├── manifest.json  # Manifest PWA
│   └── assets/        # css/ (tokens, base, kid, parent) · js/ (core, audio, offline, views)
├── app/
│   ├── Core/          # Router, Controller, Model, Database (PDO), Request, Response, Validator
│   ├── Helpers/       # Auth (Bearer), Csrf, RateLimit, Sanitize, Logger
│   ├── Controllers/   # Api/* (REST) + Admin/* (back-office)
│   ├── Models/        # User, ChildProfile, Tale, Pack, Payment, ...
│   ├── Services/      # CinetPay, PayDunya, Entitlement, Manifest, Sms
│   └── Views/admin/   # Vues PHP du back-office
├── config/            # config.php (.env) · routes.php
├── database/          # migrations/ · seeds/
└── schema.sql         # Schéma complet (copie de la migration)
```

### API REST — `/api/v1`

Authentification **stateless** par Bearer token (table `api_tokens`, SHA-256 stocké).

```
POST   /auth/register  · /auth/verify-otp · /auth/login · /auth/logout · GET /auth/me · DELETE /auth/me
GET/POST/PATCH/DELETE  /profiles[/{id}]
GET    /tales?level=N2&lang=fr · GET /tales/{slug}
GET    /packs · GET /packs/{slug}/download
POST   /progress · GET /progress/{child_id} · POST /screen-time
GET    /plans · POST /payments/initiate · GET /payments/{reference}
POST   /webhooks/cinetpay · /webhooks/paydunya   (whitelist IP + re-vérification)
```

**Contrôle d'accès (anti-IDOR)** : toute route manipulant un `child_id`,
`profile_id` ou `payment_id` vérifie l'appartenance à l'utilisateur authentifié
avant lecture/écriture.

---

## 5. Contenu & niveaux

Un même conte existe en **3 niveaux de lecture** (pas 3 contes) :

| Niveau | Âge | Format |
|---|---|---|
| **N1 — Découverte** | 2–3 ans | Imagier animé, 1 phrase/écran, tap → son + mot |
| **N2 — Éveil** | 4–5 ans | Conte court, narration + surlignage mot-à-mot, mini-jeux |
| **N3 — Autonomie** | 6–7 ans | Conte complet + morale, quiz, enregistrement vocal (local) |

Le niveau est **calculé automatiquement** depuis l'âge du profil, et reste
**surchargeable** par le parent.

Un conte de démonstration complet est fourni :
`public/media/tales/kacou-baobab/` — 3 niveaux, français, manifests + timings
(surlignage karaoké) + hotspots (tap-to-explore) + mini-jeux.

Format des manifests et des timings : voir les fichiers `manifest.json` et
`timings.fr.json` du conte de démo.

---

## 6. Mode hors-ligne

- **Shell app** : précaché à l'install (cache-first).
- **Manifests** : stale-while-revalidate.
- **Médias de packs** : caches nommés `conteo-pack-{id}` (suppression sélective).
- **Progression / temps d'écran / droits** : IndexedDB, avec **file de synchronisation différée** (`sync_queue`) rejouée au retour de connexion (last-write-wins).
- **Enregistrements vocaux** : IndexedDB (Blob), **jamais envoyés au serveur**.

Téléchargement d'un pack : `navigator.storage.estimate()` (espace) →
`navigator.storage.persist()` → `cache.put()` par asset avec barre de progression.

---

## 7. Paiement — sécurité

> **Aucune action financière n'est déclenchée par le simple callback d'un
> fournisseur.** Chaque webhook **re-vérifie** la transaction en appelant l'API
> du fournisseur (`checkPayStatus` CinetPay / `confirm` PayDunya) avec la
> référence, et ne crédite (`payments.verified_at`) qu'après confirmation
> serveur-à-serveur du statut `SUCCESS` **et** du montant attendu.

Voir `App\Controllers\Api\WebhookController` et les services de paiement.

---

## 8. Builds multiplateformes

### PWA
Installable directement depuis le navigateur (`beforeinstallprompt`). Aucune
étape de build : servez `public/`.

### Android / iOS — Capacitor
```bash
npm install
npx cap init Conteo ci.conteo.app --web-dir=public   # (config déjà fournie : capacitor.config.json)
npx cap add android
npx cap add ios
npx cap sync
```
Plugins requis : `@capacitor/filesystem`, `@capacitor/preferences`,
`@capacitor-community/native-audio` (audio en arrière-plan — mode conte du soir),
`@capacitor/screen-orientation`, `@capacitor/app`.

> **iOS** : l'audio HTML5 exige une interaction utilisateur et le Web Audio API
> se suspend en arrière-plan — d'où le wrapper natif pour le mode conte du soir.

### Desktop — Tauri
```bash
npm install
npx tauri dev        # développement (config : src-tauri/tauri.conf.json)
npx tauri build      # binaires .deb / .appimage / .msi / .dmg
```

---

## 9. Sécurité & conformité

- Mots de passe : `PASSWORD_ARGON2ID`.
- **100 % requêtes préparées PDO**.
- Échappement en sortie : `htmlspecialchars` (PHP), `textContent` (JS — jamais `innerHTML` avec données utilisateur).
- **CSRF** sur les formulaires admin, **rate limiting** sur `/auth/*` et `/payments/initiate`.
- Webhooks : **whitelist IP** + re-vérification serveur-à-serveur.
- **Aucune donnée sensible d'enfant** transmise (prénom + âge uniquement) ; voix en local ; zéro tracking, zéro pub, zéro lien externe côté enfant.
- COPPA/RGPD : consentement parental à l'inscription, `DELETE /auth/me` (suppression en cascade).

---

## 10. Vérifications rapides

```bash
# Lint PHP
find app config public -name '*.php' -exec php -l {} \;

# Lint JS
find public/assets/js -name '*.js' -exec node --check {} \;
```
