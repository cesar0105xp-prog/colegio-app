// El servidor corre en UTC, pero el colegio vive en Bogotá (UTC-5). Si "hoy" se
// calcula en UTC, entre las 7 p. m. y la medianoche ya es "mañana": la asistencia
// quedaba con la fecha siguiente y los PDF salían con el día equivocado.
export const ZONA_COLEGIO = 'America/Bogota';

/** Fecha de hoy en Bogotá como texto AAAA-MM-DD. */
export function hoyBogotaISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: ZONA_COLEGIO });
}

/**
 * Fecha de hoy en Bogotá a las 00:00 UTC. Es el formato en que se guardan las
 * fechas de calendario (columnas DATE), así que sirve para comparar y filtrar.
 */
export function hoyBogota(): Date {
  const [y, m, d] = hoyBogotaISO().split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Fecha y hora actuales escritas como se leen en Bogotá ("22 de octubre de 2026"). */
export function fechaLargaBogota(fecha: Date = new Date()): string {
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: ZONA_COLEGIO });
}
