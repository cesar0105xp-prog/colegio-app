// Cálculo de la nota de un período (escala 0–100).
//
// La nota es el PROMEDIO PONDERADO DE LO EVALUADO: solo cuentan las actividades
// que ya tienen nota, cada una con su porcentaje.
//   nota = SUM(valor × porcentaje) / SUM(porcentaje de las actividades calificadas)
// Así, a mitad de período la nota refleja el desempeño real y no se castiga al
// estudiante por actividades que todavía no se han calificado. porcentajeEvaluado
// indica qué parte del período (0–100 %) respalda esa nota.

type ValorDecimal = number | string | { toString(): string };

export interface NotaCalculada {
  nota: number;
  porcentajeEvaluado: number;
}

export function redondear1(n: number): number {
  return Math.round(n * 10) / 10;
}

export interface ItemNota { valor: ValorDecimal; porcentaje: ValorDecimal }

export function notaPonderada(items: ItemNota[]): NotaCalculada | null {
  let suma = 0;
  let porcentajeEvaluado = 0;
  for (const { valor, porcentaje } of items) {
    const p = Number(porcentaje);
    suma += Number(valor) * p;
    porcentajeEvaluado += p;
  }
  if (porcentajeEvaluado <= 0) return null;
  return { nota: redondear1(suma / porcentajeEvaluado), porcentajeEvaluado: redondear1(porcentajeEvaluado) };
}

export function promedio(notas: number[]): number | null {
  return notas.length > 0 ? redondear1(notas.reduce((a, b) => a + b, 0) / notas.length) : null;
}
