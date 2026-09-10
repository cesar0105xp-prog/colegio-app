#!/usr/bin/env bash
# Despliegue (primera vez y cada actualización). Se corre como usuario "portal"
# desde cualquier carpeta:   bash ~/colegio-app/deploy/deploy.sh
#
# Trae los cambios, aplica migraciones, compila backend y frontend, publica el
# frontend en /var/www/portal y recarga el backend en PM2 sin tumbar el servicio.
set -euo pipefail

cd "$(dirname "$0")/.."
RAIZ="$(pwd)"

echo "==> Código"
git pull --ff-only

echo "==> Backend"
cd "${RAIZ}/backend"
if [ ! -f .env ]; then
  echo "Falta backend/.env — copia .env.production.example a .env y complétalo." >&2
  exit 1
fi
npm ci
npx prisma migrate deploy
npx prisma generate
npm run build
mkdir -p uploads
pm2 startOrReload ecosystem.config.js --env production
pm2 save

echo "==> Frontend"
cd "${RAIZ}/frontend"
if [ ! -f .env.production ]; then
  echo "Falta frontend/.env.production — copia .env.production.example y ajusta VITE_API_URL." >&2
  exit 1
fi
npm ci
npm run build
rsync -a --delete dist/ /var/www/portal/

echo
echo "Despliegue OK. Estado del backend:"
pm2 status colegio-backend
