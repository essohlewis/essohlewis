# PronosAI — Plateforme de Pronostics Sportifs par IA

Plateforme web **front-end pur** (HTML5 + CSS3 + JavaScript vanilla, **aucun framework**) où une IA (simulée) génère des pronostics sportifs quotidiens sur les compétitions les plus populaires d'**Europe, d'Afrique, d'Asie et d'Amérique**.

> Design premium sombre/clair, 100 % responsive, PWA-ready, multilingue FR/EN.

## ✨ Fonctionnalités

- **Landing page** premium : hero animé, aperçu des pronostics (verrouillés), sports couverts, « comment ça marche », « pourquoi notre IA », preuve sociale + graphique de performance, tarifs (mensuel/annuel, multi-devise), FAQ accordéon, footer avec avertissement jeu responsable (18+).
- **Inscription / connexion** : validation temps réel (email, force du mot de passe, confirmation), session factice via `localStorage`.
- **Dashboard membre** : sidebar, KPIs animés, filtres (sport / région / ligue / confiance), cartes de pronostic détaillées avec **jauge de confiance IA**, historique filtrable, statistiques (courbe + barres), abonnement, paramètres.
- **Thème clair/sombre** persistant (`localStorage`).
- **Multilingue** FR (défaut) + EN, structure extensible.
- **PWA** : `manifest.json` + `service-worker.js` (cache hors-ligne).
- **Accessibilité** : `aria-*`, navigation clavier, contrastes, `prefers-reduced-motion`.

## 📁 Structure

```
pronostics-ai/
├── index.html            # Landing page
├── auth.html             # Inscription / connexion
├── dashboard.html        # Espace membre
├── css/
│   ├── variables.css     # Tokens : couleurs, thèmes, typographie
│   ├── style.css         # Styles globaux + landing + auth
│   └── dashboard.css     # Styles de l'espace membre
├── js/
│   ├── theme.js          # Toggle clair/sombre + persistance
│   ├── i18n.js           # Multilingue FR/EN
│   ├── data.js           # Données mock + fetchPredictions() (⚠ point de branchement API)
│   ├── predictions.js    # Rendu des cartes de pronostic
│   ├── main.js           # Interactions landing
│   ├── auth.js           # Validation + session factice
│   └── dashboard.js      # Logique du tableau de bord
├── assets/               # Logos SVG, icônes
├── manifest.json         # PWA
└── service-worker.js     # Cache hors-ligne
```

## 🚀 Lancer en local

Aucune dépendance à installer. Servir les fichiers via un serveur statique
(le service worker et `fetch` nécessitent `http://`, pas `file://`) :

```bash
cd pronostics-ai
python3 -m http.server 8080
# puis ouvrir http://localhost:8080
```

## 🔌 Brancher une vraie API / un vrai moteur d'IA

La couche données est isolée dans `js/data.js`. Pour passer du mock à un vrai
backend, remplacer le corps de **`fetchPredictions()`** :

```js
function fetchPredictions() {
  return fetch('https://api.votre-backend.com/predictions')
    .then((r) => r.json());
  // La réponse doit respecter la même forme d'objet que generatePredictions().
}
```

Les points de branchement (`fetchPredictions`, `fetchPlatformStats`,
`fetchPerformanceSeries`, et l'authentification `fakeAuth` dans `auth.js`)
sont signalés par des commentaires `⚠ POINT DE BRANCHEMENT` dans le code.

## ⚖️ Jeu responsable

Les paris comportent des risques. **Interdit aux moins de 18 ans.**
Les pronostics ne garantissent aucun gain.
