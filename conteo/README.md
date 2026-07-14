# Conteo — Contes africains illustrés & narrés (2–7 ans)

Application multiplateforme de **contes africains** illustrés avec narration audio,
pour les enfants de **2 à 7 ans**, avec adaptation automatique du contenu selon l'âge.

- **Marché cible** : Côte d'Ivoire / Afrique de l'Ouest francophone
- **Devise** : FCFA · **Langue d'interface** : français
- **Stack** : HTML5 + CSS3 + JavaScript vanilla (ES6+) — **zéro dépendance runtime**
- **Hors-ligne intégral**, **aucun backend**, **aucun traçage**, **aucune publicité**

> Toutes les données restent sur l'appareil (IndexedDB + Cache API). Il n'y a
> aucun compte serveur, aucune analytics, aucun SDK tiers. La vie privée est un
> **argument produit**, pas une option.

---

## Sommaire

- [Démarrage rapide](#démarrage-rapide)
- [Architecture](#architecture)
- [Structure du projet](#structure-du-projet)
- [Le contenu : catalogue & contes](#le-contenu--catalogue--contes)
- [Ajouter un nouveau conte](#ajouter-un-nouveau-conte)
- [Segmentation par âge (N1/N2/N3)](#segmentation-par-âge)
- [Monétisation sans backend](#monétisation-sans-backend)
- [Générer des codes d'activation](#générer-des-codes-dactivation)
- [Builds multiplateformes](#builds-multiplateformes)
- [Vie privée & sécurité](#vie-privée--sécurité)

---

## Démarrage rapide

Le projet est **entièrement statique**. Aucun build n'est nécessaire pour le
développement — il suffit de servir le dossier sur HTTP (les modules ES et le
Service Worker exigent `http(s)://`, pas `file://`).

```bash
cd conteo

# Au choix :
python3 -m http.server 5173      # puis http://localhost:5173
# ou
npx --yes serve -l 5173 .
```

Ouvrir <http://localhost:5173>. Au premier lancement : taper l'écran d'accueil →
créer un profil enfant dans l'espace parent (verrou arithmétique) → choisir le
profil → lire un conte.

> ⚠️ Les médias (images `.webp`/`.avif`, audio `.opus`/`.m4a`) ne sont **pas**
> versionnés dans ce dépôt : ils sont servis par CDN en production. En
> développement, l'app reste **pleinement utilisable** sans eux :
> - **narration de repli par synthèse vocale** (Web Speech API) quand l'audio
>   enregistré est absent — le conte est réellement lu à voix haute, avec
>   surlignage karaoké synchronisé ;
> - **prononciation des hotspots** par synthèse vocale à défaut du mot enregistré ;
> - **sons de repli synthétiques** (Web Audio) et **dégradés visuels** pour les images.

---

## Architecture

```
CODE SOURCE UNIQUE (statique, HTML/CSS/JS vanilla)
        │
   ┌────┼──────────┬──────────────┬───────────┐
  PWA  Capacitor  Capacitor      Tauri
  Web   Android      iOS         Desktop
        (.apk)      (.ipa)        (.exe)
        │
   Hébergement statique (Cloudflare Pages / Netlify / GitHub Pages)
   Médias sur CDN (Cloudflare R2 / Bunny.net)
```

Tout est écrit **à la main**, sans framework :

| Couche | Implémentation |
|---|---|
| Routage SPA | `core/router.js` — History API (~90 lignes) |
| État global | `core/store.js` — Proxy réactif (~50 lignes) |
| Persistance | `core/db.js` — wrapper IndexedDB promisifié |
| Narration + karaoké | `audio/narrator.js` — `<audio>` + `requestAnimationFrame` + **recherche dichotomique** ; repli **synthèse vocale** (`audio/speech.js`) si l'audio enregistré manque |
| Effets sonores | `audio/sfx.js` — Web Audio API (buffers préchargés) |
| Enregistrement voix | `audio/recorder.js` — MediaRecorder → IndexedDB (jamais transmis) |
| Hotspots | `views/kid/hotspots.js` — overlay de `<button>` en % (coords normalisées) |
| Offline | `sw.js` + `offline/*` — Service Worker écrit à la main, caches nommés par pack |
| Graphiques parent | `views/parent/chart.js` — Canvas 2D (sans bibliothèque) |
| Codes d'activation | `billing/codes.js` — vérification HMAC-SHA256 côté client |

---

## Structure du projet

```
conteo/
├── index.html              # Shell SPA unique (+ CSP stricte)
├── manifest.json           # Manifest PWA
├── sw.js                   # Service Worker (offline, caches par pack)
├── offline.html            # Page de repli
├── assets/
│   ├── css/                # tokens, base, components, kid, reader, games, parent
│   ├── js/
│   │   ├── main.js         # Point d'entrée (type="module")
│   │   ├── core/           # router, store, db, dom, i18n
│   │   ├── content/        # catalog, manifest, level (calcul d'âge)
│   │   ├── audio/          # narrator, sfx, recorder, unlock (iOS)
│   │   ├── offline/        # downloader, cache, storage
│   │   ├── billing/        # iap, codes, entitlements
│   │   ├── views/kid/      # splash, pick-profile, library, reader, hotspots, games, bedtime, my-stories
│   │   ├── views/parent/   # gate, dashboard, chart, profiles, downloads, store, backup, settings
│   │   └── utils/          # format (FCFA), screen-time, a11y
│   ├── fonts/              # Baloo 2, Inter (.woff2 auto-hébergés)
│   └── icons/              # favicon.svg (+ PNG à exporter, voir icons/README.md)
├── data/                   # CONTENU STATIQUE (versionné)
│   ├── catalog.json
│   └── tales/<slug>/       # n1.json, n2.json, n3.json + <level>/<lang>.timings.json
├── media/                  # Servi par CDN en prod (non versionné)
├── tools/generate-codes.js # Générateur de codes d'activation (hors-ligne)
├── capacitor.config.json
├── src-tauri/tauri.conf.json
├── package.json            # scripts + deps NATIVES uniquement (aucune runtime web)
└── docs/CONTENT.md         # Guide de production de contenu
```

---

## Le contenu : catalogue & contes

Aucune base de données. Tout le contenu est du **JSON statique**.

- **`data/catalog.json`** — index global : langues, packs, contes (+ durées et
  chemins des manifests par niveau).
- **`data/tales/<slug>/<niveau>.json`** — manifest d'un conte pour un niveau :
  pages, illustrations, textes, hotspots, jeux, liste `assets` à mettre en cache.
- **`data/tales/<slug>/<niveau>/<lang>.timings.json`** — timings mot-à-mot pour
  le surlignage karaoké (générés par forced alignment, voir `docs/CONTENT.md`).

Un conte de démonstration complet est fourni : **`kacou-baobab`** (3 niveaux,
français, avec timings, hotspots et jeux). Un second conte (`leuk-et-bouki`)
illustre un contenu plus léger (N1 + N2).

> Les contes traditionnels sont dans le domaine public, mais **chaque adaptation
> écrite doit être une œuvre originale**. Les textes fournis sont des rédactions
> originales — ne jamais copier une édition existante.

---

## Ajouter un nouveau conte

1. **Choisir un `slug`** (ex. `la-tortue-rusee`) et l'ajouter à `data/catalog.json` :
   dans `tales[]` (avec `levels` et `pack_id`) et dans le `packs[].tales` du pack concerné.

2. **Créer les manifests** `data/tales/<slug>/n1.json`, `n2.json`, `n3.json`
   (voir le format dans `kacou-baobab/n2.json`). Champs clés :
   - `pages[]` : `index`, `image`, `text`, `hotspots[]`
   - `hotspots[]` : `shape` (`circle`|`rect`), coordonnées **normalisées 0→1**,
     `label`, `sfx`, `voice` (par langue), `animation` (`shake`|`fly`|`pop`)
   - `games[]` : `find_animal`, `order_images`, `quiz`
   - `assets[]` : **toutes** les URLs à mettre en cache pour l'offline

3. **Produire les médias** (`media/tales/<slug>/...`) et les **timings**
   (`data/tales/<slug>/<niveau>/<lang>.timings.json`). Voir `docs/CONTENT.md`.

4. **Vérifier** : le conte apparaît automatiquement dans la bibliothèque des
   profils dont le niveau correspond, et peut être téléchargé depuis l'espace parent.

Aucune recompilation : le catalogue est rechargé au démarrage.

---

## Segmentation par âge

Un même conte existe en **3 niveaux de lecture** (pas 3 contes différents) :

| Niveau | Âge | Format | Interaction |
|---|---|---|---|
| **N1 — Découverte** | 2–3 ans | Imagier, 1 phrase/écran, texte masqué | Tap objet → son + mot |
| **N2 — Éveil** | 4–5 ans | Conte court + karaoké mot-à-mot | Mini-jeux |
| **N3 — Autonomie** | 6–7 ans | Conte complet + morale | Quiz + enregistrement voix |

Le niveau est **calculé depuis la date de naissance** (`content/level.js`) et
**surchargeable** manuellement par le parent (`level_locked`).

---

## Monétisation sans backend

Un paiement Mobile Money (Wave, Orange/MTN/Moov Money) **exige un serveur** pour
valider le webhook du fournisseur. Sans backend, deux voies viables cohabitent :

- **A — Achat in-app natif** (`billing/iap.js`) via Google Play / App Store.
  Google Play accepte Orange Money / MTN MoMo en Côte d'Ivoire. Reçu stocké dans
  IndexedDB et **revalidé au lancement**. Commission store 15–30 %.
- **B — Codes d'activation** (`billing/codes.js`) : vendus physiquement
  (boutiques, écoles, cybercafés), validés **entièrement côté client** par HMAC.
  Zéro commission. Compromis assumé : réutilisables sur plusieurs appareils
  (atténué par lots limités et rotation de clé par version).

Catalogue **freemium** : contes gratuits en français, packs premium à **2 000 FCFA**.

---

## Générer des codes d'activation

Outil **hors-ligne**, jamais embarqué dans le build public :

```bash
# Générer 100 codes pour le pack "Contes de la sagesse" (code court SAGE)
node tools/generate-codes.js SAGE 100 --start 1 --out codes-sagesse.csv

# Afficher quelques codes sans fichier
node tools/generate-codes.js SAGE 3
```

Format : `CONT-SAGE-4F2A-9B71`. La clé de vérification est partagée avec
`assets/js/billing/codes.js` (`VERIFY_KEY`) — **à faire tourner à chaque version**.
Les fichiers `*.csv` de codes sont ignorés par git (voir `.gitignore`).

---

## Builds multiplateformes

### PWA (base)
Déployer le dossier `conteo/` tel quel sur Cloudflare Pages / Netlify / GitHub Pages.

### Android / iOS — Capacitor
```bash
npm install                       # deps natives (devDependencies)
npx cap init Conteo ci.conteo.app --web-dir=.
npx cap add android
npx cap add ios
npx cap sync
```
Plugins : `@capacitor/filesystem` (packs volumineux), `@capacitor/app` (pause du
compteur d'écran), `@capacitor-community/native-audio` (audio en arrière-plan —
**indispensable au mode Conte du soir sur iOS**), `@capacitor-community/in-app-purchases`.

### Desktop — Tauri
```bash
npm run tauri        # frontendDist = "../" (le dossier statique)
```

---

## Vie privée & sécurité

1. **Aucune donnée ne quitte l'appareil** : prénom, âge, progression, voix.
2. Les **enregistrements vocaux** restent en IndexedDB, sans exception.
3. **Zéro tracking, zéro analytics, zéro SDK tiers, zéro publicité.**
4. **COPPA / RGPD par conception** : il n'y a rien à collecter.
5. **CSP stricte** dans `index.html`.
6. **Jamais de `innerHTML`** avec des données utilisateur → `textContent` (voir `core/dom.js`).
7. La **sauvegarde exportée** (`views/parent/backup.js`) est en clair — l'app le signale au parent.

---

## Tests

Deux niveaux, sans dépendance runtime pour l'application :

```bash
npm test         # tests unitaires (node:test) : niveau/âge, format FCFA,
                 # recherche dichotomique du karaoké, vérification HMAC des codes
npm run test:e2e # test de fumée navigateur (Playwright) : parcours complet
                 # accueil → verrou parent → profil → bibliothèque → lecteur → karaoké
```

- `tests/unit.test.mjs` — 14 tests de fonctions pures (aucun navigateur).
- `tests/smoke.mjs` — auto-suffisant : démarre son propre serveur statique puis
  pilote Chromium. Nécessite `playwright` (devDependency) ; en CI, installer le
  navigateur avec `npx playwright install chromium`.

## PWA & installabilité

- **Manifest** complet + icônes **192 / 512 / 512-maskable** (régénérables via
  `npm run icons`).
- **Invite d'installation** (« Installer ») captée depuis `beforeinstallprompt`
  (Android/Chrome) ; sur iOS, le « Ajouter à l'écran d'accueil » de Safari reste natif.
- **Bannière hors-ligne** automatique + reprise en ligne.
- **Service Worker** : précache du shell, caches nommés par pack, offline intégral.
- **Barrière d'erreur** : une vue qui échoue affiche un écran de reprise, jamais une page blanche.
