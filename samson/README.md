# 🧩 Samson — Jeu de devinette d'images

**Samson** est un jeu web où l'on doit **deviner** ou **compléter** le nom de l'objet
affiché à l'image, selon le niveau. 100 % **HTML / CSS / JavaScript**, **sans aucune
dépendance externe** ni connexion réseau — et installable comme une application (PWA).

## ▶️ Lancer le jeu

Ouvrez `index.html` dans un navigateur. Pour activer l'installation PWA et le mode
hors-ligne (service worker), servez le dossier via un petit serveur local, par ex. :

```bash
cd samson && python3 -m http.server 8000   # puis ouvrez http://localhost:8000
```

```
samson/
├── index.html    # structure et écrans
├── style.css     # thème clair/sombre, animations, responsive
├── game.js       # logique complète (modes, jokers, succès, stats…)
├── data.js       # 53 énigmes (SVG + noms), modes, succès, rangs
├── culture.js    # 81 questions de culture (9 matières, tous continents)
├── manifest.json # métadonnées PWA
├── sw.js         # service worker (jeu hors-ligne)
└── icon.svg      # icône de l'application
```

## 🎮 9 modes de jeu

| Mode | Description |
|------|-------------|
| 🗺️ **Parcours** | 4 paliers (Facile, Moyen, Difficile, Expert), étoiles à gagner. |
| 📅 **Défi du jour** | 8 énigmes déterministes, identiques pour tous le même jour, avec **série quotidienne** 🔥. |
| 🎓 **Culture & Matières** | **Quiz éducatif** : littérature, histoire, philosophie, informatique, économie, géographie, sciences, arts, section enfants — avec des figures de **tous les continents**. |
| ♾️ **Survie** | Enchaînement infini, 3 vies, difficulté et temps qui se durcissent. |
| ⏱️ **Contre-la-montre** | 90 secondes chrono : marquer un maximum, chaque bonne réponse ajoute du temps. |
| 👥 **Duo** | 2 joueurs à tour de rôle (avec écran de passation), le meilleur score gagne. |
| 🧘 **Zen** | Entraînement sans minuteur ni vies, jokers illimités et bouton « Révéler ». |
| 🎯 **Par thème** | Joue une seule catégorie : animaux, nature ou objets. |
| 🎨 **Mes énigmes** | **Crée tes propres devinettes** (mot + emoji + indice), avec import/export de packs ! |

## 🎓 Mode « Culture & Matières »

Un véritable quiz éducatif **pour tout âge**, avec **81 questions** réparties en **9 matières** :
📖 Littérature · 🏛️ Histoire · 🧠 Philosophie · 💻 Informatique · 💰 Économie ·
🌍 Géographie · 🔬 Sciences · 🎨 Arts & Musique · 🧒 Pour enfants.

Le contenu met en avant la **diversité de tous les continents** (Afrique, Asie, Amérique,
Europe, Océanie) : Chinua Achebe, Mariama Bâ, Soundiata Keïta, Mansa Moussa, Cheikh Anta
Diop, Fela Kuti, Miriam Makeba, Tagore, García Márquez, Bolívar, Toussaint Louverture… aux
côtés des grands repères européens. Chaque question affiche un énoncé, une icône, la matière
et le **continent** concerné. Les questions sont facilement extensibles dans `culture.js`.

## 🎖️ Progression du joueur

Chaque partie rapporte de l'**XP** et fait grimper ton **rang** : 🥚 Débutant →
🌱 Apprenti → 🎯 Amateur → ⭐ Habitué → 🔥 Expert → 💎 Champion → 👑 Maître → 🏆 Légende,
avec une notification à chaque niveau supérieur.

## ✨ Fonctionnalités & innovations

- **Mécanique « écrire ou compléter »** : cases lettres pré-remplies selon le niveau.
- **53 illustrations vectorielles SVG** dessinées à la main (aucune image externe).
- **3 jokers** : 💡 révéler une lettre · ❄️ +10 secondes · 🎯 dévoiler la moitié du mot.
- **Éditeur d'énigmes** : crée tes propres devinettes avec un emoji comme image, stockées localement.
- **Import / export de packs** : partage tes énigmes personnalisées via un code.
- **Système d'XP et de rangs** : progresse et débloque de nouveaux titres.
- **Score dynamique** : bonus de temps + **multiplicateur de combo** − coût des jokers.
- **Vies** ❤️, **minuteur** (par question ou global selon le mode) avec alerte.
- **18 succès / trophées** débloquables avec notifications animées.
- **Statistiques** détaillées : parties, précision, combo record, catégorie favorite…
- **Classement local** : les 10 meilleures parties tous modes confondus.
- **Réglages** : nom du joueur, clavier **AZERTY/QWERTY**, sons, animations, réinitialisation.
- **Clavier virtuel** intégré pour mobile.
- **Partage du résultat** (Web Share API ou copie dans le presse-papiers).
- **Effets sonores** générés via la Web Audio API + **confettis** (canvas).
- **Thème clair / sombre** et **sauvegarde locale** de toute la progression.
- **PWA** installable et jouable **hors-ligne**.
- **Responsive**, **accessible** (ARIA) et respect de `prefers-reduced-motion`.

## 🧠 Comparaison des réponses

Accents, casse et espaces sont ignorés (`Étoile` = `etoile` = `ETOILE`), et des
réponses alternatives (`alias`) sont acceptées (ex. `hibou` pour `Chouette`).

## ➕ Ajouter une énigme

Ajoutez un objet dans `SAMSON_PUZZLES` (`data.js`) avec un `level` de 1 (facile) à 3 (difficile) :

```js
{
  id: "cadeau", name: "Cadeau", alias: ["present"], level: 1,
  hint: "On l'offre pour un anniversaire.", category: "objet",
  svg: `<svg viewBox="0 0 200 200">...</svg>`
}
```

Bon jeu ! 🎉
