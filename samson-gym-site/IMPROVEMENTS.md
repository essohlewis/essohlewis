# Améliorations & innovations — Samson Gym

Analyse du site existant puis apport d'améliorations concrètes, sans changer
la ligne graphique (palette pierre / or / rouge, typographies Anton · Oswald ·
Inter) ni casser les fonctionnalités déjà présentes.

## 🔎 Point de départ

Le site initial était déjà soigné : 6 pages responsive, thème clair/sombre,
animations au scroll, compteurs, filtres de planning, FAQ accordéon, quiz coach,
carrousel de témoignages, widget « cours de ce soir ». L'analyse a surtout révélé
des manques côté **référencement, partage, accessibilité, fiabilité** et un
potentiel d'**innovations orientées conversion** (le centre travaille par WhatsApp).

## 🐞 Corrections

| # | Problème | Correction |
|---|----------|-----------|
| 1 | **Numéro WhatsApp invalide** (`wa.me/2257572748`, tronqué) sur les 6 pages | Corrigé au format international `2250757274855` |
| 2 | **Flash de thème (FOUC)** : le mode clair n'était appliqué qu'après le chargement du JS | Script inline dans le `<head>` qui applique le thème avant le premier rendu |
| 3 | **Double gestionnaire de formulaire** sur `contact.html` (inline + partagé) | Suppression du script inline, logique centralisée dans `script.js` |
| 4 | Ombre du header pilotée par style inline | Passée en classe CSS `.scrolled` (plus propre, themable) |

## 🚀 Référencement & partage (SEO)

- **Données structurées JSON-LD** `HealthClub` sur chaque page : adresse, téléphone,
  horaires d'ouverture, gamme de prix, moyens de paiement, zone desservie — idéal
  pour le référencement local (Google, résultats enrichis).
- **Open Graph + Twitter Cards** : titre, description et **image de partage
  1200×630** générée aux couleurs du club (aperçu soigné sur WhatsApp, Facebook,
  Instagram, X…).
- **URLs canoniques**, `robots.txt` et `sitemap.xml`.
- **Favicon** (haltère SVG) + icônes d'application.

## 📱 PWA — application installable

- **`manifest.json`** : le site s'installe sur l'écran d'accueil d'un téléphone
  (nom, icônes, couleur de thème, raccourcis vers Cours / Tarifs / Contact).
- **Service worker (`sw.js`)** : mise en cache des pages et ressources.
  → **Le planning reste consultable hors connexion**, un vrai plus en mobilité.
- **`offline.html`** : page de repli élégante en cas de coupure réseau.

## ♿ Accessibilité

- **Lien d'évitement** « Aller au contenu » (navigation clavier).
- **États ARIA** : `aria-expanded` sur le menu et les accordéons, `aria-current`
  sur le lien actif, `aria-pressed` sur les onglets tarifs, `role="status"` sur
  le badge d'ouverture, labels sur les puces du carrousel.
- **Accordéon FAQ utilisable au clavier** (Entrée / Espace) + fermeture du menu
  mobile avec `Échap`.
- **Focus visible** cohérent sur tous les éléments interactifs.
- Respect de **`prefers-reduced-motion`** (animations désactivées si demandé).

## ✨ Innovations orientées conversion

1. **Badge « Ouvert maintenant »** dans le header : calcule en direct, à partir
   des horaires réels, si le centre est ouvert, fermé, ou « ouvre dans X min ».
   Se met à jour toutes les minutes.
2. **Réservation WhatsApp en un clic, sans backend** :
   - le **formulaire de contact** ouvre WhatsApp avec un message pré-rempli
     (nom, téléphone, sujet, message) ;
   - chaque **cours du planning** a un bouton « Réserver » qui pré-remplit un
     message avec le jour, le coach et l'horaire ;
   - le **widget « cours de ce soir »** et le **résultat du quiz coach** proposent
     eux aussi un bouton de réservation direct.
3. **Ajout au calendrier (.ics)** : chaque cours peut être ajouté au calendrier
   du téléphone (Google/Apple/Outlook) en **événement hebdomadaire récurrent** —
   généré côté client, aucun service tiers.

## 🧱 Qualité de code

- Planning et horaires **centralisés** dans `script.js` (source unique de vérité,
  réutilisée par le widget du soir, le quiz, les boutons de réservation et l'export
  calendrier) — fini les données dupliquées entre les widgets.
- Aucune dépendance ni étape de build ajoutée : le site reste un simple dossier
  statique.

## ✅ Vérifications effectuées

Testé sous Chromium (desktop + mobile) : aucune erreur JavaScript, service worker
enregistré, génération `.ics` fonctionnelle, liens WhatsApp valides, thème clair
et sombre sans flash, rendu responsive conservé.
