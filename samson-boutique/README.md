# 🏋️ SAMSON Boutique

> Plateforme e-commerce de matériel de sport & fitness — extension digitale de **SAMSON GYM** (Cocody Angré, Abidjan).
> Auteur : **Essoh Lath Lewis** · Côte d'Ivoire

Boutique en ligne moderne, animée et **100 % front-end** (HTML5 + CSS3 + JavaScript vanilla, aucun framework), pensée pour le marché ivoirien : devise FCFA, paiement Mobile Money (Wave, Orange, MTN, Moov) et livraison par commune d'Abidjan.

---

## ✨ Fonctionnalités

- **Catalogue** de 24 produits répartis en 7 catégories (musculation, cardio, fitness, accessoires, nutrition, vêtements, équipement).
- **Filtres dynamiques** (catégorie, prix, marque, note, disponibilité), **tri**, **recherche instantanée** et pagination.
- **Fiche produit** avec galerie + zoom, variantes (couleur / taille / saveur), onglets et avis.
- **Panier** persistant (drawer latéral + page dédiée), badge animé, **codes promo** (`SAMSON10`, `BIENVENUE`, `LIVRAISON0`).
- **Wishlist** ❤️ persistée.
- **Checkout multi-étapes** : coordonnées → livraison (calcul des frais par zone) → paiement → confirmation + **reçu téléchargeable / WhatsApp**.
- **Paiement Côte d'Ivoire simulé** (Wave, Orange Money, MTN MoMo, Moov Money, paiement à la livraison), isolé dans `payment.js` et **prêt à brancher sur une vraie API**.
- **Sécurité front** : validation/sanitisation, anti-XSS, jeton anti-rejeu, masquage du téléphone, rate-limiting du bouton payer, bannière cookies.
- **PWA** : `manifest.json` + `service-worker.js` (installable, navigation catalogue hors-ligne).
- **Design premium** : hero animé, scroll-reveal, compteurs animés, skeleton loaders, thème clair/sombre persisté, micro-interactions, bouton WhatsApp flottant, glassmorphism.
- **Responsive** mobile-first (breakpoints 768px / 1024px).

---

## 🗂️ Structure

```
samson-boutique/
├── index.html · catalogue.html · produit.html · panier.html · checkout.html
├── compte.html · suivi.html · contact.html · a-propos.html · cgv.html · confidentialite.html
├── manifest.json · service-worker.js
└── assets/
    ├── css/  variables · base · components · layout · themes
    └── js/
        ├── data/products.js         (catalogue + zones livraison + promos)
        ├── modules/  storage · security · toast · theme · wishlist · cart
        │              search · catalog · product · checkout · payment
        └── app.js                   (chrome partagé + accueil + compte + suivi)
```

## 🚀 Lancer le projet

Aucune installation. Servez le dossier avec un serveur statique (le Service Worker requiert `http(s)://`, pas `file://`) :

```bash
cd samson-boutique
python3 -m http.server 8080
# puis ouvrir http://localhost:8080
```

## 💳 Codes promo de démonstration

| Code | Effet |
|------|-------|
| `SAMSON10` | −10 % |
| `BIENVENUE` | −15 % |
| `LIVRAISON0` | Livraison offerte |

## 🔌 Passer en production (paiement réel)

Toute la logique de paiement est isolée dans `assets/js/modules/payment.js` :

```js
SB.payment.processPayment(method, payload) // → Promise
```

Aujourd'hui la fonction résout une simulation. Pour brancher un vrai
prestataire (CinetPay, PayDunya, API opérateur), remplacez le corps par un
appel `fetch('/api/payments', …)` — **sans toucher au reste du code**. Les
points nécessitant impérativement une vérification serveur sont marqués
`// TODO backend` (webhook de confirmation, contrôle de stock réel,
invalidation du jeton anti-rejeu).

---

🎨 Palette : Orange `#FF6B00` · Noir `#0D0D0D` · Blanc — cohérence avec SAMSON GYM.
