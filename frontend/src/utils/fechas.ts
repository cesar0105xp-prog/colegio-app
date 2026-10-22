// Fechas de calendario (nacimiento, entrega de tareas, pagos, asistencia,
// períodos) se guardan como el día a las 00:00 UTC. Si se muestran en hora local
// de Bogotá (UTC-5) aparecen un día antes; y si "hoy" se calcula en UTC, después
// de las 7 p. m. ya es mañana. Estas funciones evitan los dos errores.
const ZONA_COLEGIO = 'America/Bogota';

/** Hoy en Bogotá como AAAA-MM-DD (para inputs de fecha y filtros). */
export function hoyISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: ZONA_COLEGIO });
}

/** Fecha AAAA-MM-DD que está n días antes (negativo) o después (positivo) de hoy en Bogotá. */
export function diasDesdeHoy(n: number): string {
  const [y, m, d] = hoyISO().split('-').map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d + n));
  return fecha.toISOString().slice(0, 10);
}

/**
 * Convierte una fecha de calendario del servidor ("2026-10-22" o
 * "2026-10-22T00:00:00.000Z") en un Date local de ese mismo día, para usar
 * getDate(), getMonth() o comparar con el día de hoy.
 */
export function fechaCalendario(valor: string | Date): Date {
  const texto = typeof valor === 'string' ? valor : valor.toISOString();
  const [y, m, d] = texto.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Muestra una fecha de calendario sin correrla un día. */
export function formatoFecha(valor: string | Date, opciones: Intl.DateTimeFormatOptions = {}): string {
  return new Date(valor).toLocaleDateString('es-CO', { ...opciones, timeZone: 'UTC' });
}
