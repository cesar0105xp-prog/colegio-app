#!/usr/bin/env bash
# Respaldo diario del portal: base de datos (pg_dump) + archivos subidos.
# Conserva 14 días. Instalado en el VPS como /home/portal/backup.sh y
# programado en el crontab del usuario portal:
#   0 3 * * * /home/portal/backup.sh >> /home/portal/backups/backup.log 2>&1
set -euo pipefail
cd /home/portal   # independiente del directorio desde el que se invoque (cron, sudo)
DEST=/home/portal/backups; mkdir -p "$DEST"
FECHA=$(date +%Y%m%d-%H%M)
DBURL=$(sed -E 's/^DATABASE_URL="?([^"]*)"?$/\1/' /home/portal/DATABASE_URL.txt)
pg_dump -Fc -f "$DEST/colegio-$FECHA.dump" "$DBURL"
tar -czf "$DEST/uploads-$FECHA.tgz" -C /home/portal/colegio-app/backend uploads
find "$DEST" -type f -mtime +14 -delete
echo "$(date '+%F %T') respaldo OK: $DEST/colegio-$FECHA.dump"
