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
- **Double filtre dans l'Explorateur** : une **barre par sport** (⚽ Football,
  🏀 Basket, 🎾 Tennis, 🏎️ F1, 🏉 Rugby, 🥊 MMA) qui pilote une **barre par
  championnat** (puce + compteur, groupée par région), filtrant le fil en direct.
- **Page dédiée par championnat** (`#/championnat/:nom`) — le nom de ligue sur
  chaque carte est cliquable et ouvre une vraie page : en-tête (drapeau, pays,
  région, sport), **statistiques communautaires** (nb de pronostics, en cours,
  résolus, taux de réussite de la communauté) et un **classement des meilleurs
  pronostiqueurs sur ce championnat** (par taux de réussite), suivi de tous ses
  pronostics.
- **Drapeau du championnat** affiché sur chaque carte et chaque sélection de coupon.
- **Formulaire de création** avec un menu déroulant groupé par région (`<optgroup>`).
- **Multi-sports** : basket (NBA, EuroLeague), Formule 1, tennis (ATP/WTA), rugby
  (Top 14), MMA (UFC) — les cartes s'adaptent (scores de basket, duels 1v1, etc.).
- Nombreux pronostics de démo (El Clásico, Derby de Milan, Klassiker, Superclásico
  argentin, derby de Casablanca, derby d'Abidjan ASEC–Africa, Lakers–Celtics,
  GP de F1, CAN Féminine, Ngannou–Jones, etc.).

- Données : `mockData.championnats` · API : `getChampionnats()`
- Logique : `champBarHTML()`, `renderExploreList()`, `champOptionsHTML()`, `ligueEmoji()`.

## 7. 🔐 Espace Connexion / Inscription + compte modifiable
Un **portail d'authentification** protège désormais l'accès : impossible d'atteindre
le fil, les profils ou la création de pronostics sans être connecté.

- **Connexion** par pseudo **ou** email + mot de passe (comptes de démo :
  mot de passe `demo1234`), avec messages d'erreur.
- **Inscription** complète : choix d'**avatar** (emoji), pseudo/nom/email/mot de
  passe (validés : unicité du pseudo, longueur du mot de passe), **sports favoris**
  (multi-sélection) et **couleur de bannière**. Le nouveau compte est créé et
  connecté immédiatement.
- **Onboarding** après inscription : un modal propose de **suivre des experts**
  (triés par TrustScore) pour peupler le fil.
- **Édition du profil** (modal « Modifier le profil ») : avatar, nom, bio, sports,
  bannière — mise à jour en direct du profil et de la barre latérale.
- **Menu « Mon compte »** : voir/modifier le profil, **changer de compte** (démo,
  bascule instantanée entre pronostiqueurs) et **se déconnecter**.

- Données : `email` + `motDePasse` sur chaque compte · API : `login()`, `signup()`,
  `logout()`, `switchAccount()`, `updateProfile()`.
- Logique : `showAuthGate()` / `enterApp()` (portail), `renderAuthGate()`,
  `openAccountMenu()`, `openEditProfile()`, `openOnboarding()`.
- **Sécurité (production)** : le mot de passe sera **haché** (Argon2 via PHP
  `password_hash`), et la session gérée par **token (JWT)**. Jamais de mot de
  passe en clair côté client.

## 8. 💬 Messagerie directe
Conversations privées entre pronostiqueurs. Le bouton **« Message »** d'un profil
ouvre le fil de discussion.

- Liste des conversations (dernier message, heure, **badge de non-lus**).
- Fil de discussion en bulles (les miennes à droite, celles de l'autre à gauche),
  envoi en direct, marquage automatique comme lu, badge de non-lus dans la nav.
- Données : `mockData.messages` · API : `getConversations()`, `getThread(id)`,
  `sendMessage(id, texte)`, `countUnreadMessages()`.

## 9. ⚙️ Paramètres
Une page **Paramètres** (menu « Mon compte » → Paramètres) :
- **Apparence** : thème clair/sombre + **couleur d'accent** personnalisable (5 teintes,
  appliquée via variables CSS globales).
- **Notifications** : interrupteurs par type (j'aime, abonnés, commentaires,
  résolutions, reposts, badges) — ils **filtrent réellement** le fil de notifications
  et le badge.
- **Compte** : pseudo, email, **changement de mot de passe** (validé), déconnexion.
- Logique : `renderSettings()`, `applyAccent()`, `state.notifPrefs`,
  API `changePassword()`.

## 10. 💰 Cagnotte virtuelle & Défi de la saison
Gamification : chaque pronostiqueur dispose d'une **cagnotte virtuelle** (FCFA)
calculée à partir de ses pronostics résolus (mise fixe fictive de 1 000 FCFA,
départ 10 000 FCFA, gain = cote × mise).

- Affichée sur le **profil** (avec variation ▲/▼ colorée).
- **Widget « Défi de la saison »** dans la colonne latérale : classement des
  meilleures cagnottes.
- Calcul intégré à `computeStats()` (champ `cagnotte`).

> Note technique : une **horloge virtuelle monotone** (`nowISO()`) garantit que
> tout contenu créé pendant la session (message, commentaire, pronostic) est
> toujours horodaté après les données de démo, quel que soit l'horaire de la machine.

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
