#!/usr/bin/env bash
# Preparación inicial del VPS (Ubuntu 24.04/26.04) — se corre UNA sola vez como root.
#
#   bash setup-vps.sh portal.tudominio.com
#
# Instala Node 22, PostgreSQL 18, Nginx, PM2, Certbot y fail2ban; crea el usuario
# de sistema "portal", la base de datos con un usuario de permisos mínimos, el
# firewall y el sitio de Nginx, y aplica la configuración de seguridad y
# rendimiento de deploy/servidor/ (pensada para 8 GB RAM / 2 CPU), los respaldos
# diarios, la alerta de disco y la rotación de logs. Al terminar imprime los
# pasos siguientes.
set -euo pipefail

DOMINIO="${1:?Uso: bash setup-vps.sh portal.tudominio.com}"
AQUI="$(cd "$(dirname "$0")" && pwd)"
SRV="${AQUI}/servidor"

echo "==> Paquetes base"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get upgrade -y
apt-get install -y curl git ufw nginx rsync certbot python3-certbot-nginx ca-certificates gnupg lsb-release fail2ban htop

echo "==> PostgreSQL 18 (misma versión mayor que en desarrollo, para restaurar el dump sin problemas)"
if apt-cache policy postgresql-18 2>/dev/null | grep -qE 'Candidate: [0-9]'; then
  # Ubuntu 26.04 en adelante lo trae en sus propios repositorios
  apt-get install -y postgresql-18
else
  # Ubuntu 24.04 y anteriores: repositorio oficial PGDG
  install -d /usr/share/postgresql-common/pgdg
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
  echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
  apt-get update -y && apt-get install -y postgresql-18
fi
systemctl enable --now postgresql
echo "   seguridad (solo localhost) y rendimiento (8 GB RAM)"
install -m 644 -o postgres -g postgres "${SRV}/postgresql-10-seguridad.conf" /etc/postgresql/18/main/conf.d/10-seguridad.conf
install -m 644 -o postgres -g postgres "${SRV}/postgresql-20-rendimiento.conf" /etc/postgresql/18/main/conf.d/20-rendimiento.conf
systemctl restart postgresql

echo "==> Node 22 LTS + PM2"
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
npm install -g pm2

echo "==> Firewall (solo SSH, HTTP y HTTPS; backend y PostgreSQL quedan solo locales)"
ufw allow OpenSSH            # primero SSH, para no perder acceso
ufw default deny incoming
ufw default allow outgoing
ufw allow 'Nginx Full'
ufw --force enable

echo "==> fail2ban (SSH: 3 intentos fallidos = ban de 1 hora)"
install -m 644 "${SRV}/fail2ban-jail.local" /etc/fail2ban/jail.local
systemctl enable fail2ban
systemctl restart fail2ban

echo "==> Usuario de sistema 'portal'"
id -u portal &>/dev/null || adduser --disabled-password --gecos "" portal

echo "==> Base de datos y usuario con permisos mínimos"
DB_PASS="$(openssl rand -base64 30 | tr -d '/+=' | cut -c1-28)"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='colegio_app'" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE USER colegio_app WITH PASSWORD '${DB_PASS}';"
  echo "DATABASE_URL=\"postgresql://colegio_app:${DB_PASS}@localhost:5432/colegio_db\"" > /home/portal/DATABASE_URL.txt
  chown portal:portal /home/portal/DATABASE_URL.txt && chmod 600 /home/portal/DATABASE_URL.txt
else
  echo "   (el usuario colegio_app ya existía; se conserva su contraseña)"
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='colegio_db'" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE colegio_db OWNER colegio_app;"
fi

echo "==> Nginx (optimizado para 2 CPU) y sitio de ${DOMINIO}"
mkdir -p /var/www/portal && chown -R portal:portal /var/www/portal
install -m 644 "${SRV}/nginx.conf" /etc/nginx/nginx.conf
install -m 644 "${SRV}/cabeceras-seguridad.conf" /etc/nginx/snippets/cabeceras-seguridad.conf
sed "s/portal\.DOMINIO/${DOMINIO}/g" "${AQUI}/nginx-portal.conf" > /etc/nginx/sites-available/portal
ln -sf /etc/nginx/sites-available/portal /etc/nginx/sites-enabled/portal
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> PM2 arranca solo al reiniciar el servidor"
env PATH="$PATH:/usr/bin" pm2 startup systemd -u portal --hp /home/portal >/dev/null
install -d /etc/systemd/system/pm2-portal.service.d
install -m 644 "${SRV}/pm2-portal-override.conf" /etc/systemd/system/pm2-portal.service.d/override.conf
systemctl daemon-reload

echo "==> Respaldos diarios, alerta de disco y rotación de logs"
install -m 750 "${SRV}/backup-portal-escolar.sh" /usr/local/sbin/backup-portal-escolar.sh
install -m 750 "${SRV}/alerta-disco.sh" /usr/local/sbin/alerta-disco.sh
install -d -m 755 /usr/local/lib/portal-escolar
install -m 640 "${SRV}/enviar-alerta.js" /usr/local/lib/portal-escolar/enviar-alerta.js
install -d -m 750 /var/log/portal-escolar
install -d -m 700 /var/backups/portal-escolar
install -m 644 "${SRV}/cron-portal-escolar" /etc/cron.d/portal-escolar
install -m 644 "${SRV}/logrotate-portal-escolar" /etc/logrotate.d/portal-escolar

cat <<EOF

Listo. Pasos siguientes:

  1. Apunta el DNS: registro A  ${DOMINIO}  ->  IP de este VPS.
  2. Como usuario portal:   su - portal
       git clone https://github.com/cesar0105xp-prog/colegio-app.git
       cd colegio-app/backend && cp .env.production.example .env
       # DATABASE_URL está en /home/portal/DATABASE_URL.txt; genera los JWT con:
       openssl rand -base64 64
       nano .env
       cd ../frontend && cp .env.production.example .env.production && nano .env.production
       cd .. && bash deploy/deploy.sh
  3. Como root, cuando el DNS ya resuelva:
       CERTBOT_EMAIL=correo@colegio.edu.co bash deploy/set-domain.sh ${DOMINIO}
  4. Prueba:   curl https://${DOMINIO}/health

EOF
