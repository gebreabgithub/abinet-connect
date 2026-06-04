#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-/opt/abinet-connect}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/abinet-connect}"
DATA_FILE="$APP_DIR/backend/data.json"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"
cp "$DATA_FILE" "$BACKUP_DIR/data-$STAMP.json"
find "$BACKUP_DIR" -name 'data-*.json' -type f -mtime +14 -delete

