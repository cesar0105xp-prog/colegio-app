#!/usr/bin/env bash
# Preparación inicial del VPS (Ubuntu 24.04) — se corre UNA sola vez como root.
#
#   bash setup-vps.sh portal.tudominio.com
#
# Instala Node 22, PostgreSQL 18, Nginx, PM2 y Certbot; crea el usuario de sistema
# "portal", la base de datos con un usuario de permisos mínimos, el firewall y el
# sitio de Nginx. Al terminar imprime los pasos siguientes.
set -euo pipefail

DOMINIO="${1:?Uso: bash setup-vps.sh portal.tudominio.com}"
AQUI="$(cd "$(dirname "$0")" && pwd)"

echo "==> Paquetes base"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get upgrade -y
apt-get install -y curl git ufw nginx rsync certbot python3-certbot-nginx ca-certificates gnupg lsb-release

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

echo "==> Node 22 LTS + PM2"
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
npm install -g pm2

echo "==> Firewall (solo SSH, HTTP y HTTPS; PostgreSQL queda solo local)"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

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

echo "==> Sitio de Nginx para ${DOMINIO}"
mkdir -p /var/www/portal && chown -R portal:portal /var/www/portal
sed "s/portal\.DOMINIO/${DOMINIO}/g" "${AQUI}/nginx-portal.conf" > /etc/nginx/sites-available/portal
ln -sf /etc/nginx/sites-available/portal /etc/nginx/sites-enabled/portal
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> PM2 arranca solo al reiniciar el servidor"
env PATH="$PATH:/usr/bin" pm2 startup systemd -u portal --hp /home/portal >/dev/null

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
  3. Como root, cuando el DNS ya resuelva:   certbot --nginx -d ${DOMINIO}
  4. Prueba:   curl https://${DOMINIO}/health

EOF
