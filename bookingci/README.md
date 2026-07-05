# BookingCI 🇨🇮

**Plateforme de réservation de restaurants & résidences meublées en Côte d'Ivoire.**

Site vitrine + réservation en **HTML5 / CSS3 / JavaScript vanilla (ES6+)**, sans
framework, 100 % responsive (mobile-first), prêt à être branché sur un backend
PHP MVC ou une API REST.

---

## 🗂️ Structure des fichiers

```
bookingci/
├── index.html                     # Page d'accueil (hero + recherche + sélections)
├── pages/
│   ├── restaurants.html           # Listing restaurants + filtres
│   ├── residences.html            # Listing résidences + filtres
│   ├── fiche-etablissement.html   # Fiche + galerie + widget réservation
│   ├── devenir-partenaire.html    # Inscription pro + tableau de bord (démo)
│   └── connexion.html             # Connexion / inscription + espace client
├── assets/
│   ├── css/
│   │   └── style.css              # Design system complet (tokens + composants)
│   ├── js/
│   │   ├── data.js                # Données démo (+ coordonnées) + "API" simulée + helpers
│   │   ├── main.js                # UI transverse : nav, reveal, toasts, validation, favoris
│   │   ├── filtres.js             # Filtrage / tri côté client des listings
│   │   └── reservation.js         # Fiche : carousel, calendrier, carte Leaflet, réservation
│   ├── vendor/
│   │   └── leaflet/               # Leaflet 1.9.4 auto-hébergé (JS, CSS, images marqueurs)
│   └── images/                    # (Vos photos réelles — placeholders SVG générés en JS)
└── README.md
```

## 🚀 Lancer le site

Aucune compilation nécessaire. Servez le dossier avec n'importe quel serveur statique :

```bash
cd bookingci
python3 -m http.server 8000
# puis ouvrez http://localhost:8000
```

> Ouvrir directement `index.html` via `file://` fonctionne aussi, mais un
> serveur local est recommandé (comportement identique à la production).

---

## 🎨 Design

- **Palette chaleureuse** (hospitalité ivoirienne) : terracotta/orange, vert,
  blanc cassé — définie en variables CSS dans `:root` (`assets/css/style.css`).
- **Typographie** : Poppins (titres) + Inter (corps), chargées via Google Fonts.
- **Responsive mobile-first** : 3 points de rupture (`640px`, `900px`, `1100px`).
- **Accessibilité** : contrastes soignés, `alt` sur les images, navigation
  clavier (galerie, menus), `:focus-visible`, respect de
  `prefers-reduced-motion`.
- **Carte interactive** : la fiche établissement affiche une vraie carte
  **Leaflet + OpenStreetMap** centrée sur les coordonnées de l'établissement
  (marqueur + popup). Leaflet est **auto-hébergé** dans `assets/vendor/leaflet/`
  (aucune dépendance CDN pour la librairie) ; seules les tuiles proviennent
  d'OpenStreetMap. Un repli visuel s'affiche si les tuiles sont indisponibles.
- **Animations discrètes** : révélations au scroll via `IntersectionObserver`
  (classe `.reveal`).

---

## ⚙️ Fonctionnalités JavaScript

| Module            | Rôle |
|-------------------|------|
| `data.js`         | Namespace `window.BookingCI` : jeux de données, helpers de formatage (`formatFCFA`, `etoiles`), générateur d'images SVG, et **API simulée** (`BookingCI.api.*`) renvoyant des `Promise`. |
| `main.js`         | `window.BCUI` + `window.BCValidation` : menu mobile, révélations, toasts, rendu des cartes, favoris (sessionStorage), validation de formulaires, onglets, espaces pro/client. |
| `filtres.js`      | `window.BCFiltres.appliquerFiltres()` (fonction **pure** testable) + rendu du listing filtré/trié, pré-remplissage par l'URL (`?ville=`). |
| `reservation.js`  | `window.BCReservation` : `nbNuits`, `calculerMontant`, `validerReservation` (pures) + carousel, calendrier interactif, panier (sessionStorage). |

La **logique métier** (calculs, filtres, validation) est isolée dans des
fonctions pures ; la **manipulation du DOM** est regroupée à part, pour
faciliter les tests et la future migration vers un backend.

---

## 🔌 Brancher un backend (PHP MVC ou API REST)

