# Microservice de reconnaissance faciale

Service **biométrique réel** appelé par le backend PHP (`KYC_FACE_MATCH_URL`)
pour comparer automatiquement le **selfie** au visage de la **pièce d'identité**
et décider de la correspondance. Deux implémentations, même contrat HTTP :

| Fichier | Fournisseur | Dépendances | Coût |
|---|---|---|---|
| `face_service.py` | **Local (dlib / ResNet)** — par défaut, testé | PyPI uniquement, hors-ligne | gratuit |
| `provider_cloud.py` | **Face++** ou **AWS Rekognition** | urllib / boto3 + clés API | payant |

## Contrat HTTP (identique pour les deux)
```
GET  /health  -> {"ok": true, "liveness": true, ...}
POST /        {"idImage": "<dataURL|base64>", "selfie": "<dataURL|base64>"}
     -> {"match": true|false, "score": 0..100, ...}
POST /liveness  {"frames": ["<b64>", ...], "challenge": "blink|turn|smile"}
     -> {"live": true|false, "action": bool, "motion": float, ...}
```

### Détection de vivacité (anti-photo / anti-deepfake)
Le service `face_service.py` expose aussi `/liveness` : il reçoit une **rafale
d'images** (capturée pendant que l'utilisateur suit une consigne aléatoire —
cligner, tourner la tête, sourire) et détecte le mouvement facial via les
points de repère dlib (EAR pour le clignement, déplacement du nez pour la
rotation, MAR pour le sourire). Une **photo statique** présentée à la caméra
donne un mouvement nul → `live: false` (rejetée). Résultats validés :
photo statique → `live:false, motion:0` ; tête qui bouge → `live:true`.

## Option A — Local (dlib), recommandée pour l'auto-hébergement
Reconnaissance faciale **100 % locale**, sans clé ni cloud. Les modèles dlib
sont fournis par le paquet PyPI `face_recognition_models` (rien à télécharger
sur un CDN).

```bash
cd backend/face-service
pip install -r requirements.txt          # face_recognition, dlib, Pillow, numpy
python3 face_service.py                    # écoute sur 127.0.0.1:5000
```
Puis lancez le backend PHP avec le hook activé (depuis `marketplace/`) :
```bash
KYC_FACE_MATCH_URL="http://127.0.0.1:5000/" php -S localhost:8000
```

Réglages (variables d'environnement) : `FACE_PORT` (5000), `FACE_TOLERANCE`
(0.6 — plus bas = plus strict).

**Résultats de référence** (validés) : même personne → `match:true` (score ~87,
distance ~0.13) ; personnes différentes → `match:false` (score ~19,
distance ~0.81) ; absence de visage → `match:false, error:"no_face_..."`.

## Option B — Cloud (Face++ / AWS Rekognition)
Même contrat, comparaison déléguée à un fournisseur.

Face++ (sans dépendance) :
```bash
FACE_PROVIDER=facepp FACEPP_KEY=xxx FACEPP_SECRET=yyy python3 provider_cloud.py
```
AWS Rekognition (`pip install boto3`, identifiants AWS configurés) :
```bash
FACE_PROVIDER=aws AWS_REGION=eu-west-1 python3 provider_cloud.py
```
Puis pointez le PHP dessus : `KYC_FACE_MATCH_URL="http://127.0.0.1:5000/"`.

## Comment ça s'enchaîne
1. Le vendeur envoie pièce + selfie (capture caméra) → `backend/api.php?action=submit`.
2. `api.php` appelle `external_face_match()` (dans `lib.php`) sur `KYC_FACE_MATCH_URL`.
3. Le microservice renvoie `{match, score}` ; le PHP enregistre `similarity` et
   `auto_match`. L'onglet Sécurité admin affiche le résultat ; la décision peut
   être **automatique** (auto_match) ou confirmée par l'administrateur.
4. Sans `KYC_FACE_MATCH_URL`, le PHP retombe sur une heuristique (qualité +
   similarité perceptuelle) et la validation reste manuelle.

## Sécurité / production
- Le service ne doit être joignable que par le backend PHP (réseau interne /
  `127.0.0.1`), jamais exposé publiquement.
- Chiffrez et **purgez** les images d'identité après décision (RGPD / vie privée).
- Ajoutez une détection de vivacité (anti-photo/anti-deepfake) pour un usage réel.
