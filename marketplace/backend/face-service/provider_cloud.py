#!/usr/bin/env python3
"""
provider_cloud.py — Variante « cloud » du microservice de reconnaissance
faciale, exposant le MÊME contrat HTTP que face_service.py mais déléguant la
comparaison à un fournisseur externe :

    FACE_PROVIDER=facepp   -> Face++ (Megvii)      — via urllib, sans dépendance
    FACE_PROVIDER=aws      -> AWS Rekognition       — via boto3 (pip install boto3)

Le backend PHP appelle ce service via KYC_FACE_MATCH_URL, exactement comme la
version locale (dlib). Contrat :
    POST /   {"idImage": dataURL|b64, "selfie": dataURL|b64}
      -> {"match": bool, "score": 0..100, "provider": "..."}

Variables d'environnement :
    FACE_PROVIDER      "facepp" | "aws"           (défaut: facepp)
    FACE_MATCH_THRESHOLD  seuil de confiance %    (défaut: 80)
    # Face++ :
    FACEPP_KEY, FACEPP_SECRET
    # AWS :
    AWS_REGION (défaut eu-west-1) + identifiants standard AWS
"""

import base64
import json
import os
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = os.getenv("FACE_HOST", "127.0.0.1")
PORT = int(os.getenv("FACE_PORT", "5000"))
PROVIDER = os.getenv("FACE_PROVIDER", "facepp").lower()
THRESHOLD = float(os.getenv("FACE_MATCH_THRESHOLD", "80"))


def _raw_b64(data_url):
    s = (data_url or "").strip()
    if s.startswith("data:") and "," in s:
        s = s.split(",", 1)[1]
    return s


# ------------------------------------------------------------------ Face++
def match_facepp(id_b64, selfie_b64):
    key, secret = os.getenv("FACEPP_KEY"), os.getenv("FACEPP_SECRET")
    if not key or not secret:
        raise RuntimeError("FACEPP_KEY / FACEPP_SECRET manquants")
    fields = {
        "api_key": key, "api_secret": secret,
        "image_base64_1": _raw_b64(id_b64), "image_base64_2": _raw_b64(selfie_b64),
    }
    data = urllib.parse.urlencode(fields).encode()
    req = urllib.request.Request(
        "https://api-us.faceplusplus.com/facepp/v3/compare", data=data)
    with urllib.request.urlopen(req, timeout=30) as r:
        j = json.loads(r.read())
    conf = float(j.get("confidence", 0) or 0)  # 0..100
    return {"match": conf >= THRESHOLD, "score": int(round(conf)), "provider": "facepp"}


# --------------------------------------------------------------- AWS Rekognition
def match_aws(id_b64, selfie_b64):
    import boto3  # nécessite: pip install boto3
    client = boto3.client("rekognition", region_name=os.getenv("AWS_REGION", "eu-west-1"))
    resp = client.compare_faces(
        SourceImage={"Bytes": base64.b64decode(_raw_b64(id_b64))},
        TargetImage={"Bytes": base64.b64decode(_raw_b64(selfie_b64))},
        SimilarityThreshold=0,
    )
    matches = resp.get("FaceMatches", [])
    if not matches:
        return {"match": False, "score": 0, "provider": "aws", "error": "no_match"}
    sim = float(matches[0]["Similarity"])  # 0..100
    return {"match": sim >= THRESHOLD, "score": int(round(sim)), "provider": "aws"}


PROVIDERS = {"facepp": match_facepp, "aws": match_aws}


class Handler(BaseHTTPRequestHandler):
    def _json(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith("/health"):
            return self._json({"ok": True, "provider": PROVIDER, "threshold": THRESHOLD})
        self._json({"error": "not_found"}, 404)

    def do_POST(self):
        try:
            n = int(self.headers.get("Content-Length", 0))
            data = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            return self._json({"error": "bad_json"}, 400)
        fn = PROVIDERS.get(PROVIDER)
        if not fn:
            return self._json({"error": "unknown_provider:" + PROVIDER}, 500)
        try:
            self._json(fn(data.get("idImage"), data.get("selfie")))
        except Exception as e:
            self._json({"match": False, "score": 0, "error": str(e)}, 502)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    print(f"[face-cloud] fournisseur={PROVIDER} sur http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
