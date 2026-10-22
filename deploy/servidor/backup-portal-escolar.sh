#!/usr/bin/env bash
# Respaldo diario del Portal Escolar: base de datos (pg_dump) + archivos subidos.
#
#   Destino:    /var/backups/portal-escolar/
#   Retención:  últimos 7 días
#   Programado: /etc/cron.d/portal-escolar (2:00 a. m. hora de Colombia)
#
# Se ejecuta como root. Cada archivo se escribe primero con un nombre temporal y
# solo se renombra si terminó bien, así un respaldo a medias nunca reemplaza ni
# se confunde con uno válido. El dump se comprueba con pg_restore antes de darlo
# por bueno.
set -Eeuo pipefail

DEST=/var/backups/portal-escolar
APP=/home/portal/colegio-app
BD=colegio_db
RETENCION_DIAS=7
FECHA=$(date +%Y%m%d-%H%M)

trap 'logger -t backup-portal -p user.err "FALLÓ el respaldo (línea $LINENO)"; echo "$(date "+%F %T") ✖ FALLÓ el respaldo (línea $LINENO)"' ERR

umask 077
mkdir -p "$DEST"
chmod 700 "$DEST"
cd /   # pg_dump como postgres no puede entrar al directorio de root

# 1) Base de datos
sudo -u postgres pg_dump -Fc "$BD" > "$DEST/.colegio-$FECHA.dump.parcial"
pg_restore --list "$DEST/.colegio-$FECHA.dump.parcial" > /dev/null
mv "$DEST/.colegio-$FECHA.dump.parcial" "$DEST/colegio-$FECHA.dump"

# 2) Archivos subidos (documentos, comprobantes)
tar -czf "$DEST/.uploads-$FECHA.tgz.parcial" -C "$APP/backend" uploads
mv "$DEST/.uploads-$FECHA.tgz.parcial" "$DEST/uploads-$FECHA.tgz"

# 3) Retención: -mtime +6 borra los de 7 días o más → quedan los últimos 7
find "$DEST" -maxdepth 1 -type f \( -name 'colegio-*.dump' -o -name 'uploads-*.tgz' \) -mtime +$((RETENCION_DIAS - 1)) -delete
find "$DEST" -maxdepth 1 -type f -name '.*.parcial' -mmin +120 -delete

RESUMEN="colegio-$FECHA.dump ($(du -h "$DEST/colegio-$FECHA.dump" | cut -f1)) + uploads-$FECHA.tgz ($(du -h "$DEST/uploads-$FECHA.tgz" | cut -f1)) · $(ls "$DEST"/colegio-*.dump | wc -l) respaldos guardados"
logger -t backup-portal "respaldo OK: $RESUMEN"
echo "$(date '+%F %T') ✔ respaldo OK: $RESUMEN"
