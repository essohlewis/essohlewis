# 🎯 PronoStars — Réseau social de pronostics sportifs

Plateforme web **front-end** (HTML5 / CSS3 / JavaScript vanilla, **sans framework ni bundler**)
de type réseau social (X/Twitter) dédiée au partage de **pronostics sportifs**, pensée pour le
marché ouest-africain (Côte d'Ivoire 🇨🇮 en priorité). Interface **mobile-first**, thème
**sombre par défaut** avec bascule clair/sombre.

> ⚠️ PronoStars **ne prend aucun pari** et **ne gère aucun argent de jeu**. C'est un réseau
> **social de partage d'analyses** à visée communautaire et de divertissement.

## ▶️ Lancer

Aucune installation. Ouvrez simplement `index.html` dans un navigateur (ou servez le dossier avec
n'importe quel serveur statique, ex. `python3 -m http.server`).

## 📁 Structure

| Fichier | Rôle |
|---|---|
| `index.html` | Squelette de la SPA (nav gauche · fil central · colonne latérale · nav mobile). |
| `styles.css` | Design system complet : variables de thèmes clair/sombre, cartes, jauges, animations, responsive. |
| `app.js` | Logique SPA (routage par hash), rendu des vues, interactivité, **algorithme TrustScore**. |
| `api.js` | Couche d'accès aux données **factice** (`mockData` + fonctions `async`) et **points d'intégration backend**. |

## 🧭 Vues (routage `#/...`)

`#/feed` · `#/explore` · `#/profile/:id` · `#/prediction/:id` · `#/leaderboard` ·
`#/create` · `#/notifications` · `#/search` · `#/hashtag/:tag`

La **page profil** est le cœur du produit : jauge **TrustScore** animée, taux de réussite,
barre victoires/défaites, ROI théorique, série en cours 🔥, sparkline de forme, fiabilité par
ligue, et onglets (Pronostics / En cours / Gagnés / Perdus / Analyses / Likes).

## ⭐ TrustScore (algorithme)

Score de crédibilité 0–100 pondérant : **réussite récente** (42 %), **difficulté des cotes
gagnées** (24 %), **régularité** (18 %) et **volume** (16 %), avec un **bonus/malus de série**.
La formule complète est documentée en commentaire dans `app.js` (section 2).

## 🔌 Intégration backend (à brancher)

Les fonctions de `api.js` (`getFeed`, `getUser`, `getUserPredictions`, `createPrediction`,
`toggleFollow`, `likePrediction`, `getLeaderboard`…) sont des **stubs** prêts à être connectés à
une **API REST PHP 8.2+ MVC (PDO/MySQL)**, avec authentification par token et paiement
**Mobile Money (CinetPay / PayDunya)** pour les fonctions premium.

## 📝 Notes

- Données simulées **en mémoire** uniquement (pas de `localStorage`/`sessionStorage`).
- Monnaie et contexte : **FCFA**, langue **française**, références ivoiriennes.
- Icônes en **SVG inline** / **emoji**, aucune librairie externe.
