// ─── FESTIVOS COLOMBIANOS Y CÁLCULO AUTOMÁTICO DE PERÍODOS ACADÉMICOS ─────────
// Todas las fechas se manejan en UTC puro (sin horas) para evitar desfases
// de un día al convertir entre zona horaria del servidor/navegador.

const NUM_PERIODOS = 4;

// Festivos fijos (no se trasladan de fecha)
const FESTIVOS_FIJOS: [number, number][] = [
  [1, 1],   // Año Nuevo
  [5, 1],   // Día del Trabajo
  [7, 20],  // Independencia
  [8, 7],   // Batalla de Boyacá
  [12, 8],  // Inmaculada Concepción
  [12, 25], // Navidad
];

// Festivos Ley Emiliani: se trasladan al lunes siguiente si no caen en lunes
const FESTIVOS_LEY_EMILIANI: [number, number][] = [
  [1, 6],   // Reyes Magos
  [3, 19],  // San José
  [6, 29],  // SS. Pedro y Pablo
  [8, 15],  // Asunción de la Virgen
  [10, 12], // Día de la Raza
  [11, 1],  // Todos los Santos
  [11, 11], // Independencia de Cartagena
];

function fechaUTC(anio: number, mes: number, dia: number): Date {
  return new Date(Date.UTC(anio, mes - 1, dia));
}

function claveFecha(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

// Traslada una fecha al lunes siguiente si no cae ya en lunes (Ley Emiliani)
function trasladarALunes(d: Date): Date {
  const dow = d.getUTCDay(); // 0=domingo ... 6=sábado
  if (dow === 1) return d;
  const diasHastaLunes = (8 - dow) % 7;
  const trasladada = new Date(d);
  trasladada.setUTCDate(trasladada.getUTCDate() + diasHastaLunes);
  return trasladada;
}

/** Calcula el set de festivos colombianos (formato YYYY-MM-DD) para un año dado. */
export function obtenerFestivosColombia(anio: number): Set<string> {
  const festivos = new Set<string>();
  for (const [mes, dia] of FESTIVOS_FIJOS) {
    festivos.add(claveFecha(fechaUTC(anio, mes, dia)));
  }
  for (const [mes, dia] of FESTIVOS_LEY_EMILIANI) {
    festivos.add(claveFecha(trasladarALunes(fechaUTC(anio, mes, dia))));
  }
  return festivos;
}

function esDiaHabil(d: Date, festivos: Set<string>): boolean {
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false; // fin de semana
  return !festivos.has(claveFecha(d));
}

/** Genera la lista de días hábiles (excluyendo fines de semana y festivos) entre dos fechas, inclusive. */
export function generarDiasHabiles(fechaInicio: Date, fechaFin: Date): Date[] {
  const dias: Date[] = [];
  const festivosPorAnio = new Map<number, Set<string>>();
  const cursor = new Date(fechaInicio);

  while (cursor.getTime() <= fechaFin.getTime()) {
    const anioActual = cursor.getUTCFullYear();
    if (!festivosPorAnio.has(anioActual)) festivosPorAnio.set(anioActual, obtenerFestivosColombia(anioActual));

    if (esDiaHabil(cursor, festivosPorAnio.get(anioActual)!)) {
      dias.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dias;
}

export interface PeriodoCalculado {
  numero: number;
  nombre: string;
  fechaInicio: Date;
  fechaFin: Date;
  peso: number;
  diasHabiles: number;
}

/**
 * Divide el rango [fechaInicio, fechaFin] en 4 períodos equitativos de días hábiles,
 * garantizando que el inicio y fin de cada período caigan en un día hábil real
 * (ya que se construyen a partir de la lista de días hábiles, no de aritmética de calendario).
 */
export function calcularPeriodos(fechaInicio: Date, fechaFin: Date): PeriodoCalculado[] {
  const diasHabiles = generarDiasHabiles(fechaInicio, fechaFin);

  if (diasHabiles.length < NUM_PERIODOS) {
    throw new Error(`El rango de fechas es muy corto: solo hay ${diasHabiles.length} día(s) hábil(es), se necesitan al menos ${NUM_PERIODOS}`);
  }

  const base = Math.floor(diasHabiles.length / NUM_PERIODOS);
  const restantes = diasHabiles.length % NUM_PERIODOS;
  const peso = Number((100 / NUM_PERIODOS).toFixed(2));

  const periodos: PeriodoCalculado[] = [];
  let cursor = 0;
  for (let i = 0; i < NUM_PERIODOS; i++) {
    const cantidad = base + (i < restantes ? 1 : 0);
    const chunk = diasHabiles.slice(cursor, cursor + cantidad);
    cursor += cantidad;
    periodos.push({
      numero: i + 1,
      nombre: `Período ${i + 1}`,
      fechaInicio: chunk[0],
      fechaFin: chunk[chunk.length - 1],
      peso,
      diasHabiles: chunk.length,
    });
  }

  return periodos;
}