Toute la couche données passe aujourd'hui par l'**API simulée** de `data.js`.
Chaque méthode renvoie une `Promise`, exactement comme `fetch()` : le passage à
un vrai backend consiste à remplacer le corps de ces méthodes.

### Endpoints anticipés

| Méthode | Endpoint                          | Utilisé par            | Payload / Réponse |
|---------|-----------------------------------|------------------------|-------------------|
| `GET`   | `/api/etablissements?type=…`      | listings, accueil      | Liste d'établissements |
| `GET`   | `/api/etablissements/:id`         | fiche                  | Un établissement |
| `GET`   | `/api/disponibilites/:id`         | calendrier fiche       | `{ indisponibles: ["YYYY-MM-DD", …] }` |
| `POST`  | `/api/reservations`               | widget réservation     | Objet réservation → confirmation |
| `POST`  | `/api/etablissements`             | espace partenaire      | Multipart (infos + photos) |
| `POST`  | `/api/auth/login` / `/register`   | connexion / inscription| Identifiants → token/session |
| `POST`  | `/api/favoris`                    | bouton favori          | `{ etablissementId }` |

### Exemple de migration (`data.js`)

Remplacez :

```js
getEtablissements: function (type) {
  let all = RESTAURANTS.concat(RESIDENCES);
  if (type) all = all.filter(e => e.type === type);
  return simulate(all);
}
```

par :

```js
getEtablissements: function (type) {
  const url = '/api/etablissements' + (type ? '?type=' + encodeURIComponent(type) : '');
  return fetch(url).then(r => {
    if (!r.ok) throw new Error('Erreur ' + r.status);
    return r.json();
  });
}
```

Les points `POST` sont déjà **repérés en commentaire** dans le code (recherchez
`En prod :`) — par ex. dans `reservation.js` :

```js
// En prod :
// fetch('/api/reservations', {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify(resa)
// }).then(r => r.json()).then(confirmation => { … });
```

### Côté PHP MVC (indicatif)

```
routes/          ->  GET /api/etablissements  =>  EtablissementController@index
controllers/     ->  EtablissementController, ReservationController, AuthController
models/          ->  Etablissement, Reservation, Utilisateur (PDO / MySQL)
views/           ->  (facultatif : ce front statique consomme l'API en JSON)
```

Le contrat JSON attendu par le front correspond exactement aux objets de
`data.js` (`RESTAURANTS`, `RESIDENCES`) — conservez les mêmes noms de champs
(`id`, `type`, `nom`, `ville`, `commune`, `prix`, `note`, `avis`, `equipements`,
etc.) pour un branchement sans adaptation.

---

## 💳 Paiement Mobile Money

Le widget de réservation propose déjà **Orange Money, MTN MoMo, Moov Money et
Wave**. L'intégration réelle se fait côté backend avec un agrégateur ivoirien :

- **CinetPay** ou **PayDunya** : le front envoie la réservation à
  `POST /api/reservations`, le backend initie la transaction et renvoie une URL
  de paiement (redirection) ou un statut à *poller*.

---

## 🌍 Spécificités Côte d'Ivoire

- Prix affichés en **FCFA** (`Intl.NumberFormat('fr-FR')`).
- Découpage géographique par **communes d'Abidjan** (Cocody, Plateau, Marcory,
  Yopougon…) + grandes villes (Bouaké, Yamoussoukro, San-Pédro) — voir
  `BookingCI.VILLES`.
- Interface **100 % en français**.
- Validation des **numéros ivoiriens** (`+225` + 10 chiffres) dans `main.js`.

---

## ✅ À faire pour la mise en production

1. Remplacer l'API simulée par de vrais appels `fetch()` (voir ci-dessus).
2. Déposer les vraies photos dans `assets/images/` et remplacer l'appel à
   `BookingCI.placeholder()` par les URLs réelles.
3. Renseigner les coordonnées `coord: [lat, lng]` réelles de chaque
   établissement (la carte Leaflet est déjà en place — voir `data.js`).
4. Brancher l'authentification (JWT ou sessions) et sécuriser les endpoints.
5. Intégrer CinetPay / PayDunya pour les paiements Mobile Money.

> **Note tuiles cartographiques** : les tuiles OpenStreetMap publiques
> conviennent au développement. En production à fort trafic, prévoyez un
> fournisseur de tuiles dédié (MapTiler, Stadia Maps, ou une instance OSM)
> conformément à la politique d'usage d'OpenStreetMap.
