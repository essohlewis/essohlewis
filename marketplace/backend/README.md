# Backend de vérification (KYC) — PHP pur, sans framework

Ce backend gère **uniquement la vérification d'identité des vendeurs** (pièce
d'identité + selfie capturé en direct). Le reste de la marketplace reste
100 % front (localStorage) et fonctionne sans lui.

## Prérequis
- **PHP 8+** avec les extensions `pdo_sqlite`, `gd`, `json` (toutes standard).
- Aucune dépendance, aucun Composer, aucun framework.

## Lancer en local
Depuis le dossier **`marketplace/`** :

```bash
php -S localhost:8000
```

Puis ouvrez `http://localhost:8000/index.html`.
Le front détecte automatiquement le backend à `backend/api.php` (via l'action
`ping`). S'il n'est pas joignable (ex. ouverture en `file://`), la vérification
retombe sur un mode local (localStorage) — voir la note plus bas.

> ⚠️ La **capture par la caméra** exige `http(s)://` ou `localhost`. En
> ouverture par double-clic (`file://`), les navigateurs bloquent la webcam :
> lancez le serveur PHP ci-dessus.

## Données
- Base **SQLite** : `backend/data/kyc.sqlite` (créée automatiquement).
- Images : `backend/data/uploads/` (pièce + selfie).
- Le dossier `backend/data/` est **ignoré par Git** (données/pièces privées).

## Sécurité (démo)
- Les actions admin exigent l'en-tête `X-Admin-Token` (valeur par défaut
  `admin-demo-token`, à changer via la variable d'environnement
  `KYC_ADMIN_TOKEN`). Le front l'envoie automatiquement pour un compte admin.
- En production : servez en HTTPS, changez le jeton, restreignez le CORS,
  et chiffrez/expirez les pièces d'identité.

## Reconnaissance faciale
Deux niveaux, selon que le microservice biométrique est branché ou non :

1. **Sans service** (défaut) — le backend calcule en PHP (GD) un **score de
   qualité** et une **similarité perceptuelle** (aide à la décision) et
   enregistre l'indicateur « visage détecté » du navigateur ; la **décision
   finale revient à l'administrateur** (pièce et selfie côte à côte dans l'admin).

2. **Avec service biométrique RÉEL** (recommandé) — définissez
   `KYC_FACE_MATCH_URL` vers le microservice fourni dans **`face-service/`** :
   ```bash
   # 1) lancer le service de reconnaissance faciale (local, dlib) :
   cd face-service && pip install -r requirements.txt && python3 face_service.py
   # 2) lancer le PHP avec le hook (depuis marketplace/) :
   KYC_FACE_MATCH_URL="http://127.0.0.1:5000/" php -S localhost:8000
   ```
   Le PHP POST `{idImage, selfie}` au service, qui renvoie `{match, score}` :
   la **correspondance des visages est alors calculée automatiquement** (embeddings
   dlib/ResNet 128-D). `face-service/` propose aussi des adaptateurs **Face++**
   et **AWS Rekognition** (même contrat). Voir `face-service/README.md`.

## Endpoints (`backend/api.php?action=…`)
| Action | Méthode | Rôle | Description |
|---|---|---|---|
| `ping` | GET | public | Vérifie que le backend répond |
| `submit` | POST | vendeur | Envoie pièce + selfie (base64) → statut `pending` |
| `status` | GET | vendeur | Statut d'un vendeur (`vendorId`) |
| `list` | GET | admin | File des vérifications (`status=pending|all`) |
| `review` | POST | admin | `approve` / `reject` (+ motif) |
| `image` | GET | admin | Sert une image (`kind=id|idback|selfie`) |
