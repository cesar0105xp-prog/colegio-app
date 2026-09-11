# Despliegue a producción — Portal Escolar

Checklist de la Fase 8 del cronograma. Las casillas marcadas ya están resueltas en
el repositorio; el resto depende de la infraestructura real (proveedor de hosting,
dominio, base de datos) y debe ejecutarse a mano en esa plataforma.

## Backend

- [x] `backend/.env.production.example` — plantilla con todas las variables que
      necesita producción. **Copiarla en el servidor como `backend/.env`** (el
      backend carga únicamente ese archivo; un `.env.production` no se lee) y
      llenarla con valores reales; nunca commitear ese archivo.
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

(En el VPS, `deploy/deploy.sh` hace estos tres pasos, publica el frontend y
recarga PM2.)

---

## Despliegue en un VPS (Hostinger, Ubuntu 24.04, todo en un servidor)

Arquitectura: **Nginx** sirve el build de React desde `/var/www/portal` y
reenvía `/api` al **backend Node** (PM2, puerto 3001, solo local). **PostgreSQL**
corre en el mismo VPS y no se expone a internet. Frontend y API comparten el
dominio (`https://portal.tudominio.com` y `https://portal.tudominio.com/api`),
así que no hay CORS y la cookie de sesión funciona sin ajustes.

Archivos en `deploy/`:

| Archivo | Para qué |
|---|---|
| `setup-vps.sh` | Preparación inicial del servidor (una sola vez, como root). |
| `nginx-portal.conf` | Sitio de Nginx; `setup-vps.sh` lo instala con el dominio real. |
| `deploy.sh` | Primer despliegue y cada actualización (como usuario `portal`). |

### 1. DNS y acceso
- Crea un registro **A** `portal.tudominio.com → IP del VPS` (Hostinger → DNS).
- Entra por SSH como root: `ssh root@IP`.

### 2. Preparar el servidor (una vez, como root)
```bash
apt-get install -y git
git clone https://github.com/cesar0105xp-prog/colegio-app.git /tmp/colegio-app
bash /tmp/colegio-app/deploy/setup-vps.sh portal.tudominio.com
```
Instala Node 22, PostgreSQL 18, Nginx, PM2 y Certbot; crea el usuario de sistema
`portal`, la base `colegio_db` con un usuario de permisos mínimos (la
`DATABASE_URL` queda en `/home/portal/DATABASE_URL.txt`), el firewall (solo 22,
80 y 443) y el sitio de Nginx.

### 3. Configurar la aplicación (como usuario `portal`)
```bash
su - portal
git clone https://github.com/cesar0105xp-prog/colegio-app.git
cd colegio-app/backend && cp .env.production.example .env && nano .env
```
En `backend/.env`:
- `DATABASE_URL`: el valor de `/home/portal/DATABASE_URL.txt`.
- `JWT_SECRET` y `JWT_REFRESH_SECRET`: dos valores distintos de `openssl rand -base64 64`.
- `FRONTEND_URL`: `https://portal.tudominio.com`.
- `MAIL_*`: las mismas credenciales de Gmail que usas en desarrollo.
- `TWILIO_*`: vacías hasta tener cuenta de Twilio (queda en modo desarrollo: solo log).

```bash
cd ../frontend && cp .env.production.example .env.production
# Deja VITE_API_URL=/api (ruta relativa). NO pongas la IP ni el dominio: si el
# navegador entra por una dirección distinta a la compilada, bloquea el login por CORS.
cd .. && bash deploy/deploy.sh
```

### 4. Dominio y HTTPS (como root, cuando el DNS ya resuelva)
```bash
CERTBOT_EMAIL=correo@colegio.edu.co bash /home/portal/colegio-app/deploy/set-domain.sh portal.tudominio.com
```
`set-domain.sh` ajusta Nginx y las variables de entorno al dominio, emite el
certificado de Let's Encrypt (acepta sus términos de servicio en tu nombre y
redirige HTTP→HTTPS) y redespliega. Mientras no haya dominio, el portal
funciona por la IP en HTTP, pero **la sesión no se mantiene al recargar**: en
producción la cookie de sesión se marca `secure` y no viaja por HTTP.

### 5. Datos iniciales
Opción A — **traer la base de datos de desarrollo** (usuarios, matrículas y
cobros reales ya cargados). En Windows, desde PowerShell:
```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -U postgres -Fc -f colegio.dump colegio_db
scp colegio.dump portal@IP:/home/portal/
```
En el VPS, como `portal`:
```bash
pg_restore --no-owner --role=colegio_app -d "$(sed 's/^DATABASE_URL=//; s/"//g' ~/DATABASE_URL.txt)" ~/colegio.dump
```
Antes de exportar, borra desde el panel los datos de prueba que no quieras en
producción (por ejemplo el concepto "PRUEBA pago en línea (Wompi)").

Opción B — **empezar vacío**: `cd backend && npm run seed` crea datos de
demostración (secretaría, profesor, padres de ejemplo). Solo para pruebas.

### 6. Verificar
```bash
curl https://portal.tudominio.com/health      # {"ok":true,...}
pm2 status colegio-backend                    # online
pm2 logs colegio-backend --lines 50
```
Luego entra al portal, inicia sesión y recarga la página: la sesión debe
mantenerse (eso confirma HTTPS + cookie).

### Actualizar en el futuro
```bash
su - portal && bash ~/colegio-app/deploy/deploy.sh
```

### Notas
- `TRUST_PROXY=1` (por defecto en producción) hace que el backend tome la IP
  real del cliente desde Nginx; sin esto todos los usuarios compartirían la IP
  127.0.0.1 y el límite de peticiones bloquearía al colegio entero.
- Los archivos subidos (documentos, comprobantes) quedan en
  `/home/portal/colegio-app/backend/uploads`.
- **Respaldos:** `deploy/backup.sh` (instalado como `/home/portal/backup.sh`)
  hace `pg_dump` de la base de datos + copia de `uploads` en
  `/home/portal/backups`, todos los días a las 03:00 (crontab del usuario
  `portal`), conservando 14 días. Descárgalos periódicamente fuera del VPS:
  `scp portal@IP:/home/portal/backups/colegio-*.dump .`
- El QR de Nequi es un placeholder: reemplaza `frontend/public/qr-nequi.svg`
  por el real antes de salir a producción.
