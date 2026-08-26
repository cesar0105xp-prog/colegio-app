// ─── ESTÁNDARES COLOMBIANOS ───────────────────────────────────────────────────
// Aplicar en backend (express-validator) y frontend (react-hook-form)

export const VALIDACIONES = {

  // DOCUMENTOS
  RC: { min: 8, max: 11, msg: 'El Registro Civil debe tener entre 8 y 11 dígitos' },
  TI: { min: 10, max: 11, msg: 'La Tarjeta de Identidad debe tener entre 10 y 11 dígitos' },
  CC: { min: 6, max: 10, msg: 'La Cédula de Ciudadanía debe tener entre 6 y 10 dígitos' },
  CE: { min: 6, max: 12, msg: 'La Cédula de Extranjería debe tener entre 6 y 12 dígitos' },
  PASAPORTE: { min: 5, max: 12, msg: 'El pasaporte debe tener entre 5 y 12 caracteres' },

  // NOMBRES Y APELLIDOS
  // En Colombia los nombres pueden ser compuestos (ej: María Fernanda)
  // Apellidos también compuestos (ej: García Rodríguez)
  nombres: { min: 2, max: 50, msg: 'Nombres entre 2 y 50 caracteres' },
  apellidos: { min: 2, max: 50, msg: 'Apellidos entre 2 y 50 caracteres' },

  // TELÉFONOS
  // Celular colombiano: 10 dígitos, empieza por 3
  // Fijo Bogotá: 7 dígitos (sin indicativo) o 10 con indicativo (601XXXXXXX)
  telefono: { min: 7, max: 10, pattern: /^[0-9]{7,10}$/, msg: 'Teléfono entre 7 y 10 dígitos (sin espacios ni guiones)' },
  celular: { min: 10, max: 10, pattern: /^3[0-9]{9}$/, msg: 'Celular colombiano: 10 dígitos comenzando por 3' },

  // DIRECCIÓN
  // Formato colombiano: Calle 123 # 45-67, Barrio, Ciudad
  direccion: { min: 5, max: 150, msg: 'Dirección entre 5 y 150 caracteres' },

  // EMAIL
  email: { max: 100, msg: 'Email máximo 100 caracteres' },

  // CONTRASEÑA
  // Mínimo seguro recomendado
  password: {
    min: 8,
    max: 64,
    pattern: /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*\-_]).{8,}$/,
    msg: 'Mínimo 8 caracteres, una mayúscula, un número y un carácter especial (!@#$%^&*-_)'
  },

  // SOLO LETRAS (nombres, apellidos)
  soloLetras: {
    pattern: /^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s\-']+$/,
    msg: 'Solo se permiten letras, tildes, espacios y guión'
  },

  // SOLO NÚMEROS (documentos, teléfonos)
  soloNumeros: {
    pattern: /^\d+$/,
    msg: 'Solo se permiten dígitos numéricos'
  },
};

// ─── FUNCIÓN PARA VALIDAR DOCUMENTO SEGÚN TIPO ────────────────────────────────
export function validarDocumentoPorTipo(tipo: string, numero: string): { ok: boolean; msg: string } {
  const reglas = VALIDACIONES[tipo as keyof typeof VALIDACIONES];
  if (!reglas || !('min' in reglas)) return { ok: false, msg: 'Tipo de documento inválido' };

  if (!/^\d+$/.test(numero) && tipo !== 'PASAPORTE') {
    return { ok: false, msg: 'El número de documento solo puede contener dígitos' };
  }

  const len = numero.length;
  if (len < (reglas as { min: number }).min || len > (reglas as { max: number }).max) {
    return { ok: false, msg: (reglas as { msg: string }).msg };
  }

  return { ok: true, msg: '' };
}