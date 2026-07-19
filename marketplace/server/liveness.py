#!/usr/bin/env python3
"""
liveness.py — Détection de vivacité *active* (anti-photo) pour le backend Node.

Analyse une rafale d'images capturées en direct pendant que le vendeur cligne
des yeux et bouge légèrement la tête. On utilise les 68 repères faciaux dlib
(via face_recognition) pour :
  • détecter un clignement (Eye Aspect Ratio qui chute puis remonte) ;
  • mesurer un mouvement naturel de la tête entre les images.
Une photo imprimée ou une capture d'écran présentée à la caméra ne cligne pas
et ne bouge pas de façon cohérente : elle échoue au test.

Usage :   python3 liveness.py <frame1> <frame2> ... <frameN>
Sortie :  JSON sur stdout
          { live, blink, motion, frames, framesWithFace, earMin, earMax,
            motionScore, reason }

NB : c'est une vivacité *active* (défi-réponse). Elle bloque efficacement les
photos/écrans figés ; un anti-deepfake vidéo complet demanderait en plus un
modèle de texture/rPPG dédié.

Dépendances : pip install face_recognition face_recognition_models dlib Pillow numpy
"""

import json
import sys

# Seuils empiriques (yeux ouverts ~0.30, fermés < 0.20).
EAR_OPEN = 0.24          # au-dessus = œil franchement ouvert
EAR_CLOSED = 0.19        # en dessous = œil fermé (clignement)
MOTION_MIN = 0.010       # déplacement inter-images (fraction de la largeur du visage)


def _ear(eye):
    """Eye Aspect Ratio d'une liste de 6 points (contour d'un œil)."""
    import numpy as np
    p = [np.array(pt, dtype=float) for pt in eye]
    if len(p) < 6:
        return None
    a = np.linalg.norm(p[1] - p[5])
    b = np.linalg.norm(p[2] - p[4])
    c = np.linalg.norm(p[0] - p[3])
    if c == 0:
        return None
    return (a + b) / (2.0 * c)


def _analyze(path):
    """Renvoie (ear_moyen, centre_du_visage, largeur_visage) ou (None, None, None)."""
    import face_recognition
    import numpy as np
    img = face_recognition.load_image_file(path)
    boxes = face_recognition.face_locations(img, model="hog")
    if not boxes:
        return None, None, None
    boxes.sort(key=lambda b: (b[2] - b[0]) * (b[1] - b[3]), reverse=True)
    box = boxes[0]
    marks = face_recognition.face_landmarks(img, face_locations=[box])
    if not marks:
        return None, None, None
    m = marks[0]
    le, re = m.get("left_eye"), m.get("right_eye")
    ears = [e for e in (_ear(le) if le else None, _ear(re) if re else None) if e is not None]
    ear = sum(ears) / len(ears) if ears else None
    top, right, bottom, left = box
    width = float(right - left) or 1.0
    center = np.array([(left + right) / 2.0, (top + bottom) / 2.0], dtype=float)
    return ear, center, width


def main():
    frames = sys.argv[1:]
    if len(frames) < 2:
        print(json.dumps({"live": False, "reason": "frames_insuffisantes"}))
        return
    try:
        import numpy as np
        ears, centers, widths = [], [], []
        for f in frames:
            ear, center, width = _analyze(f)
            if center is not None:
                if ear is not None:
                    ears.append(ear)
                centers.append(center)
                widths.append(width)

        framesWithFace = len(centers)
        if framesWithFace < 2:
            print(json.dumps({"live": False, "blink": False, "motion": False,
                              "frames": len(frames), "framesWithFace": framesWithFace,
                              "reason": "visage_absent"}))
            return

        # Clignement : l'œil doit être franchement ouvert à un moment ET fermé à un autre.
        ear_min = min(ears) if ears else None
        ear_max = max(ears) if ears else None
        blink = bool(ears and ear_min < EAR_CLOSED and ear_max > EAR_OPEN)

        # Mouvement : déplacement max du centre du visage, normalisé par sa largeur.
        w = float(np.median(widths))
        max_disp = 0.0
        for i in range(1, len(centers)):
            d = float(np.linalg.norm(centers[i] - centers[i - 1])) / w
            if d > max_disp:
                max_disp = d
        motion = bool(max_disp >= MOTION_MIN)

        live = bool(blink or motion)
        reason = "ok" if live else "ni_clignement_ni_mouvement"
        print(json.dumps({
            "live": live, "blink": blink, "motion": motion,
            "frames": len(frames), "framesWithFace": framesWithFace,
            "earMin": round(ear_min, 4) if ear_min is not None else None,
            "earMax": round(ear_max, 4) if ear_max is not None else None,
            "motionScore": round(max_disp, 4), "reason": reason,
        }))
    except Exception as e:  # pragma: no cover
        print(json.dumps({"live": False, "error": "internal:" + str(e)}))


if __name__ == "__main__":
    main()
