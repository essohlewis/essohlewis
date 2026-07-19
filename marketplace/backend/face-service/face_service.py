#!/usr/bin/env python3
"""
face_service.py — Microservice de reconnaissance faciale RÉELLE.

Reçoit la pièce d'identité et le selfie, détecte un visage dans chacune,
calcule des empreintes biométriques (embeddings 128-D via dlib / ResNet) et
renvoie une décision de correspondance. Consommé par le backend PHP via
KYC_FACE_MATCH_URL.

Dépendances (toutes depuis PyPI, aucun modèle à télécharger sur un CDN) :
    pip install face_recognition face_recognition_models dlib Pillow numpy
    # (face_recognition_models embarque les .dat dlib)

Lancer :
    python3 face_service.py            # écoute sur 127.0.0.1:5000
    FACE_PORT=5001 FACE_TOLERANCE=0.6 python3 face_service.py

API :
    GET  /health          -> {"ok": true}
    POST /                 body JSON {"idImage": "...", "selfie": "..."}
                           (data-URL ou base64 brut)
         -> {"match": bool, "score": 0..100, "distance": float,
             "faces": {"id": n, "selfie": n}}

Aucun framework web : bibliothèque standard (http.server) uniquement.
"""

import base64
import io
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
import face_recognition

HOST = os.getenv("FACE_HOST", "127.0.0.1")
PORT = int(os.getenv("FACE_PORT", "5000"))
# Seuil de distance en dessous duquel on considère qu'il s'agit de la même
# personne (0.6 = recommandation de dlib ; plus bas = plus strict).
TOLERANCE = float(os.getenv("FACE_TOLERANCE", "0.6"))
MAX_BYTES = int(os.getenv("FACE_MAX_BYTES", str(6 * 1024 * 1024)))
# Détection de vivacité : seuils.
EAR_CLOSED = float(os.getenv("LIVE_EAR_CLOSED", "0.20"))   # œil fermé
EAR_OPEN = float(os.getenv("LIVE_EAR_OPEN", "0.26"))       # œil ouvert
MOTION_MIN = float(os.getenv("LIVE_MOTION_MIN", "1.6"))    # mouvement mini (px)

# Détecteur + prédicteur de points de repère (dlib) chargés à la demande.
_DLIB = {"det": None, "pred": None}


def _dlib():
    if _DLIB["pred"] is None:
        import dlib
        import face_recognition_models as frm
        _DLIB["det"] = dlib.get_frontal_face_detector()
        _DLIB["pred"] = dlib.shape_predictor(frm.pose_predictor_model_location())
    return _DLIB["det"], _DLIB["pred"]


def _decode_image(data_url):
    """Décode une data-URL / base64 en image RGB (numpy) ou lève ValueError."""
    if not data_url or not isinstance(data_url, str):
        raise ValueError("image manquante")
    s = data_url.strip()
    if s.startswith("data:") and "," in s:
        s = s.split(",", 1)[1]
    raw = base64.b64decode(s, validate=False)
    if len(raw) == 0 or len(raw) > MAX_BYTES:
        raise ValueError("image vide ou trop lourde")
    return face_recognition.load_image_file(io.BytesIO(raw))


def _encode(img):
    """Renvoie (embedding|None, nombre_de_visages)."""
    boxes = face_recognition.face_locations(img, model="hog")
    if not boxes:
        return None, 0
    # On garde le plus grand visage (le plus proche de l'objectif).
    boxes.sort(key=lambda b: (b[2] - b[0]) * (b[1] - b[3]), reverse=True)
    encs = face_recognition.face_encodings(img, known_face_locations=boxes[:1])
    return (encs[0] if encs else None), len(boxes)


def compare(id_data, selfie_data):
    img_id = _decode_image(id_data)
    img_selfie = _decode_image(selfie_data)
    enc_id, n_id = _encode(img_id)
    enc_selfie, n_selfie = _encode(img_selfie)
    result = {"faces": {"id": n_id, "selfie": n_selfie}}
    if enc_id is None or enc_selfie is None:
        result.update({"match": False, "score": 0, "distance": None,
                       "error": "no_face_on_id" if enc_id is None else "no_face_on_selfie"})
        return result
    distance = float(np.linalg.norm(enc_id - enc_selfie))
    # Score de confiance 0–100 (1 - distance, borné).
    score = int(max(0, min(100, round((1.0 - distance) * 100))))
    result.update({"match": bool(distance <= TOLERANCE), "score": score,
                   "distance": round(distance, 4)})
    return result


