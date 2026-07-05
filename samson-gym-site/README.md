# Samson Gym — Site vitrine

Site vitrine du **Centre Sportif Samson Gym** (Angré 22e, Abidjan) : présentation
du centre, planning des cours collectifs, coachs, tarifs, équipements et contact.

Site **100 % statique** (HTML / CSS / JavaScript, sans build ni dépendance
serveur) — hébergeable tel quel sur n'importe quel hébergement statique
(GitHub Pages, Netlify, Vercel, OVH, un simple dossier Apache/Nginx…).

## Structure

```
samson-gym-site/
├── index.html          Accueil (hero, stats, aperçu planning, témoignages)
├── cours.html          Planning des cours + filtres par jour
├── coachs.html         Les coachs + quiz « trouvez votre cours »
├── tarifs.html         Tarifs (séance / abonnement) + FAQ
├── equipements.html    Équipements du centre
├── contact.html        Coordonnées + formulaire (→ WhatsApp)
├── offline.html        Page affichée hors connexion (PWA)
├── manifest.json       Manifeste PWA (installation sur mobile)
├── sw.js               Service worker (cache + mode hors ligne)
├── robots.txt          Indexation
├── sitemap.xml         Plan du site
├── css/style.css       Design system + composants
├── js/script.js        Interactions partagées
└── assets/             Favicon, icônes PWA, image de partage social
```

## Lancer en local

Le site a besoin d'être servi en HTTP (le service worker ne fonctionne pas
via `file://`). Au choix :

```bash
# Python
python3 -m http.server 8080 --directory samson-gym-site

# ou Node
npx serve samson-gym-site
```

Puis ouvrir <http://localhost:8080>.

## Avant la mise en ligne

1. Remplacer le domaine `https://samsongym.ci` (URL canoniques, Open Graph,
   `sitemap.xml`, `robots.txt`, données structurées JSON-LD) par le domaine réel.
2. Vérifier le numéro WhatsApp dans `js/script.js` (`SAMSON_WA`) et les liens
   `wa.me` des pages.
3. Renseigner les vraies URLs Facebook / Instagram (footer + `sameAs` du JSON-LD).
4. (Optionnel) Remplacer la carte statique de la page contact par un iframe
   Google Maps / OpenStreetMap réel.

Voir [`IMPROVEMENTS.md`](IMPROVEMENTS.md) pour le détail des améliorations
et innovations apportées.
