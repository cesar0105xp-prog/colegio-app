#!/usr/bin/env bash
# Configura el dominio definitivo del portal y activa HTTPS — se corre como root
# cuando el registro DNS (A) del dominio ya apunta a la IP del VPS:
#
#   CERTBOT_EMAIL=correo@colegio.edu.co bash set-domain.sh portal.tudominio.com
#
# Hace: server_name en Nginx, FRONTEND_URL del backend, VITE_API_URL del frontend,
# certificado Let's Encrypt (con redirección HTTP→HTTPS) y redespliegue (el
# frontend se recompila porque la URL del API va incrustada en el build).
set -euo pipefail

DOMINIO="${1:?Uso: CERTBOT_EMAIL=correo@... bash set-domain.sh portal.tudominio.com}"
: "${CERTBOT_EMAIL:?Exporta CERTBOT_EMAIL con el correo para avisos de vencimiento del certificado}"
APP=/home/portal/colegio-app

echo "==> Nginx: server_name ${DOMINIO}"
sed -i -E "s/^(\s*server_name\s+).*;/\1${DOMINIO};/" /etc/nginx/sites-available/portal
nginx -t && systemctl reload nginx

# El certificado va ANTES de tocar las variables: si Let's Encrypt falla, el
# portal queda exactamente como estaba (antes quedaba FRONTEND_URL en https con
# el backend sin reiniciar, un estado inconsistente).
echo "==> Certificado HTTPS (Let's Encrypt)"
certbot --nginx -d "${DOMINIO}" --non-interactive --agree-tos --redirect -m "${CERTBOT_EMAIL}"

echo "==> Variables de entorno"
sed -i -E "s|^FRONTEND_URL=.*|FRONTEND_URL=\"https://${DOMINIO}\"|" "${APP}/backend/.env"
# Ruta relativa: sirve para cualquier dominio, con o sin HTTPS (ver .env.production.example).
echo "VITE_API_URL=/api" > "${APP}/frontend/.env.production"
chown portal:portal "${APP}/frontend/.env.production"

echo "==> Redespliegue"
sudo -u portal -H bash -c "bash ${APP}/deploy/deploy.sh"

echo
echo "Listo: https://${DOMINIO}  (prueba: curl https://${DOMINIO}/health)"
