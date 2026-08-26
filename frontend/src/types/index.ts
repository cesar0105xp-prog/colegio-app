// ─── ENUMS ───────────────────────────────────────────────────────────────────

export type Rol = 'ADMINISTRADOR' | 'SECRETARIO' | 'PROFESOR' | 'PADRE' | 'ESTUDIANTE';

export type TipoActividad = 'TAREA' | 'TALLER' | 'EXAMEN' | 'QUIZ' | 'PROYECTO' | 'EXPOSICION' | 'PARTICIPACION';

export type TipoObservacion = 'POSITIVA' | 'NEGATIVA' | 'NEUTRA' | 'DISCIPLINARIA' | 'ACADEMICA' | 'CONVIVENCIA';

export type TipoDocumentoArchivo = 'BOLETIN' | 'CERTIFICADO' | 'AUTORIZACION' | 'OTRO';

export type TipoDocumento = 'CC' | 'TI' | 'RC' | 'CE' | 'PASAPORTE';

export type EstadoEstudiante = 'ACTIVO' | 'INACTIVO' | 'RETIRADO' | 'GRADUADO';

// ─── VALIDACIONES ────────────────────────────────────────────────────────────

export const REGEX = {
  SOLO_LETRAS: /^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s\-']+$/,
  SOLO_NUMEROS: /^\d+$/,
  TELEFONO: /^[0-9]{7,10}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD: /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*\-_]).{8,}$/,
} as const;

export const MENSAJE_VALIDACION = {
  SOLO_LETRAS: 'Solo se permiten letras y espacios, sin números ni símbolos',
  SOLO_NUMEROS: 'Solo se permiten dígitos numéricos',
  TELEFONO: 'El teléfono debe tener entre 7 y 10 dígitos',
  EMAIL: 'Ingresa un correo electrónico válido',
  PASSWORD: 'Mínimo 8 caracteres, una mayúscula, un número y un carácter especial (!@#$%^&*-_)',
  REQUERIDO: 'Este campo es requerido',
  NOTA_RANGO: 'La nota debe estar entre 0.0 y 5.0',
  PORCENTAJE: 'El porcentaje debe ser un número entero entre 1 y 100',
} as const;

// ─── AUTH ─────────────────────────────────────────────────────────────────────

export interface UsuarioAuth {
  id: string;
  email: string;
  rol: Rol;
}

export interface LoginResponse {
  accessToken: string;
  usuario: UsuarioAuth;
}

// ─── ESTUDIANTE ──────────────────────────────────────────────────────────────

export interface Estudiante {
  id: string;
  nombres: string;
  apellidos: string;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  fechaNacimiento: string;
  genero: 'MASCULINO' | 'FEMENINO' | 'OTRO';
  grado: Grado;
  estado: EstadoEstudiante;
  foto?: string;
}

export interface Grado {
  id: string;
  nombre: string;
  grupo: string;
  nivel: string;
  anio: number;
}

// ─── BOLETÍN ─────────────────────────────────────────────────────────────────

export interface ActividadBoletin {
  id: string;
  nombre: string;
  tipo: TipoActividad;
  porcentaje: number;
  nota: number | null;
  observacion: string | null;
}

export interface MateriaBoletin {
  materia: { id: string; nombre: string };
  profesor: string;
  actividades: ActividadBoletin[];
  notaPeriodo: number | null;
  porcentajeTotal: number;
}

export interface Boletin {
  estudiante: {
    id: string;
    nombres: string;
    apellidos: string;
    grado: string;
  };
  boletin: MateriaBoletin[];
}

// ─── OBSERVACIONES ───────────────────────────────────────────────────────────

export interface Observacion {
  id: string;
  estudianteId: string;
  tipo: TipoObservacion;
  descripcion: string;
  fecha: string;
  yaVista?: boolean;
  profesor: { nombres: string; apellidos: string };
}

// ─── ARCHIVOS ────────────────────────────────────────────────────────────────

export interface Archivo {
  id: string;
  nombreOriginal: string;
  tipo: TipoDocumentoArchivo;
  descripcion?: string;
  tamanoBytes: number;
  visibleParaPadre: boolean;
  createdAt: string;
}

// ─── ACTIVIDAD ───────────────────────────────────────────────────────────────

export interface Actividad {
  id: string;
  nombre: string;
  tipo: TipoActividad;
  porcentaje: number;
  descripcion?: string;
  fechaEntrega?: string;
  materia: { id: string; nombre: string };
  grado: Grado;
  periodo: Periodo;
}

export interface Periodo {
  id: string;
  nombre: string;
  numero: number;
  anio: number;
  activo: boolean;
}

// ─── ETIQUETAS LEGIBLES ──────────────────────────────────────────────────────

export const LABEL_ROL: Record<Rol, string> = {
  ADMINISTRADOR: 'Administrador',
  SECRETARIO: 'Secretario/a',
  PROFESOR: 'Profesor/a',
  PADRE: 'Padre/Acudiente',
  ESTUDIANTE: 'Estudiante',
};

export const LABEL_TIPO_ACTIVIDAD: Record<TipoActividad, string> = {
  TAREA: 'Tarea',
  TALLER: 'Taller',
  EXAMEN: 'Examen',
  QUIZ: 'Quiz',
  PROYECTO: 'Proyecto',
  EXPOSICION: 'Exposición',
  PARTICIPACION: 'Participación',
};

export const LABEL_TIPO_OBSERVACION: Record<TipoObservacion, string> = {
  POSITIVA: 'Positiva',
  NEGATIVA: 'Negativa',
  NEUTRA: 'Neutra',
  DISCIPLINARIA: 'Disciplinaria',
  ACADEMICA: 'Académica',
  CONVIVENCIA: 'Convivencia',
};

export const COLOR_OBSERVACION: Record<TipoObservacion, string> = {
  POSITIVA: 'bg-emerald-100 text-emerald-800',
  NEGATIVA: 'bg-red-100 text-red-800',
  NEUTRA: 'bg-slate-100 text-slate-700',
  DISCIPLINARIA: 'bg-orange-100 text-orange-800',
  ACADEMICA: 'bg-blue-100 text-blue-800',
  CONVIVENCIA: 'bg-purple-100 text-purple-800',
};

export const COLOR_NOTA = (nota: number | null): string => {
  if (nota === null) return 'text-slate-400';
  if (nota >= 4.6) return 'text-emerald-600 font-bold';
  if (nota >= 3.0) return 'text-blue-600 font-semibold';
  return 'text-red-600 font-bold';
};
