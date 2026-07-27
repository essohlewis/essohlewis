#!/usr/bin/env bash
# =============================================================================
#  Amoura — sauvegarde MySQL avec rotation (Phase 1, mise en production).
#
#  Usage :
#    ./scripts/backup.sh                 # sauvegarde dans ./storage/backups
#    BACKUP_DIR=/data/backups ./scripts/backup.sh
#
#  Restauration :
#    gunzip < storage/backups/amoura-2026-07-27_0200.sql.gz \
#      | mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME"
#
#  Planification (cron quotidien à 2 h) :
#    0 2 * * *  /chemin/amoura/scripts/backup.sh >> /chemin/amoura/storage/logs/backup.log 2>&1
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Charge les variables DB_* depuis .env (sans polluer l'environnement global).
if [[ -f "$ROOT/.env" ]]; then
    # shellcheck disable=SC2046
    export $(grep -E '^(DB_HOST|DB_PORT|DB_NAME|DB_USER|DB_PASS)=' "$ROOT/.env" | sed 's/#.*//' | xargs) || true
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-amoura}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-}"

BACKUP_DIR="${BACKUP_DIR:-$ROOT/storage/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y-%m-%d_%H%M)"
OUT="$BACKUP_DIR/amoura-$STAMP.sql.gz"

echo "[$(date -Iseconds)] Sauvegarde de '$DB_NAME' → $OUT"

# --single-transaction : dump cohérent sans verrouiller (InnoDB).
mysqldump \
    -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" ${DB_PASS:+-p"$DB_PASS"} \
    --single-transaction --quick --routines --triggers --events \
    --default-character-set=utf8mb4 \
    "$DB_NAME" | gzip -9 > "$OUT"

echo "[$(date -Iseconds)] OK — $(du -h "$OUT" | cut -f1)"

# Rotation : supprime les sauvegardes plus vieilles que RETENTION_DAYS.
find "$BACKUP_DIR" -name 'amoura-*.sql.gz' -type f -mtime +"$RETENTION_DAYS" -print -delete \
    | sed 's/^/[rotation] supprimé: /' || true
