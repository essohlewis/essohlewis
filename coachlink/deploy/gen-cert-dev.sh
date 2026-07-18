#!/usr/bin/env bash
# ==========================================================================
# deploy/gen-cert-dev.sh — Génère un certificat AUTO-SIGNÉ pour tester HTTPS
# en local (jamais en production — utilisez Let's Encrypt / certbot).
#
# Usage : deploy/gen-cert-dev.sh [dossier_sortie]  (défaut : ./deploy/certs)
# ==========================================================================
set -euo pipefail
OUT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/certs}"
mkdir -p "$OUT"
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$OUT/key.pem" -out "$OUT/cert.pem" -days 365 \
  -subj "/C=CI/O=CoachLink CI (dev)/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>/dev/null
echo "✓ Certificat auto-signé généré :"
echo "   $OUT/cert.pem"
echo "   $OUT/key.pem"
