# CoachLink CI 🇨🇮

**Plateforme SaaS de mise en relation Coachs ⇄ Clients** — Côte d'Ivoire & Afrique de l'Ouest francophone.

Application **front-end pure** (HTML5, CSS3, JavaScript vanilla ES6+), **sans framework ni build**, responsive et prête à être branchée sur une API PHP MVC/PDO ultérieurement.

---

## 🚀 Lancer l'application

Aucune installation requise. L'application fonctionne **hors-ligne**.

- **Le plus simple** : ouvrez `index.html` dans un navigateur.
- **Recommandé (PWA + service worker actifs)** : servez le dossier via un petit serveur local, par exemple :
  ```bash
  cd coachlink
  python3 -m http.server 8080
  # puis ouvrez http://localhost:8080
  ```

> Les données sont simulées côté client (localStorage / IndexedDB) et amorcées à partir d'un catalogue statique (12 coachs de démonstration). Aucun back-end n'est nécessaire.

### Compte de démonstration admin
- **Email** : `admin@coachlink.ci`
- **Mot de passe** : `admin123`

Vous pouvez aussi créer librement des comptes **client** ou **coach** depuis la page d'inscription.

---

## ✨ Fonctionnalités

- **Authentification** multi-étapes (client / coach), connexion sociale simulée (Facebook / LinkedIn), import LinkedIn, mot de passe oublié.
- **Profils coach riches** : bio, spécialités, langues, mur (posts), diplômes vérifiés, tarifs (FCFA), disponibilités hebdomadaires, avis, **TrustScore** et **badges**.
- **Recherche & filtres** instantanés : spécialité, commune d'Abidjan, note, prix, langue, disponibilité, tri.
- **Réservation** (calendrier de créneaux) → **paiement Mobile Money simulé** (Orange Money, MTN, Moov, Wave).
- **Messagerie** client ⇄ coach (temps réel local) avec réponses simulées.
- **Avis & réputation** : notes après séance terminée, réponses du coach.
- **Notifications** in-app (cloche).
- **Réseaux sociaux** : partage (Facebook, LinkedIn, WhatsApp, X), Open Graph dynamique, lien de profil partageable.
- **Tableaux de bord** : client, coach (stats + graphiques CSS), admin (modération diplômes, utilisateurs, litiges).
- **Plus** : mode clair/sombre persistant, structure i18n (FR par défaut), **PWA-ready** (manifest + service worker), squelettes de chargement, animations, accessibilité (ARIA, focus).

### 🚀 Fonctionnalités innovantes
- **CoachMatch** 🎯 — assistant de recommandation intelligent : un mini-questionnaire en 5 étapes, puis un **score de compatibilité (0-100)** par coach calculé sur des critères pondérés (spécialité, budget, localisation, langue, disponibilité, TrustScore), avec des **raisons explicites** (« Pourquoi ce coach ? »). Route `#/coachmatch`.
- **Comparateur de coachs** ⚖️ — ajoutez jusqu'à 3 coachs (bouton sur chaque carte), une **barre flottante** apparaît, puis un **tableau comparatif** côte à côte (TrustScore, note, prix, communes, langues, badges…).
- **Codes promo & parrainage** 🎁 — chaque utilisateur dispose d'un **code de parrainage personnel** partageable ; les codes promo (`BIENVENUE10`, `COACHLINK15`, `SPORT2026`) et de parrainage appliquent une **remise en temps réel** lors du paiement Mobile Money.
- **Médias du coach** 📸 — le coach peut téléverser une **photo de profil** et une **photo de couverture**, gérer une **galerie de photos**, et publier sur son **mur** des posts avec **image (upload)** ou **vidéo (lien YouTube/Vimeo/direct)**. Les images sont redimensionnées côté client (canvas) et une **visionneuse plein écran (lightbox)** permet de les agrandir. Aucun fichier externe : tout fonctionne hors-ligne.

---

