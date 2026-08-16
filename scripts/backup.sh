#!/usr/bin/env bash
# MK Paper Mill ERP — nightly DB backup (pg_dump). Keeps 14 days.
# Cron (2am daily):  0 2 * * * /opt/mkerp/scripts/backup.sh >> /var/log/mkerp-backup.log 2>&1
set -euo pipefail

DB_NAME="${DB_NAME:-mk_paper_mill}"
DB_USER="${DB_USER:-postgres}"
DIR="${BACKUP_DIR:-/var/backups/mkerp}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$DIR"
STAMP=$(date +%F_%H%M)
FILE="$DIR/${DB_NAME}_${STAMP}.sql.gz"

pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$FILE"
echo "$(date) backup -> $FILE ($(du -h "$FILE" | cut -f1))"

# prune old
find "$DIR" -name "${DB_NAME}_*.sql.gz" -mtime +"$KEEP_DAYS" -delete
echo "$(date) pruned backups older than ${KEEP_DAYS}d"
