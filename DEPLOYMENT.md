# Despliegue a producción — Portal Escolar

Checklist de la Fase 8 del cronograma. Las casillas marcadas ya están resueltas en
el repositorio; el resto depende de la infraestructura real (proveedor de hosting,
dominio, base de datos) y debe ejecutarse a mano en esa plataforma.

## Backend

- [x] `backend/.env.production.example` — plantilla con todas las variables que
      necesita producción (copiar a `.env.production` en el servidor y llenar
      con valores reales; nunca commitear ese archivo).
- [x] Costo de bcrypt configurable vía `BCRYPT_ROUNDS` (antes estaba fijo en 12/10
      en el código).
- [x] `backend/ecosystem.config.js` — configuración de PM2 para reinicio
      automático del proceso.
- [x] Verificado: `npx prisma migrate deploy`, `npx prisma generate` y
      `npm run build` corren limpio.
- [ ] En el servidor de producción: `npm ci`, `npx prisma migrate deploy`,
      `npx prisma generate`, `npm run build`, luego `pm2 start ecosystem.config.js --env production`.
- [ ] Variables de entorno cargadas en la plataforma (Railway/VPS) — nunca
      como archivo `.env` commiteado.
- [ ] HTTPS (certificado SSL) en el dominio del backend.
- [ ] Backup de la base de datos antes de la primera `migrate deploy` en producción.
- [ ] Usuario de PostgreSQL con permisos mínimos (no superuser) para `DATABASE_URL`.
- [ ] Puerto 5432 no expuesto públicamente (solo accesible desde el backend).

## Frontend

- [x] `frontend/.env.production.example` — define `VITE_API_URL` (debe existir
      *antes* de correr `npm run build`, Vite la incrusta en el bundle).
- [x] `frontend/public/_redirects` — redirección SPA para Netlify.
- [x] `frontend/public/.htaccess` — redirección SPA para hosting Apache
      (Hostinger y similares). Ambos archivos quedan en `dist/` al hacer build;
      el que no aplique a la plataforma elegida simplemente se ignora.
- [ ] HTTPS en el subdominio del portal.
- [ ] Variables `VITE_` configuradas en la plataforma de build (Netlify) o en
      `.env.production` antes del build (Hostinger).

## Antes de cada despliegue

1. `npx prisma migrate deploy` (nunca `migrate dev` en producción).
2. `npx prisma generate`.
3. `npm run build` en `backend/` y en `frontend/`.
