# Guide de production de contenu — Conteo

Ce guide décrit comment produire les médias et les données d'un conte : images,
audio de narration, mots isolés des hotspots, effets sonores, et **timings**
pour le surlignage karaoké.

Tout le contenu est **statique** : aucun serveur, aucune base de données. Les
fichiers JSON vivent dans `data/`, les médias dans `media/` (servis par CDN en prod).

---

## 1. Arborescence d'un conte

```
data/tales/<slug>/
├── n1.json                     # manifest niveau Découverte (2–3 ans)
├── n2.json                     # manifest niveau Éveil (4–5 ans)
├── n3.json                     # manifest niveau Autonomie (6–7 ans)
└── n2/
    ├── fr.timings.json         # timings karaoké FR pour N2
    └── bci.timings.json        # timings karaoké Baoulé pour N2

media/tales/<slug>/
├── cover.webp
├── n2/
│   ├── p01.webp  p01.avif      # illustrations par page
│   ├── fr.opus   fr.m4a        # narration FR (opus + fallback iOS)
│   └── bci.opus  bci.m4a
media/words/<lang>/<mot>.opus   # mots isolés prononcés (hotspots)
media/sfx/<son>.opus            # effets sonores (Web Audio)
media/quiz/<slug>/*.webp        # vignettes des mini-jeux
```

---

## 2. Images

| Paramètre | Valeur |
|---|---|
| Format principal | **WebP** (qualité 78–82) |
| Format moderne | **AVIF** (optionnel, `image_avif` dans le manifest) |
| Ratio illustration | plein écran, **4:3** conseillé (recadrage `object-fit: cover`) |
| Résolution | 1600×1200 max — cibler **< 200 Ko/image** (budget 3G) |
| Vignettes quiz | carré 512×512, **< 60 Ko** |
| Couverture | 800×600 |

Exemple d'encodage :

```bash
# WebP
cwebp -q 80 p01.png -o p01.webp
# AVIF
avifenc --min 24 --max 32 p01.png p01.avif
```

> Les coordonnées des hotspots étant **normalisées (0→1)**, l'illustration peut
> être servie à n'importe quelle résolution sans casser le placement.

---

## 3. Audio de narration

| Paramètre | Valeur |
|---|---|
| Format principal | **Opus** (`.opus`), ~48–64 kbps mono |
| Fallback iOS/Safari | **AAC** (`.m4a`), 64 kbps |
| Normalisation | −16 LUFS (voix claire, constante) |
| Voix | **d'Afrique de l'Ouest** (fr), locuteurs natifs (bci/dyu/bet) |

```bash
# Opus
ffmpeg -i fr.wav -c:a libopus -b:a 56k -ac 1 fr.opus
# Fallback AAC pour iOS
ffmpeg -i fr.wav -c:a aac -b:a 64k -ac 1 fr.m4a
```

Le lecteur choisit automatiquement le fallback si le navigateur ne sait pas lire
l'Opus (`content/manifest.js` → `resolveAudio`).

### Mots isolés (hotspots)

Chaque hotspot peut prononcer un mot dans la langue choisie :
`media/words/<lang>/<mot>.opus` (ex. `media/words/fr/baobab.opus`). Fichiers
courts (< 1,5 s), même chaîne d'encodage que la narration.

### Effets sonores (SFX)

`media/sfx/*.opus` — courts (< 2 s). Chargés et décodés par la **Web Audio API**
(`audio/sfx.js`), lecture faible latence. Si un SFX manque, l'app joue une
tonalité de repli (jamais de silence sur une interaction).

---

## 4. Timings de narration (karaoké)

Le surlignage mot-à-mot est piloté par un fichier de timings par langue et par
niveau : `data/tales/<slug>/<niveau>/<lang>.timings.json`.

### Format

```json
{
  "lang": "fr",
  "words": [
    { "w": "Il",    "s": 0.42, "e": 0.55, "p": 1 },
    { "w": "était", "s": 0.55, "e": 0.81, "p": 1 }
  ]
}
```

- `w` = mot affiché (c'est **cette** liste qui compose le texte karaoké à l'écran)
- `s` / `e` = début / fin en **secondes** (doivent être **strictement croissants**)
- `p` = numéro de **page** (doit correspondre à `pages[].index` du manifest)

### Génération par forced alignment

1. Transcrire le script exact de la narration (une ligne par page).
2. Aligner audio + texte avec **WhisperX** ou **Montreal Forced Aligner (MFA)** :

```bash
# WhisperX (exemple)
whisperx fr.wav --language fr --align_model WAV2VEC2_ASR_LARGE_LV60K_960H \
  --output_format json --output_dir out/
```

3. **Convertir** la sortie vers le format ci-dessus : extraire chaque mot avec
   `s`/`e`, et ajouter `p` (page) selon le découpage éditorial.
4. **Corriger à la main** les décalages (respirations, onomatopées, noms propres
   comme « Ananzè »). C'est l'étape qui garantit un karaoké net.

### Règles de cohérence

- Les mots d'une page portent tous le même `p` ; les pages se suivent dans l'ordre.
- Le lecteur avance automatiquement de page quand `p` change (`narrator.onPage`).
- La recherche du mot courant est **dichotomique** : jusqu'à 1 500 mots (N3) sans
  perte de fluidité. Les `s` doivent donc être triés.
- **N1** n'a pas besoin de timings (texte masqué) ; **N2/N3** oui.
- Sans fichier de timings, le lecteur reste fonctionnel : il affiche `pages[].text`
  et joue l'audio, sans surlignage.

---

## 5. Hotspots

3 à 5 par illustration. Coordonnées **normalisées** :

```json
{ "id": "baobab", "shape": "circle", "cx": 0.52, "cy": 0.38, "r": 0.14,
  "label": "le baobab", "sfx": "./media/sfx/wind_tree.opus",
  "voice": { "fr": "./media/words/fr/baobab.opus" }, "animation": "shake" }
```

- `shape` : `circle` (`cx`,`cy`,`r`) ou `rect` (`x`,`y`,`w`,`h`)
- `animation` : `shake` | `fly` | `pop`
- La cible tactile est portée au minimum à **72 px** même si la forme est plus petite.

---

## 6. Mini-jeux

Déclarés dans `games[]` du manifest (N2/N3) :

- **`find_animal`** — 4 vignettes, une seule `correct: true`.
- **`order_images`** — 4 images + `correct_order` (indices dans l'ordre attendu).
  Réordonnancement tactile par Pointer Events (fiable sur mobile).
- **`quiz`** — question à choix d'images (N3), même structure que `find_animal`.

---

## 7. Checklist de validation d'un conte

- [ ] `slug` ajouté dans `catalog.json` (`tales[]` **et** `packs[].tales`)
- [ ] `n1.json`, `n2.json`, `n3.json` présents et valides (`node -e "JSON.parse(...)"`)
- [ ] `pages[].index` continus à partir de 1
- [ ] Timings `s` strictement croissants, `p` cohérents avec les pages (N2/N3)
- [ ] `assets[]` liste **toutes** les URLs (images, audio, sfx, quiz) pour l'offline
- [ ] Images < 200 Ko, audio Opus + fallback `.m4a`
- [ ] Textes = **adaptation originale** (jamais copiée d'une édition existante)
- [ ] Test sur Android bas de gamme réel (Tecno / Infinix / itel)
