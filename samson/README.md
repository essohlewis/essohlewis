# 🧩 Samson — Jeu de devinette d'images

**Samson** est un jeu web où l'on doit **deviner** ou **compléter** le nom de l'objet
affiché à l'image, selon le niveau du parcours choisi. 100 % **HTML / CSS / JavaScript**,
sans aucune dépendance externe ni connexion réseau.

## ▶️ Lancer le jeu

Ouvrez simplement `index.html` dans un navigateur. C'est tout !

```
samson/
├── index.html   # structure et écrans
├── style.css    # thème clair/sombre, animations, responsive
├── game.js      # logique complète du jeu
└── data.js      # énigmes (illustrations SVG + noms) et paliers
```

## 🎮 Principe

1. Une **illustration** apparaît avec sa catégorie.
2. Des **cases lettres** s'affichent : certaines sont déjà offertes (moins il y en a,
   plus le niveau est difficile), les autres sont à compléter.
3. Vous écrivez votre réponse (clavier physique **ou** clavier virtuel intégré).
4. Validez pour marquer des points !

## ✨ Fonctionnalités & innovations

- **4 parcours de difficulté** : Facile 🌱 · Moyen ⚡ · Difficile 🔥 · Expert 👑
  (le pourcentage de lettres offertes, le temps et les indices diminuent à chaque palier).
- **Mécanique « écrire ou compléter »** : des lettres sont pré-remplies selon le niveau.
- **Illustrations vectorielles SVG** dessinées à la main (aucune image externe).
- **Système de score dynamique** : bonus de temps + **multiplicateur de combo** en
  enchaînant les bonnes réponses, moins le coût des indices utilisés.
- **Vies** ❤️, **minuteur** avec barre de progression et alerte de temps.
- **Indices** : révèle une lettre ou affiche un indice textuel.
- **Clavier virtuel AZERTY** intégré pour mobile.
- **Effets sonores** générés à la volée via la Web Audio API (activables/désactivables).
- **Confettis** animés (canvas) sur les combos et les victoires.
- **Thème clair / sombre** avec mémorisation.
- **Sauvegarde locale** (localStorage) : meilleur score, étoiles par parcours, série record.
- **Écran de résultats** avec étoiles, précision et meilleur combo.
- **Responsive**, **accessible** (labels ARIA) et respect de `prefers-reduced-motion`.

## 🧠 Comparaison des réponses

Les accents, la casse et les espaces superflus sont ignorés lors de la validation
(`Étoile`, `etoile`, `ETOILE` sont tous acceptés), et des réponses alternatives
(`alias`) sont prévues pour certaines énigmes.

## ➕ Ajouter une énigme

Ajoutez un objet dans `SAMSON_PUZZLES` (fichier `data.js`) :

```js
{
  id: "cadeau",
  name: "Cadeau",
  alias: ["present"],
  hint: "On l'offre pour un anniversaire.",
  category: "objet",
  svg: `<svg viewBox="0 0 200 200">...</svg>`
}
```

Bon jeu ! 🎉
