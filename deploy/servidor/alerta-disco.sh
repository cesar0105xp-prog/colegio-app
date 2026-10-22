#!/usr/bin/env bash
# Alerta de disco del Portal Escolar.
#
# Si el disco raíz supera el umbral (80 % por defecto): lo registra en syslog
# (`journalctl -t alerta-disco`) y envía un correo con la cuenta SMTP del portal.
# Mientras siga por encima avisa como máximo una vez cada 24 h; al bajar del
# umbral se rearma. Programado cada hora en /etc/cron.d/portal-escolar.
#
# Variables opcionales:
#   UMBRAL=80        porcentaje de uso que dispara la alerta
#   SOLO_PROBAR=1    no envía el correo: solo verifica la conexión SMTP
set -uo pipefail

UMBRAL=${UMBRAL:-80}
ESTADO_DIR=/var/lib/portal-escolar
ESTADO=$ESTADO_DIR/alerta-disco.enviada
ENVIAR=/usr/local/lib/portal-escolar/enviar-alerta.js

USO=$(df --output=pcent / | tail -1 | tr -dc '0-9')
mkdir -p "$ESTADO_DIR"

if [ "$USO" -lt "$UMBRAL" ]; then
  rm -f "$ESTADO"
  exit 0
fi

LIBRE=$(df -h --output=avail / | tail -1 | tr -d ' ')
MSG="El disco del servidor $(hostname) está al ${USO}% (umbral ${UMBRAL}%). Espacio libre: ${LIBRE}. Revisa /var/backups/portal-escolar, los logs y la carpeta uploads."
logger -t alerta-disco -p user.warning "$MSG"
echo "$(date '+%F %T') ⚠ $MSG"

if [ "${SOLO_PROBAR:-0}" = "1" ]; then
  node "$ENVIAR" --verificar
  exit $?
fi

# Ya se avisó en las últimas 24 h
if [ -f "$ESTADO" ] && [ -n "$(find "$ESTADO" -mmin -1440)" ]; then
  exit 0
fi

if node "$ENVIAR" "Alerta: disco al ${USO}% — Portal Escolar" "$MSG"; then
  touch "$ESTADO"
else
  logger -t alerta-disco -p user.err "no se pudo enviar el correo de alerta"
fi
