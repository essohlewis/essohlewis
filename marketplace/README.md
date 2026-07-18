# 🛒 Marché CI — Marketplace multi-vendeurs (front-end)

Marketplace multi-vendeurs **100 % front-end** (HTML / CSS / JavaScript vanilla), pensée pour le marché **ivoirien / ouest-africain francophone**. Aucune dépendance externe, aucun back-end, aucune étape de build : **il suffit d'ouvrir `index.html`**.

Toutes les données (comptes, boutiques, articles, commandes, abonnements, notifications, panier, avis) sont persistées **côté navigateur via `localStorage`**. Les images sont stockées en **base64** (redimensionnées automatiquement).

---

## 🚀 Démarrage

1. Ouvrir le fichier **`index.html`** dans un navigateur moderne (Chrome, Firefox, Edge, Safari).
2. C'est tout. Les données de démonstration sont injectées automatiquement au premier lancement.

> Astuce : pour repartir de zéro, connectez-vous en **admin** et cliquez sur « Réinitialiser les données démo » (ou videz le `localStorage` du site).

---

## 🖼️ Aperçu

| Bureau (clair) | Fiche article (sombre) | Mobile (app-like) |
|---|---|---|
| ![Bureau](screenshot-desktop.png) | ![Sombre](screenshot-product-dark.png) | ![Mobile](screenshot-mobile.png) |

---

## 🔑 Comptes de test

| Rôle | E-mail | Mot de passe |
|------|--------|--------------|
| **Client / Acheteur** | `client@test.ci` | `1234` |
| **Vendeur** (boutique « Élégance Abidjan ») | `elegance@test.ci` | `1234` |
| **Vendeur** (boutique « HighTech CI ») | `hightech@test.ci` | `1234` |
| **Vendeur** (boutique « Saveurs du Terroir ») | `saveurs@test.ci` | `1234` |
| **Vendeur** (boutique « Maison & Confort ») | `maison@test.ci` | `1234` |
| **Admin** | `admin@test.ci` | `1234` |

Données de démo : **4 boutiques**, **16 articles**, quelques avis, abonnements et notifications.

---

## ✨ Fonctionnalités

### Visiteur / Acheteur
- Fil d'accueil regroupant les articles de **toutes les boutiques**.
- Recherche + filtres (catégorie, commune, boutique, prix, tri).
- Fiche article détaillée, **rattachée à sa boutique d'origine** (variantes taille/couleur, galerie).
- **Panier multi-boutiques** : au checkout, les articles sont **regroupés par boutique** → **une commande par boutique**.
- **Paiement à la livraison** uniquement (espèces) : saisie des coordonnées (nom, téléphone, commune, adresse/point de repère) + numéro de commande généré.
- Favoris (wishlist), historique des commandes, profil éditable.
- **Abonnement aux vendeurs** → notification à chaque nouvel article publié.
- Système d'**avis / notes en étoiles** sur les articles et les boutiques.

### Vendeur
- Inscription vendeur / activation « Ouvrir ma boutique » depuis un compte client.
- **Création de boutique** : nom, logo, bannière, description, catégorie, commune, horaires, WhatsApp, réseaux sociaux.
- **Tableau de bord** : chiffre d'affaires simulé, nombre d'articles, commandes reçues, abonnés, articles les plus vus.
- **CRUD articles** : titre, description, prix FCFA, prix promo, stock, catégorie, **plusieurs images**, état (neuf/occasion), variantes.
- Publication / dépublication / brouillon.
- **Gestion des commandes reçues** : changement de statut (en attente → confirmée → expédiée → livrée / annulée) → notifie l'acheteur.
- Page publique de la boutique (vitrine) avec bouton **S'abonner**.
- Réponse aux avis clients → notifie l'auteur.

### Admin
- Console de modération : statistiques globales, suppression de boutiques/articles, réinitialisation des données de démo.

### Notifications (client-side)
- Cloche avec badge de non-lus.
- Déclencheurs : nouvel article d'un vendeur suivi, changement de statut de commande, réponse à un avis.
- Persistance `localStorage`, marquage lu/non-lu, effacement.

---

## 🎨 Design & UX
- Design moderne : palette orange/vert, coins arrondis, ombres douces, micro-animations.
- **Responsive multiplateforme** :
  - **Mobile** : barre de navigation basse type application (Accueil, Recherche, Panier, Alertes, Profil), transitions entre écrans, feuilles modales.
  - **Desktop** : header sticky + sidebar de filtres + grille large.
- **Mode clair / sombre** avec bascule persistée (suit la préférence système par défaut).
- États de chargement (skeletons), états vides illustrés, toasts de confirmation.

---

## 🗂️ Structure

```
marketplace/
├── index.html
├── css/
│   ├── theme.css        # variables, palette, thème clair/sombre
│   ├── style.css        # composants & layout desktop
│   └── responsive.css   # tablette & mobile (app-like)
├── js/
│   ├── db.js            # abstraction localStorage (namespace MP.DB)
│   ├── ui.js            # formatage, échappement XSS, toasts, modales, upload base64
│   ├── notifications.js # notifications client-side
│   ├── auth.js          # inscription, connexion, session, rôles
│   ├── store.js         # boutiques, abonnements, avis boutique
│   ├── products.js      # CRUD articles, vues, avis, recherche/filtres
│   ├── cart.js          # panier multi-boutiques
│   ├── orders.js        # commandes (paiement à la livraison)
│   ├── seed.js          # données de démonstration
│   ├── router.js        # routeur SPA (hash routing)
│   └── app.js           # point d'entrée + rendu des vues + wiring
└── assets/
    └── placeholder.svg
```

Architecture : chaque module s'attache au **namespace global `window.MP`** (scripts classiques, compatibles avec l'ouverture directe en `file://` — pas de modules ES pour éviter les restrictions CORS locales).

---

## 🔒 Sécurité (front basique)
- **Échappement anti-XSS** systématique du contenu utilisateur à l'affichage (`MP.UI.esc`).
- Validation des formulaires, dont le **numéro de téléphone de livraison** (format ivoirien).
- Nettoyage des sources d'images (`data:` / `http(s):` uniquement).

---

## ⚠️ Limites (assumées — projet démo front-only)
- **Données locales au navigateur** : rien n'est synchronisé entre appareils ; vider le cache/`localStorage` efface tout.
- **Mots de passe stockés en clair** dans `localStorage` (démo uniquement — jamais en production).
- Le `localStorage` a une capacité limitée (~5 Mo) : les images sont redimensionnées, mais un usage intensif peut saturer le quota.
- Chiffre d'affaires et statistiques sont **simulés** localement.
- Aucun paiement en ligne : **paiement à la livraison** exclusivement, conforme au contexte.
