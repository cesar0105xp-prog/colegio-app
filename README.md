# Portal Escolar — Sistema de Gestión Académica

Aplicación web completa para gestión escolar con roles diferenciados, boletines de notas, observador del estudiante y carga de documentos PDF.

---

## Arquitectura

```
colegio-app/
├── backend/          Node.js + Express + TypeScript + Prisma (PostgreSQL)
└── frontend/         React + TypeScript + TailwindCSS + React Query
```

---

## Roles del sistema

| Rol | Permisos |
|---|---|
| **Administrador** | Acceso total al sistema |
| **Secretario/a** | Gestión de estudiantes y padres |
| **Profesor/a** | Crear actividades, registrar notas, agregar observaciones |
| **Padre/Acudiente** | Ver boletín e observaciones de sus hijos, marcar "visto", subir documentos |
| **Estudiante** | Ver su propio boletín y observaciones |

---

## Stack tecnológico

### Backend
- **Node.js + Express** con TypeScript
- **PostgreSQL** como base de datos
- **Prisma ORM** para manejo de BD con tipado completo
- **JWT** (access token 15min + refresh token 7 días en cookie httpOnly)
- **bcryptjs** para hash de contraseñas (cost factor 12)
- **Helmet** para headers de seguridad HTTP
- **express-rate-limit** para protección contra fuerza bruta
- **multer** para subida de archivos (solo PDF, máx 10MB)
- **winston** para logging estructurado
- **express-validator** para validación de inputs en servidor

### Frontend
- **React 18 + TypeScript**
- **React Router v6** con rutas protegidas por rol
- **TailwindCSS** para estilos
- **React Query** para caché y sincronización de datos
- **Zustand** para estado global de autenticación
- **React Hook Form** para formularios con validación
- **Axios** con interceptores para refresh automático de JWT

---

## Seguridad implementada

- ✅ Contraseñas hasheadas con bcrypt (cost 12)
- ✅ JWT con expiración corta (15min) + refresh token en cookie httpOnly/Secure/SameSite
- ✅ Bloqueo de cuenta tras 5 intentos fallidos (15 minutos)
- ✅ Rate limiting: 100 req/15min global, 5 intentos de login/15min
- ✅ Validación de campos en frontend Y backend (nunca solo en frontend)
- ✅ Control de acceso por rol en cada endpoint
- ✅ Padre solo puede ver datos de SUS hijos (verificado en BD, no en frontend)
- ✅ Estudiante solo puede ver su propia información
- ✅ Solo archivos PDF permitidos (validado por mimetype + extensión)
- ✅ Nombres de archivos reemplazados por UUID en disco
- ✅ Headers de seguridad con Helmet (CSP, X-Frame-Options, etc.)
- ✅ CORS restringido al frontend autorizado
- ✅ Tabla de auditoría completa (login, cambios, descargas, etc.)
- ✅ Logs estructurados con Winston

---

## Estructura de la base de datos

### Tablas principales
- `usuarios` — credenciales y estado de cuenta
- `administradores`, `secretarios`, `profesores`, `padres` — perfiles por rol
- `estudiantes` — datos del estudiante
- `padres_estudiantes` — relación padre ↔ hijo (con parentesco)
- `grados`, `materias`, `periodos` — estructura académica
- `materia_grado_profesor` — asignación profesor → materia → grado
- `actividades` — tareas, talleres, exámenes con porcentaje
- `calificaciones` — nota de cada estudiante en cada actividad
- `observaciones` — observador del estudiante
- `observaciones_vistas` — registro de "visto" del padre
- `archivos` — metadatos de PDFs subidos
- `audit_logs` — trazabilidad de todas las acciones

### Fórmula de nota del período
```
nota_periodo = SUM(calificacion.valor × actividad.porcentaje / 100)
```
El sistema valida que la suma de porcentajes por materia/período/grado no supere 100%.

---

## Validación de campos

| Campo | Regla |
|---|---|
| Nombres y apellidos | Solo letras, tildes, espacios y guión |
| Número de documento | Solo dígitos |
| Teléfono | 7 a 10 dígitos |
| Email | Formato email estándar |
| Contraseña | Mínimo 8 chars, 1 mayúscula, 1 número, 1 especial |
| Nota | Decimal entre 0.0 y 5.0 |
| Porcentaje de actividad | Entero entre 1 y 100 |
| Archivos | Solo PDF, máximo 10MB |

---

## Instalación

### Requisitos
- Node.js 18+
- PostgreSQL 14+

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Editar .env con tu conexión a PostgreSQL y secretos JWT

npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

### Frontend

```bash
cd frontend
npm install
# Crear .env con VITE_API_URL=http://localhost:3001/api
npm run dev
```

---

## Variables de entorno (backend)

```env
DATABASE_URL="postgresql://usuario:contrasena@localhost:5432/colegio_db"
JWT_SECRET="secreto-largo-aleatorio-minimo-64-caracteres"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="otro-secreto-diferente-igual-de-largo"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=3001
NODE_ENV=development
FRONTEND_URL="http://localhost:5173"
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE_MB=10
```

---

## Módulos pendientes (próximas entregas)

- [ ] CRUD completo de estudiantes (secretario/admin)
- [ ] CRUD de profesores y asignación de materias
- [ ] Dashboard de admin con estadísticas
- [ ] Vista completa del estudiante
- [ ] Exportación de boletín a PDF
- [ ] Sistema de notificaciones para observaciones nuevas
- [ ] Subida masiva de notas desde Excel (reemplazar el flujo actual)
