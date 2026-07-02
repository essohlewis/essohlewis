#!/usr/bin/env bash
set -e

APP_DIR=/var/www/html

# ── Génère un .env à partir des variables d'environnement du conteneur ──────
# (uniquement s'il n'existe pas déjà — on ne surcharge jamais un .env fourni).
if [ ! -f "$APP_DIR/.env" ]; then
    echo "▶ Génération de $APP_DIR/.env depuis l'environnement..."
    cat > "$APP_DIR/.env" <<EOF
APP_NAME=${APP_NAME:-Transouscris}
APP_ENV=${APP_ENV:-local}
APP_DEBUG=${APP_DEBUG:-true}
APP_URL=${APP_URL:-http://localhost:8080}
APP_KEY=${APP_KEY:-}
APP_TIMEZONE=${APP_TIMEZONE:-Africa/Abidjan}

DB_HOST=${DB_HOST:-mysql}
DB_PORT=${DB_PORT:-3306}
DB_NAME=${DB_NAME:-transouscris}
DB_USER=${DB_USER:-transouscris}
DB_PASS=${DB_PASS:-transouscris}

SESSION_LIFETIME=${SESSION_LIFETIME:-7200}
SESSION_SECURE=${SESSION_SECURE:-false}
OTP_TTL=${OTP_TTL:-300}
OTP_MAX_ATTEMPTS=${OTP_MAX_ATTEMPTS:-5}
RECHARGE_GUARANTEE_DELAY=${RECHARGE_GUARANTEE_DELAY:-900}
EOF
fi

# Dossiers d'exécution accessibles en écriture.
mkdir -p "$APP_DIR/storage/logs" "$APP_DIR/storage/cache"
chown -R www-data:www-data "$APP_DIR/storage" 2>/dev/null || true

# ── Attente MySQL + migration conditionnelle ───────────────────────────────
php "$APP_DIR/docker/setup.php"

# Démarre le processus principal (apache2-foreground).
exec "$@"
