# 🚀 Innovations de PronoStars

Ce document décrit les fonctionnalités différenciantes ajoutées à la plateforme,
au-delà d'un simple fil social de pronostics. Toutes sont **100 % fonctionnelles
en front-end** (aucun backend requis pour la démo).

---

## 1. ⚡ Ticker « En direct »
Bandeau défilant en haut du fil d'accueil affichant les matchs en cours.
La **minute** et le **score** progressent en temps réel via un timer (`setInterval`,
toutes les 3 s) qui simule un flux live. Le défilement se met en pause au survol.

- Données : `mockData.liveMatches` · API : `getLive()`
- Logique : `startLiveTicker()` dans `app.js` (s'auto-désactive quand le ticker
  quitte l'écran, pour économiser les ressources).
- **Intégration** : brancher sur un flux de scores (WebSocket / polling type Sportradar).

## 2. 🎟️ Coupons combinés (« le combiné »)
Un pronostiqueur peut regrouper plusieurs sélections en un **combiné**, avec :
- **cote totale** = produit des cotes,
- barre de progression « X/N sélections validées »,
- **statut dérivé automatiquement** : `perdu` si une sélection tombe, `gagné` si
  toutes passent, `en cours` sinon.

Très ancré dans la culture de pronostics ouest-africaine. Affiché dans l'onglet
Explorer et sur la page profil (section dédiée).

- Données : `mockData.coupons` · API : `getCoupons()`, `getUserCoupons(id)`
- Composant : `couponCardHTML()`, statut via `couponStatut()`.

## 3. 📊 Sondages communautaires
Chaque pronostic peut porter un **sondage** (« Qui va gagner ? »). Les membres
votent (un vote par personne) et les **barres de résultat s'animent** en direct,
l'option en tête étant surlignée en vert.

- Données : champ `sondage` sur les prédictions · API : `voteSondage(predId, index)`
- Composant : `pollHTML()`, rendu sur le détail d'un pronostic.

## 4. 🔬 Transparence du TrustScore (modal interactif)
La jauge TrustScore de chaque profil est **cliquable** et ouvre un modal qui
**décompose le score** en ses 4 composantes pondérées :

| Composante | Poids | Rôle |
|---|---|---|
| Réussite récente | 42 % | victoires, les pronos récents pèsent plus |
| Difficulté des cotes | 24 % | gagner haut rapporte plus |
| Régularité | 18 % | récompense la constance |
| Volume | 16 % | maturité de l'échantillon |

…plus le **bonus/malus de série**. La formule complète est affichée dans le modal.
C'est un vrai différenciateur : la crédibilité devient **explicable**, pas une
boîte noire.

- Logique : `openTrustModal(userId)`, alimenté par `computeStats().composantes`.

## 5. 🌍 Championnats du monde entier (multi-sports)
Catalogue mondial de **40+ compétitions** structuré et groupé par **région**,
chacune avec son **drapeau/emoji**, son pays et (hors football) son **sport** :

- **Afrique** : CAN, CAN Féminine 👩🏾‍🦱, Ligue 1 CIV 🇨🇮, Botola Pro 🇲🇦, CAF Champions League, Egyptian Premier League 🇪🇬, PSL 🇿🇦, Ligue 1 Sénégal 🇸🇳, NPFL 🇳🇬, Ligue 1 Algérie 🇩🇿, Ghana Premier League 🇬🇭
- **Europe** : Premier League, Ligue 1, La Liga 🇪🇸, Serie A 🇮🇹, Bundesliga 🇩🇪, Liga Portugal 🇵🇹, Eredivisie 🇳🇱, Champions League, Europa League, Süper Lig 🇹🇷, Pro League 🇧🇪, Scottish Premiership 🏴
- **Amériques** : MLS 🇺🇸, Liga MX 🇲🇽, Brasileirão 🇧🇷, Primera División 🇦🇷, Copa Libertadores, Liga BetPlay 🇨🇴
- **Asie & Moyen-Orient** : Saudi Pro League 🇸🇦, J1 League 🇯🇵, Qatar Stars League 🇶🇦, Chinese Super League 🇨🇳, K League 🇰🇷
- **International** : Coupe du Monde, Coupe du Monde Féminine, Ligue des Nations, Coupe du Monde des Clubs
- **Autres sports** : NBA 🏀, EuroLeague 🏀, Formule 1 🏎️, Tennis ATP 🎾, Tennis WTA 🎾, Top 14 (Rugby) 🏉, UFC (MMA) 🥊

Concrètement dans l'app :
- **Barre de filtres** défilable dans l'Explorateur : une puce par championnat
  (avec compteur de pronostics), groupée par région, filtrant le fil en direct.
- **Route dédiée** `#/championnat/:nom` (le nom de ligue sur chaque carte est
  cliquable → ouvre l'Explorateur filtré sur ce championnat).
- **Drapeau du championnat** affiché sur chaque carte et chaque sélection de coupon.
- **Formulaire de création** avec un menu déroulant groupé par région (`<optgroup>`).
- **Multi-sports** : basket (NBA, EuroLeague), Formule 1, tennis (ATP/WTA), rugby
  (Top 14), MMA (UFC) — les cartes s'adaptent (scores de basket, duels 1v1, etc.).
- Nombreux pronostics de démo (El Clásico, Derby de Milan, Klassiker, Superclásico
  argentin, derby de Casablanca, derby d'Abidjan ASEC–Africa, Lakers–Celtics,
  GP de F1, CAN Féminine, Ngannou–Jones, etc.).

- Données : `mockData.championnats` · API : `getChampionnats()`
- Logique : `champBarHTML()`, `renderExploreList()`, `champOptionsHTML()`, `ligueEmoji()`.

## 6. 🤖 Coach IA (analyse simulée)
Sur le détail d'un pronostic, un panneau **Coach IA** rend un **indice de confiance
(0–100)** et un **verdict** calculés par une heuristique combinant :
`45 % TrustScore de l'auteur + 35 % sa fiabilité sur la ligue du match + 20 % qualité de la cote`.

Clairement étiqueté « analyse simulée à titre indicatif — pas un conseil de pari ».

- Logique : `coachIA(p)` / `coachIAHTML(p)` dans `app.js`.
- **Intégration** : remplacer l'heuristique par un appel à un service d'analyse.

---

## Rappel
> PronoStars **ne prend aucun pari** et **ne gère aucun argent de jeu**. Réseau
> social de partage d'analyses à visée communautaire et de divertissement. 🇨🇮
