// Un solo criterio en todo el portal para nombrar y ordenar los cursos.
// Nunca se ordena por el nombre en texto: así "Cuarto" quedaría antes que
// "Primero" y "Séptimo" antes que "Sexto".

type GradoNombrable = { nombre: string; grupo?: string | null };
type GradoOrdenable = GradoNombrable & { orden?: number | null };

const ORDEN_POR_NOMBRE: Record<string, number> = {
  'pre-jardin': 1, prejardin: 1, 'pre jardin': 1, jardin: 2, transicion: 3,
  primero: 4, segundo: 5, tercero: 6, cuarto: 7, quinto: 8,
  sexto: 9, septimo: 10, octavo: 11, noveno: 12, decimo: 13, undecimo: 14, once: 14,
};

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Posición escolar sugerida según el nombre (Pre-jardín 1 … Undécimo 14). */
export function ordenSugerido(nombre: string): number {
  return ORDEN_POR_NOMBRE[sinTildes(nombre)] ?? 99;
}

/** "Segundo A", "Quinto B"; sin grupo, solo el nombre: "Sexto", "Pre-jardín". */
export function nombreCurso(g: GradoNombrable | null | undefined): string {
  if (!g) return '';
  const grupo = (g.grupo ?? '').trim();
  return grupo ? `${g.nombre} ${grupo}` : g.nombre;
}

/** Compara dos cursos por posición escolar y luego por grupo (A antes que B). */
export function compararGrados(a: GradoOrdenable, b: GradoOrdenable): number {
  const oa = a.orden ?? ordenSugerido(a.nombre);
  const ob = b.orden ?? ordenSugerido(b.nombre);
  return oa - ob || (a.grupo ?? '').localeCompare(b.grupo ?? '', 'es');
}

/** Copia ordenada de una lista de cursos. */
export function ordenarGrados<T extends GradoOrdenable>(grados: T[]): T[] {
  return [...grados].sort(compararGrados);
}

/** Estudiantes como en las planillas del colegio: por apellidos y luego nombres. */
export function compararEstudiantes(a: { apellidos: string; nombres: string }, b: { apellidos: string; nombres: string }): number {
  return a.apellidos.localeCompare(b.apellidos, 'es') || a.nombres.localeCompare(b.nombres, 'es');
}
