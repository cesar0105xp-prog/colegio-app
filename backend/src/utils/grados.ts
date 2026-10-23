// Un solo criterio para ordenar y nombrar los cursos en todo el backend.

/** Orden escolar por defecto según el nombre (para grados nuevos sin orden indicado). */
const ORDEN_POR_NOMBRE: Record<string, number> = {
  'pre-jardin': 1, prejardin: 1, 'pre jardin': 1, jardin: 2, transicion: 3,
  primero: 4, segundo: 5, tercero: 6, cuarto: 7, quinto: 8,
  sexto: 9, septimo: 10, octavo: 11, noveno: 12, decimo: 13, undecimo: 14, once: 14,
};

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function ordenSugerido(nombre: string): number {
  return ORDEN_POR_NOMBRE[sinTildes(nombre)] ?? 99;
}

/** Orden de Prisma para listar grados: posición escolar y luego grupo (A antes que B). */
export const ORDEN_GRADOS = [{ orden: 'asc' as const }, { grupo: 'asc' as const }];

/** "Segundo A", "Sexto" (sin grupo no deja espacio sobrante). */
export function nombreCurso(g: { nombre: string; grupo?: string | null } | null | undefined): string {
  if (!g) return '';
  const grupo = (g.grupo ?? '').trim();
  return grupo ? `${g.nombre} ${grupo}` : g.nombre;
}

/** Compara dos grados por posición escolar y grupo. */
export function compararGrados(
  a: { orden?: number | null; nombre: string; grupo?: string | null },
  b: { orden?: number | null; nombre: string; grupo?: string | null },
): number {
  const oa = a.orden ?? ordenSugerido(a.nombre);
  const ob = b.orden ?? ordenSugerido(b.nombre);
  return oa - ob || (a.grupo ?? '').localeCompare(b.grupo ?? '', 'es');
}
