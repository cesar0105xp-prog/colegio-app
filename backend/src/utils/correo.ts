import { prisma } from './prisma';

// Normalización de correos. Antes se usaba normalizeEmail() de express-validator,
// que por defecto BORRA los puntos de las direcciones Gmail (y lo que va después
// de un "+"): un usuario guardado como nombre.apellido@gmail.com nunca coincidía
// al iniciar sesión. Aquí solo se quitan espacios y se pasa a minúsculas.
export function normalizarCorreo(email: unknown): string {
  return String(email ?? '').trim().toLowerCase();
}

const DOMINIOS_GMAIL = ['gmail.com', 'googlemail.com'];

/**
 * Busca un usuario por correo, sin distinguir mayúsculas. En Gmail los puntos no
 * cuentan ("nombre.apellido" y "nombreapellido" son la misma bandeja), así que
 * también encuentra la cuenta si se guardó o se escribió con o sin puntos; esto
 * cubre los usuarios que quedaron guardados sin puntos con la normalización vieja.
 */
export async function buscarUsuarioPorCorreo(email: string) {
  const correo = normalizarCorreo(email);
  const exacto = await prisma.usuario.findFirst({ where: { email: { equals: correo, mode: 'insensitive' } } });
  if (exacto) return exacto;

  const [local, dominio] = correo.split('@');
  if (!local || !dominio || !DOMINIOS_GMAIL.includes(dominio)) return null;

  const canonico = local.split('+')[0].replace(/\./g, '');
  const coincidencias = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM usuarios
    WHERE lower(split_part(email, '@', 2)) IN ('gmail.com', 'googlemail.com')
      AND replace(split_part(split_part(lower(email), '@', 1), '+', 1), '.', '') = ${canonico}
    LIMIT 2`;
  // Si hubiera dos cuentas que se confunden, no se adivina cuál es
  if (coincidencias.length !== 1) return null;
  return prisma.usuario.findUnique({ where: { id: coincidencias[0].id } });
}
