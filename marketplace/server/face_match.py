#!/usr/bin/env python3
"""
face_match.py — Comparaison biométrique de deux images (pièce d'identité vs
selfie) pour le backend Node.js. Utilise dlib / ResNet via face_recognition
(modèles fournis par PyPI, aucun téléchargement CDN).

Usage :   python3 face_match.py <image_piece> <image_selfie>
Sortie :  JSON sur stdout  { match, score, distance, faces:{id,selfie} }

Dépendances : pip install face_recognition face_recognition_models dlib Pillow numpy
"""

import json
import sys

TOLERANCE = 0.6  # distance dlib ; en dessous = même personne


def encode(path):
    import face_recognition
    img = face_recognition.load_image_file(path)
    boxes = face_recognition.face_locations(img, model="hog")
    if not boxes:
        return None, 0
    boxes.sort(key=lambda b: (b[2] - b[0]) * (b[1] - b[3]), reverse=True)
    encs = face_recognition.face_encodings(img, known_face_locations=boxes[:1])
    return (encs[0] if encs else None), len(boxes)


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "usage: face_match.py <id> <selfie>"}))
        return
    try:
        import numpy as np
        enc_id, n_id = encode(sys.argv[1])
        enc_selfie, n_selfie = encode(sys.argv[2])
        out = {"faces": {"id": n_id, "selfie": n_selfie}}
        if enc_id is None or enc_selfie is None:
            out.update({"match": False, "score": 0, "distance": None,
                        "error": "no_face_on_id" if enc_id is None else "no_face_on_selfie"})
        else:
            dist = float(np.linalg.norm(enc_id - enc_selfie))
            out.update({"match": bool(dist <= TOLERANCE),
                        "score": int(max(0, min(100, round((1.0 - dist) * 100)))),
                        "distance": round(dist, 4)})
        print(json.dumps(out))
    except Exception as e:  # pragma: no cover
        print(json.dumps({"match": False, "score": 0, "error": "internal:" + str(e)}))


if __name__ == "__main__":
    main()
