# Backend Node.js (Express) — Vérification d'identité + reconnaissance faciale

Backend pour la **vérification d'identité des vendeurs** de Marché CI :
pièce d'identité + selfie capturé en direct, **comparaison biométrique
automatique** des deux visages, et back-office de revue **stylé avec Tailwind CSS**.

La marketplace front existante reste inchangée : ce serveur la sert telle quelle
et y ajoute l'API + deux nouvelles pages.

## Prérequis
- **Node.js 18+** (testé sur Node 22).
- Pour la reconnaissance faciale **automatique** : **Python 3** avec
  `face_recognition` (dlib). Sans lui, tout fonctionne mais la comparaison des
  visages devient une **décision manuelle de l'administrateur**.
  ```bash
  pip install face_recognition face_recognition_models dlib Pillow numpy
  ```

## Installation & lancement
```bash
cd server
npm install
npm run build:css      # compile Tailwind → public/tailwind.css (déjà fourni)
npm start              # démarre sur http://localhost:3000
```
Ouvrez ensuite :
- **Marketplace** : http://localhost:3000/
- **Vérification vendeur** (page Tailwind) : http://localhost:3000/verify
- **Revue admin** (page Tailwind) : http://localhost:3000/admin/kyc
  (jeton par défaut `admin-demo-token`, modifiable via `KYC_ADMIN_TOKEN`)

Le front détecte automatiquement le serveur : le bouton « Vérifier mon
identité » du vendeur ouvre alors la page `/verify`, et l'onglet Sécurité de
l'admin propose un lien vers `/admin/kyc`. Sans serveur (ouverture `file://`),
la vérification retombe sur le mode 100 % local (localStorage).

## Pile technique
- **Express** : API + service statique (marketplace + pages Tailwind).
- **Tailwind CSS** (`src/input.css` → `public/tailwind.css`) : nouvelles pages.
- **Reconnaissance faciale** : `face.js` délègue à `face_match.py`
  (dlib/ResNet, embeddings 128-D, modèles fournis par PyPI — aucun CDN).
- **Stockage** : fichier JSON (`data/kyc.json`) + images sur disque
  (`data/uploads/`, ignorés par Git).

## Endpoints (`/api/kyc/…`)
| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET | `/health` | public | État du service + reconnaissance faciale |
| POST | `/submit` | vendeur | pièce + selfie → comparaison + statut `pending` |
| GET | `/status?vendorId=` | vendeur | statut d'un vendeur |
| GET | `/list?status=` | admin | file des vérifications |
| POST | `/review` | admin | `approve` / `reject` (+ motif) |
| GET | `/image/:id/:kind` | admin | sert une image (`id`/`selfie`) |

## Résultats de référence (validés)
Même personne → `match:true`, score ~87 ; personnes différentes → `match:false`,
score ~19 ; absence de visage → rejet.

## Sécurité / production
- Servez en **HTTPS**, changez `KYC_ADMIN_TOKEN`, restreignez le CORS.
- **Chiffrez** et **purgez** les pièces d'identité après décision (RGPD).
- Ajoutez une **détection de vivacité** (anti-photo) pour un usage réel.