# ------------------------------------------------------------------ Vivacité
def _ear(pts):
    """Eye Aspect Ratio à partir de 6 points (x,y)."""
    a = np.linalg.norm(pts[1] - pts[5])
    b = np.linalg.norm(pts[2] - pts[4])
    c = np.linalg.norm(pts[0] - pts[3])
    return (a + b) / (2.0 * c) if c > 0 else 0.0


def _mar(m):
    """Mouth Aspect Ratio (ouverture/sourire) à partir de 6 points."""
    a = np.linalg.norm(m[1] - m[5]); b = np.linalg.norm(m[2] - m[4])
    c = np.linalg.norm(m[0] - m[3])
    return (a + b) / (2.0 * c) if c > 0 else 0.0


def _landmarks(img):
    """Renvoie (points 68x2, boîte) du plus grand visage, ou (None, None)."""
    import dlib
    det, pred = _dlib()
    rects = det(img, 1)
    if not rects:
        return None, None
    rect = max(rects, key=lambda r: r.width() * r.height())
    shp = pred(img, rect)
    pts = np.array([[shp.part(i).x, shp.part(i).y] for i in range(68)], dtype="float64")
    return pts, rect


def liveness(frames, challenge):
    """
    Analyse une rafale d'images pour détecter la vivacité (anti-photo).
    challenge : "blink" | "turn" | "smile". Renvoie {live, action, ...}.
    """
    ears, noses, mars, sizes, seen = [], [], [], [], 0
    for f in frames[:20]:
        try:
            img = _decode_image(f)
        except ValueError:
            continue
        pts, rect = _landmarks(img)
        if pts is None:
            continue
        seen += 1
        w = float(rect.width()) or 1.0
        ear = (_ear(pts[36:42]) + _ear(pts[42:48])) / 2.0
        ears.append(ear)
        noses.append(pts[30][0] / w)          # nez normalisé par la largeur
        mars.append(_mar(pts[[48, 51, 54, 57, 62, 66]]))
        sizes.append(w)
    if seen < 2:
        return {"live": False, "faces": seen, "error": "not_enough_faces"}
    # Mouvement global des repères entre trames (photo statique ≈ 0).
    ear_range = (max(ears) - min(ears)) if ears else 0
    nose_range = (max(noses) - min(noses)) if noses else 0
    mar_range = (max(mars) - min(mars)) if mars else 0
    motion = (ear_range * 100) + (nose_range * 100) + (mar_range * 60)
    blink = (min(ears) < EAR_CLOSED and max(ears) > EAR_OPEN)
    turn = nose_range > 0.06
    smile = mar_range > 0.12
    action_map = {"blink": blink, "turn": turn, "smile": smile}
    action_ok = action_map.get(challenge, blink or turn or smile)
    live = bool(action_ok or motion >= MOTION_MIN)
    return {"live": live, "action": bool(action_ok), "faces": seen,
            "challenge": challenge, "blink": bool(blink), "turn": bool(turn),
            "smile": bool(smile), "motion": round(float(motion), 2)}


class Handler(BaseHTTPRequestHandler):
    def _json(self, obj, code=200):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith("/health"):
            return self._json({"ok": True, "service": "face-match", "tolerance": TOLERANCE, "liveness": True})
        self._json({"error": "not_found"}, 404)

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            return self._json({"error": "bad_json"}, 400)
        # Détection de vivacité (rafale d'images).
        if self.path.startswith("/liveness"):
            frames = data.get("frames") or []
            if not isinstance(frames, list) or not frames:
                return self._json({"live": False, "error": "no_frames"}, 400)
            try:
                return self._json(liveness(frames, data.get("challenge", "blink")))
            except Exception as e:
                return self._json({"live": False, "error": "internal:" + str(e)}, 500)
        try:
            res = compare(data.get("idImage"), data.get("selfie"))
            self._json(res)
        except ValueError as e:
            self._json({"match": False, "score": 0, "error": str(e)}, 400)
        except Exception as e:  # pragma: no cover
            self._json({"match": False, "score": 0, "error": "internal:" + str(e)}, 500)

    def log_message(self, *a):  # silence les logs par défaut
        pass


def main():
    srv = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"[face-service] reconnaissance faciale sur http://{HOST}:{PORT} (tolérance {TOLERANCE})")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        srv.shutdown()


if __name__ == "__main__":
    main()
