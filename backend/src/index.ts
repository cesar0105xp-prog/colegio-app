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

// Rate limiting estricto para login (evitar fuerza bruta)
const limiterLogin = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX ?? '20'),
  skipSuccessfulRequests: true, // NO cuenta los logins exitosos
  message: { ok: false, mensaje: 'Demasiados intentos de inicio de sesión. Intenta en 15 minutos' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiterGlobal);
app.use('/api/auth/login', limiterLogin);
app.use('/api/auth/refresh', limiterLogin);
app.use('/api/auth/password', limiterLogin);
app.use('/api/matriculas/acceso', limiterLogin);

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