# KORA KIDS 🌍

Jeu éducatif pour enfants de **2 à 7 ans**, ancré dans la culture ivoirienne et
ouest-africaine. PWA mobile-first, **100 % hors-ligne**, sans pub, sans compte,
sans collecte de données.

> *Le jeu éducatif où votre enfant apprend à compter en **FCFA**, reconnaît
> l'**attiéké** et l'**agouti**, et joue **sans connexion**.*

**Auteur** : Essoh Lath Lewis

---

## Lancer le jeu

Aucune installation, aucun build, aucune dépendance.

```bash
# Depuis le dossier kora-kids/, servez les fichiers via HTTP (le Service
# Worker et les modules ES nécessitent http://, pas file://) :
python3 -m http.server 8000
#   puis ouvrez http://localhost:8000
```

À la 1ʳᵉ ouverture, le Service Worker met tout en cache. Ensuite, **le jeu
fonctionne entièrement hors-ligne** et s'installe comme une application
(« Ajouter à l'écran d'accueil »).

---

## Ce qui est livré

- **Socle complet** : accueil (profils enfants), carte du village (menu),
  routeur de scènes, stockage local, audio, entrée tactile unifiée, PWA.
- **Les 6 mini-jeux** :
  1. **Sons & Animaux** — association cri ↔ image (20 animaux locaux).
  2. **Le Marché** — compter et additionner en FCFA (3 niveaux progressifs).
  3. **Alphabet Kora** — 26 lettres, un mot africain par lettre, 2 modes.
  4. **Formes & Couleurs** — encastrement, tri par couleur, intrus.
  5. **Memory Pagne** — paires, dos en motifs wax.
  6. **Puzzle Progressif** — 4 / 9 / 16 pièces, image en filigrane.
- **Espace parent verrouillé** : profils (CRUD), tableau de progression,
  réglages (volumes, mode soir, minuteur de session), réinitialisation.
- **Récompenses** : étoiles + accessoires d'avatar débloqués par paliers.
- **Manifest + Service Worker** (cache-first) + icônes maskable.

---

## Choix technique sur les médias

Le document de spécification prévoit des voix off enregistrées, des cris
d'animaux et des illustrations riches. Pour rester **sans dépendance et jouable
immédiatement hors-ligne**, cette version génère ces médias à la volée :

| Média | Implémentation actuelle | Remplacement par de vrais fichiers |
|---|---|---|
| **Voix off (français)** | `SpeechSynthesis` du navigateur (hors-ligne sur la plupart des appareils) | `Audio.speak(id)` lit automatiquement `assets/audio/voix/<id>.mp3` s'il est chargé |
| **Cris d'animaux / SFX** | Synthèse Web Audio | déposez `assets/audio/cris/<id>.mp3` et déclarez-les dans `Audio.load()` |
| **Illustrations** | SVG dessinés en code (`js/core/art.js`), colorables en CSS | remplacez les fabriques par `<img src>` vers vos SVG/WebP |

La couche audio est **déjà séparée du code** (`js/core/audio.js`) : ajouter
des voix baoulé/dioula = déposer des fichiers dans `assets/audio/voix/` et les
précharger. Aucun code de jeu à modifier.

`Audio.load([{ id, url }])` précharge les fichiers réels ; s'ils sont absents,
le moteur bascule sur la synthèse — les deux mondes coexistent.

---

## Architecture

```
index.html · manifest.json · sw.js
css/     reset · tokens · layout · components · scenes
js/
  core/  router · audio · storage · input · a11y · art
  scenes/ home · map · parent · reward
  games/  animaux · marche · alphabet · formes · memory · puzzle · shell
  data/   animaux.json · alphabet.json · marche.json · config.json
assets/  fonts/ · img/ui/ · audio/{voix,cris,sfx}/
```

- **Router** sans hash, état interne, max 2 niveaux : Accueil → Carte → Jeu.
- **`makeDraggable`** (Pointer Events + aimantation) partagé par Formes,
  Marché et Puzzle.
- **Storage** : `localStorage` versionné (migrations futures possibles).
- **Animations** en `transform`/`opacity` uniquement ; `prefers-reduced-motion`
  respecté ; le son est coupable entièrement.

### Police locale

Déposez un fichier `assets/fonts/kora.woff2` (police ronde type *Baloo 2* /
*Fredoka* / *Nunito*, **jamais via CDN**) et décommentez le `@font-face` en tête
de `css/tokens.css`. Sans fichier, l'app utilise la police système ronde par
défaut (`--font`).

---

## Règles UX respectées

Cibles ≥ 64 px (100 px pour les 2–3 ans) · voix off sur chaque consigne · zéro
échec punitif · un seul geste (tap) + le glisser · feedback < 100 ms · aucun
lien sortant · aucune collecte.

---

## Hors périmètre v1 (prévu)

Langues locales (baoulé/dioula), mode école multi-classes, déblocage payant via
Wave / Orange Money / MTN / Moov, wrapper natif (TWA / Capacitor).
```
