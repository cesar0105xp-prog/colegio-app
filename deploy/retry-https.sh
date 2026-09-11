#!/usr/bin/env bash
# Reintenta emitir el certificado HTTPS hasta lograrlo, y cuando lo consigue
# ajusta las variables al dominio y redespliega. Pensado para cron cada 30 min
# (2 intentos/hora, por debajo del límite de 5 validaciones fallidas/hora de
# Let's Encrypt). Se desinstala solo del cron al terminar con éxito.
#
# Instalación (como root):
#   cp retry-https.sh /root/ && chmod +x /root/retry-https.sh
#   (crontab -l 2>/dev/null | grep -v retry-https; echo "*/30 * * * * /root/retry-https.sh") | crontab -
set -uo pipefail

D="${DOMINIO:-portal.liceosanmarcos.com.co}"
EMAIL="${CERTBOT_EMAIL:-cesar0105xp@gmail.com}"
APP=/home/portal/colegio-app
LOG=/var/log/retry-https.log

exec >> "$LOG" 2>&1
echo "$(date '+%F %T') --- intento de certificado para $D"

# Si ya hay certificado, no hay nada que hacer: quitarse del cron y salir.
if certbot certificates 2>/dev/null | grep -q "Certificate Name: $D"; then
  echo "$(date '+%F %T') ya existe un certificado; desinstalando el reintento"
  (crontab -l 2>/dev/null | grep -v retry-https.sh) | crontab -
  exit 0
fi

if certbot --nginx -d "$D" --non-interactive --agree-tos --redirect -m "$EMAIL"; then
  echo "$(date '+%F %T') ✔ CERTIFICADO EMITIDO"
  # El frontend lleva la URL del API incrustada en el build: hay que recompilar.
  sed -i -E "s|^FRONTEND_URL=.*|FRONTEND_URL=\"https://${D}\"|" "${APP}/backend/.env"
  echo "VITE_API_URL=https://${D}/api" > "${APP}/frontend/.env.production"
  chown portal:portal "${APP}/frontend/.env.production"
  if sudo -u portal -H bash -c "bash ${APP}/deploy/deploy.sh"; then
    echo "$(date '+%F %T') ✔ REDESPLIEGUE OK — https://${D} operativo"
    touch /root/https-listo
  else
    echo "$(date '+%F %T') ✖ el certificado quedó puesto pero el redespliegue falló"
  fi
  (crontab -l 2>/dev/null | grep -v retry-https.sh) | crontab -
else
  echo "$(date '+%F %T') ✖ falló: $(grep -oE '"detail": "[^"]*"' /var/log/letsencrypt/letsencrypt.log | tail -1 | cut -c1-170)"
fi
