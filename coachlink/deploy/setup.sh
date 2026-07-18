#!/usr/bin/env bash
# ==========================================================================
# deploy/setup.sh — Prépare CoachLink CI pour la production (ou un test local).
#
#   - génère un jwt_secret aléatoire fort,
#   - crée api/config/coachlink.env (secrets, chmod 600) depuis l'exemple,
#   - installe api/config/config.php (config de production, lit l'env),
#   - crée js/config.js (front en mode API),
#   - fixe les permissions de uploads/ et du cache,
#   - (optionnel) exécute la migration de la base.
#
# Usage :  deploy/setup.sh [--migrate] [--sqlite] [--force]
#   --migrate  lance php database/migrate.php après l'installation
#   --sqlite   configure SQLite (pratique pour tester ; défaut = MySQL)
#   --force    écrase un coachlink.env / config.php existant
# ==========================================================================
set -euo pipefail

MIGRATE=0; SQLITE=0; FORCE=0
for a in "$@"; do
  case "$a" in
    --migrate) MIGRATE=1 ;;
    --sqlite)  SQLITE=1 ;;
    --force)   FORCE=1 ;;
    *) echo "Option inconnue : $a" >&2; exit 2 ;;
  esac
done

# Racine du projet = dossier parent de deploy/
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API="$ROOT/api"
ENV_FILE="$API/config/coachlink.env"
CONFIG_FILE="$API/config/config.php"

echo "→ Projet : $ROOT"

# 1) Secret JWT ------------------------------------------------------------
JWT="$(openssl rand -hex 32)"

# 2) Fichier d'environnement (secrets) ------------------------------------
if [[ -f "$ENV_FILE" && "$FORCE" -ne 1 ]]; then
  echo "✓ $ENV_FILE existe déjà (utilisez --force pour régénérer)."
else
  cp "$ROOT/deploy/coachlink.env.example" "$ENV_FILE"
  # Injecte le secret généré (compatible BSD/GNU sed).
  if sed --version >/dev/null 2>&1; then
    sed -i "s|^CL_JWT_SECRET=.*|CL_JWT_SECRET=$JWT|" "$ENV_FILE"
  else
    sed -i '' "s|^CL_JWT_SECRET=.*|CL_JWT_SECRET=$JWT|" "$ENV_FILE"
  fi
  if [[ "$SQLITE" -eq 1 ]]; then
    if sed --version >/dev/null 2>&1; then
      sed -i "s|^CL_DB_DRIVER=.*|CL_DB_DRIVER=sqlite|" "$ENV_FILE"
    else
      sed -i '' "s|^CL_DB_DRIVER=.*|CL_DB_DRIVER=sqlite|" "$ENV_FILE"
    fi
    printf '\nCL_SQLITE_PATH=%s\n' "$API/database/coachlink.sqlite" >> "$ENV_FILE"
  fi
  chmod 600 "$ENV_FILE"
  echo "✓ Secrets écrits : $ENV_FILE (chmod 600, jwt_secret généré)"
fi

# 3) Configuration de l'API -----------------------------------------------
if [[ -f "$CONFIG_FILE" && "$FORCE" -ne 1 ]]; then
  echo "✓ $CONFIG_FILE existe déjà (utilisez --force pour remplacer)."
else
  cp "$ROOT/deploy/config.production.php" "$CONFIG_FILE"
  echo "✓ Config installée : $CONFIG_FILE (lit coachlink.env)"
fi

# 4) Configuration du front ------------------------------------------------
if [[ ! -f "$ROOT/js/config.js" || "$FORCE" -eq 1 ]]; then
  cp "$ROOT/js/config.example.js" "$ROOT/js/config.js"
  echo "✓ Front en mode API : js/config.js (pensez à décommenter son <script> dans index.html)"
fi

# 5) Permissions -----------------------------------------------------------
mkdir -p "$API/uploads"
touch "$API/uploads/.gitkeep"
CACHE_DIR="$(grep -E '^CL_CACHE_DIR=' "$ENV_FILE" | cut -d= -f2- || true)"
[[ -n "${CACHE_DIR:-}" ]] && mkdir -p "$CACHE_DIR" 2>/dev/null || true
echo "✓ Dossiers uploads/ et cache prêts"

# 6) Migration (optionnelle) ----------------------------------------------
if [[ "$MIGRATE" -eq 1 ]]; then
  echo "→ Migration de la base…"
  ( cd "$API" && php database/migrate.php )
fi

cat <<EOF

============================================================================
 Installation terminée.

 À FAIRE ENSUITE (édition de $ENV_FILE) :
   • CL_APP_URL / CL_CORS_ORIGINS  → votre domaine (https://…)
   • CL_DB_PASSWORD                → mot de passe MySQL
   • intégrations (paiement/mail/oauth) : passez les *_ACTIF à true + clés

 Puis :
   • serveur web : voir deploy/apache/ ou deploy/nginx/ + certbot (HTTPS)
   • migrer la base : (cd api && php database/migrate.php)
   • CHANGER le mot de passe admin (admin@coachlink.ci / admin123)
============================================================================
EOF
