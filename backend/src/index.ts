import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { logger } from './utils/logger';
import routes from './routes';

const app = express();
const PORT = process.env.PORT ?? 3001;

// Detrás de un proxy inverso (Nginx en el VPS) hay que confiar en X-Forwarded-For
// para que req.ip sea la IP real del cliente; de eso dependen el rate limiting por
// IP y la IP que queda en auditoría. Sin esto, todos los usuarios comparten la IP
// 127.0.0.1 y el límite de peticiones bloquearía al colegio entero.
// Activo en producción por defecto; TRUST_PROXY=1 lo fuerza y TRUST_PROXY=0 lo apaga.
if (process.env.TRUST_PROXY === '1' || (process.env.NODE_ENV === 'production' && process.env.TRUST_PROXY !== '0')) {
  app.set('trust proxy', 1);
}

// ─── SEGURIDAD: HEADERS HTTP ─────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition'],
}));

// ─── RATE LIMITING GLOBAL ─────────────────────────────────────────────────────
const limiterGlobal = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '900000'), // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX ?? '100'),
  message: { ok: false, mensaje: 'Demasiadas solicitudes. Intenta en unos minutos' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limitadores estrictos por ruta sensible. Cada ruta tiene su PROPIO contador
// por IP: antes compartían una sola instancia, así que las renovaciones de
// sesión fallidas (normales cuando la cookie no existe o venció) y los errores
// del formulario público de cupo gastaban los intentos de login de esa IP y
// bloqueaban el ingreso con "Demasiados intentos".
const VENTANA_15_MIN = 15 * 60 * 1000;
function limitador(opts: { max: number; mensaje: string; soloFallidos?: boolean; soloMetodo?: string }) {
  return rateLimit({
    windowMs: VENTANA_15_MIN,
    max: opts.max,
    skipSuccessfulRequests: opts.soloFallidos ?? true,
    ...(opts.soloMetodo ? { skip: (req: express.Request) => req.method !== opts.soloMetodo } : {}),
    message: { ok: false, mensaje: opts.mensaje },
    standardHeaders: true,
    legacyHeaders: false,
  });
}
const LOGIN_MAX = parseInt(process.env.LOGIN_RATE_LIMIT_MAX ?? '20');

app.use(limiterGlobal);
// Fuerza bruta de contraseñas: solo cuentan los intentos fallidos.
app.use('/api/auth/login', limitador({ max: LOGIN_MAX, mensaje: 'Demasiados intentos de inicio de sesión. Intenta en 15 minutos' }));
app.use('/api/auth/password', limitador({ max: LOGIN_MAX, mensaje: 'Demasiados intentos de cambio de contraseña. Intenta en 15 minutos' }));
// Renovar la sesión falla de forma normal (cookie ausente o vencida) y el token
// es un JWT firmado imposible de adivinar, así que el límite es holgado.
app.use('/api/auth/refresh', limitador({ max: 60, mensaje: 'Demasiadas renovaciones de sesión. Intenta en unos minutos' }));
// Magic link: token aleatorio de 256 bits, inviable de adivinar.
app.use('/api/matriculas/acceso', limitador({ max: 20, mensaje: 'Demasiados intentos con enlaces de acceso. Intenta en 15 minutos' }));
// Formulario público de cupo: cuenta TODOS los envíos (anti-spam), pero solo los
// POST, para no limitar a secretaría cuando lista o actualiza solicitudes.
app.use('/api/solicitudes-cupo', limitador({ max: 30, soloFallidos: false, soloMetodo: 'POST', mensaje: 'Demasiadas solicitudes de cupo desde esta conexión. Intenta en 15 minutos' }));

// ─── PARSERS ──────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// ─── LOGGING DE REQUESTS ──────────────────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ─── RUTAS ────────────────────────────────────────────────────────────────────
app.use('/api', routes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// ─── MANEJO DE ERRORES GLOBAL ─────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Error no manejado', { err: err.message, stack: err.stack });

  // Error de multer (archivos)
  if (err.message.includes('Solo se permiten archivos PDF')) {
    res.status(400).json({ ok: false, mensaje: err.message });
    return;
  }
  if (err.message.includes('File too large')) {
    res.status(400).json({ ok: false, mensaje: `El archivo supera el tamaño máximo permitido` });
    return;
  }

  res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
});

// Ruta no encontrada
app.use((_req, res) => {
  res.status(404).json({ ok: false, mensaje: 'Ruta no encontrada' });
});

// ─── INICIAR SERVIDOR ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`Servidor corriendo en puerto ${PORT} [${process.env.NODE_ENV ?? 'development'}]`);
});

export default app;