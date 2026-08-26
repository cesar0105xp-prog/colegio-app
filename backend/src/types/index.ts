import { Rol } from '@prisma/client';

// ─── JWT PAYLOAD ─────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;       // usuarioId
  email: string;
  rol: Rol;
  iat?: number;
  exp?: number;
}

export interface RefreshPayload {
  sub: string;
  iat?: number;
  exp?: number;
}

// ─── EXPRESS EXTENDIDO ───────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      usuario?: JwtPayload;
    }
  }
}

// ─── RESPUESTAS API ──────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  ok: boolean;
  mensaje?: string;
  datos?: T;
  errores?: string[];
}

export interface PaginacionMeta {
  pagina: number;
  limite: number;
  total: number;
  totalPaginas: number;
}

export interface ApiResponsePaginada<T> extends ApiResponse<T[]> {
  meta?: PaginacionMeta;
}

// ─── VALIDACIÓN DE CAMPOS ────────────────────────────────────────────────────

export const REGEX = {
  // Solo letras, tildes, espacios y guión (nombres)
  SOLO_LETRAS: /^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s\-']+$/,
  // Solo dígitos
  SOLO_NUMEROS: /^\d+$/,
  // Teléfono colombiano: 10 dígitos
  TELEFONO: /^[0-9]{7,10}$/,
  // Email
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  // Contraseña: mínimo 8, 1 mayúscula, 1 número, 1 especial
  PASSWORD: /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*\-_]).{8,}$/,
  // Nota: decimal entre 0.0 y 5.0
  NOTA: /^([0-4](\.[0-9])?|5(\.0)?)$/,
  // Porcentaje: entre 1 y 100 sin decimales
  PORCENTAJE: /^(100|[1-9][0-9]?)$/,
};

// ─── ROLES Y PERMISOS ────────────────────────────────────────────────────────

export const PERMISOS: Record<Rol, string[]> = {
  ADMINISTRADOR: ['*'],
  SECRETARIO: [
    'estudiantes:crear', 'estudiantes:editar', 'estudiantes:leer',
    'padres:crear', 'padres:editar', 'padres:leer',
    'grados:leer',
    'archivos:crear', 'archivos:leer',
  ],
  PROFESOR: [
    'actividades:crear', 'actividades:editar', 'actividades:leer',
    'calificaciones:crear', 'calificaciones:editar', 'calificaciones:leer',
    'observaciones:crear', 'observaciones:editar', 'observaciones:leer',
    'estudiantes:leer',
  ],
  PADRE: [
    'boletin:leer',
    'observaciones:leer', 'observaciones:marcar_visto',
    'archivos:crear', 'archivos:leer',
  ],
  ESTUDIANTE: [
    'boletin:leer',
    'observaciones:leer',
    'archivos:leer',
  ],
};