## 🏗️ Architecture

```
coachlink/
├── index.html               # Point d'entrée (conteneur SPA #app)
├── manifest.json            # PWA
├── service-worker.js        # Cache hors-ligne
├── css/
│   ├── variables.css        # Design tokens (thème clair/sombre)
│   ├── base.css  layout.css  components.css  pages.css
├── js/
│   ├── app.js               # Routeur SPA (navigation #/route)
│   ├── data/seed.js         # Catalogue amorcé hors-ligne
│   ├── services/            # Couche données → BRANCHABLE API
│   │   ├── storageService  authService  coachService  bookingService
│   │   ├── messageService  notificationService  socialService
│   ├── components/          # toast, modal, ui, coachCard, layout
│   ├── pages/               # home, auth, search, profile, client, coach, admin, messages, settings, howItWorks
│   └── utils/               # dom, format (FCFA/dates), validation, i18n, icons (SVG inline)
└── data/                    # coachs.json, specialites.json, communes.json (contrat API de référence)
```

### Principes de conception
- **Séparation stricte données / vue / logique.** Tout accès aux données passe par la couche `js/services/`.
- **Branchement API futur** : pour connecter une API PHP MVC/PDO, il suffit de remplacer le corps des méthodes de `services/` par des appels `fetch()`. **Les pages n'ont pas à changer.**
- **Sécurité front** : échappement XSS systématique (`CL.dom.esc`), validation des entrées (`CL.validation`), notamment le format téléphone ivoirien (07 / 05 / 01).
- **Namespace global** `window.CL` (chargement par `<script>` classiques en ordre de dépendance → fonctionne en `file://`).
- Code **commenté en français**, nommage clair.

---

## 📊 Données simulées

`js/data/seed.js` (miroir de `data/coachs.json`) fournit **12 coachs réalistes** : noms ivoiriens, spécialités variées (sport, nutrition, yoga, business, scolaire, musique, danse…), tarifs en FCFA, communes d'Abidjan, diplômes, notes, avis et disponibilités — pour démontrer toutes les fonctionnalités dès l'ouverture.

---

### 🔐 Expériences dédiées par rôle
- **Coach** : espace entièrement dédié — **pas d'accueil public, pas de recherche d'autres coachs, pas de CoachMatch** (réservé aux clients). Le coach gère uniquement **ses informations** (profil, mur, galerie, disponibilités, diplômes) et **le suivi de ses clients** (demandes, messages, avis). Toute tentative d'accès à une page réservée aux clients (ou au profil d'un autre coach) le renvoie automatiquement à son tableau de bord. La navigation (haut, sidebar, barre mobile, menu) est intégralement adaptée.
- **Centre de notifications** : nouvelle page `#/notifications` (tous rôles) avec filtres lu/non-lu et « tout marquer lu ». Le coach est notifié en temps réel des **nouvelles demandes, paiements, avis, annulations et messages** ; le client l'est des **confirmations, refus et fins de séance**. Pastilles de compteur dans la cloche, la sidebar et la barre mobile.

### 📱 Expérience adaptative (app mobile / bureau)
- Sur **téléphone**, l'interface adopte les codes d'une **application mobile native** : **barre de navigation inférieure** (tab bar) avec bouton central « Match » mis en avant (style FAB), badges de messages non lus, cibles tactiles confortables, pleine largeur et respect des encoches (safe-area).
- Sur **ordinateur**, l'interface conserve une présentation **desktop** classique : barre de navigation supérieure et **sidebars** de tableaux de bord. La barre inférieure est masquée.
- La bascule est purement CSS (points de rupture) : aucune duplication de code, un seul code source pour les deux plateformes.

## 🎨 Design

Identité moderne et rassurante : **bleu confiance** + **vert validation** + accent **orange** (CTA), fond neutre. Coins arrondis, ombres douces, micro-interactions, mode sombre. Mobile-first (menu burger, sidebar desktop).
