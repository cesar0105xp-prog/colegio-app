/**
 * Importación masiva de estudiantes desde la planilla del colegio.
 *
 *   npm run import:estudiantes            (lee ../estudiantes.csv)
 *   npm run import:estudiantes -- ruta.csv
 *
 * El CSV trae: grado, grupo, apellidos, nombres, original.
 * Los estudiantes entran ACTIVOS y con datosPendientes = true: solo se conoce
 * el nombre y el curso, así que el documento es un provisional TMP-0001 y la
 * fecha de nacimiento y el género quedan vacíos hasta que secretaría los complete.
 *
 * Es idempotente: si se corre dos veces no duplica a nadie (compara apellidos +
 * nombres + grado) y todo va en una transacción, así que nunca queda a medias.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, Prisma, TipoDocumento } from '@prisma/client';

const prisma = new PrismaClient();

const COLUMNAS = ['grado', 'grupo', 'apellidos', 'nombres', 'original'];
const ANIO = new Date().getFullYear();

/** Nivel académico según el nombre del grado en la planilla. */
const NIVEL: Record<string, string> = {
  'PRE-JARDÍN': 'preescolar', 'JARDÍN': 'preescolar', 'TRANSICIÓN': 'preescolar',
  'PRIMERO': 'primaria', 'SEGUNDO': 'primaria', 'TERCERO': 'primaria',
  'CUARTO': 'primaria', 'QUINTO': 'primaria',
  'SEXTO': 'secundaria', 'SÉPTIMO': 'secundaria', 'OCTAVO': 'secundaria', 'NOVENO': 'secundaria',
  'DÉCIMO': 'media', 'ONCE': 'media',
};

/** "PRE-JARDÍN" → "Pre-jardín", "SÉPTIMO" → "Séptimo" */
function aTitulo(nombre: string): string {
  return nombre.toLocaleLowerCase('es')
    .replace(/(^|[\s-])([a-záéíóúüñ])/g, (_, sep, letra) => sep + letra.toLocaleUpperCase('es'));
}

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
/** Clave para comparar nombres sin importar tildes, mayúsculas ni espacios de más. */
const clave = (apellidos: string, nombres: string, gradoId: string) =>
  `${sinTildes(apellidos).replace(/\s+/g, ' ')}|${sinTildes(nombres).replace(/\s+/g, ' ')}|${gradoId}`;

type Fila = { grado: string; grupo: string; apellidos: string; nombres: string; original: string; linea: number };

function leerCsv(ruta: string): Fila[] {
  if (!fs.existsSync(ruta)) {
    throw new Error(`No se encontró el archivo ${ruta}. Déjalo en la raíz del proyecto como estudiantes.csv`);
  }
  const contenido = fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '');
  const lineas = contenido.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lineas.length < 2) throw new Error('El archivo no tiene filas de estudiantes');

  const encabezado = lineas[0].split(',').map(c => c.trim().toLowerCase());
  if (encabezado.length !== COLUMNAS.length || !COLUMNAS.every((c, i) => encabezado[i] === c)) {
    throw new Error(`El encabezado debe ser: ${COLUMNAS.join(', ')} — se encontró: ${encabezado.join(', ')}`);
  }

  return lineas.slice(1).map((linea, i) => {
    const campos = linea.split(',').map(c => c.trim());
    if (campos.length !== COLUMNAS.length) {
      throw new Error(`La línea ${i + 2} tiene ${campos.length} columnas y deberían ser ${COLUMNAS.length}: ${linea}`);
    }
    const [grado, grupo, apellidos, nombres, original] = campos;
    if (!grado || !apellidos || !nombres) {
      throw new Error(`La línea ${i + 2} está incompleta (grado, apellidos y nombres son obligatorios): ${linea}`);
    }
    return { grado: grado.toUpperCase(), grupo: grupo.toUpperCase(), apellidos, nombres, original, linea: i + 2 };
  });
}

async function main() {
  const rutaCsv = process.argv[2] ?? path.resolve(__dirname, '../../estudiantes.csv');
  const filas = leerCsv(rutaCsv);
  console.log(`Archivo leído: ${filas.length} estudiante(s) en ${rutaCsv}\n`);

  const resumen = { creados: 0, omitidos: 0, fallidos: [] as string[], gradosCreados: [] as string[] };

  await prisma.$transaction(async (tx) => {
    // ── Grados: se crean solo los que falten ──────────────────────────────────
    const gradosExistentes = await tx.grado.findMany({ where: { anio: ANIO } });
    const buscarGrado = (nombre: string, grupo: string) =>
      gradosExistentes.find(g => sinTildes(g.nombre) === sinTildes(nombre) && g.grupo.toUpperCase() === grupo);

    const cursosCsv = [...new Map(filas.map(f => [`${f.grado}|${f.grupo}`, f])).values()];
    const idPorCurso = new Map<string, string>();

    for (const curso of cursosCsv) {
      const nombre = aTitulo(curso.grado);
      const nivel = NIVEL[curso.grado];
      if (!nivel) throw new Error(`No sé a qué nivel pertenece el grado "${curso.grado}" (línea ${curso.linea})`);

      const enCurso = filas.filter(f => f.grado === curso.grado && f.grupo === curso.grupo).length;
      const cupoMaximo = enCurso + 5; // margen inicial que administración puede ajustar

      let grado = buscarGrado(nombre, curso.grupo);
      if (grado) {
        await tx.grado.update({ where: { id: grado.id }, data: { cupoMaximo } });
      } else {
        grado = await tx.grado.create({ data: { nombre, grupo: curso.grupo, nivel, anio: ANIO, cupoMaximo } });
        gradosExistentes.push(grado);
        resumen.gradosCreados.push(`${nombre}${curso.grupo ? ' ' + curso.grupo : ''}`);
      }
      idPorCurso.set(`${curso.grado}|${curso.grupo}`, grado.id);
    }

    // ── Estudiantes ya registrados, para no duplicar ──────────────────────────
    const yaRegistrados = await tx.estudiante.findMany({ select: { apellidos: true, nombres: true, gradoId: true } });
    const existentes = new Set(yaRegistrados.map(e => clave(e.apellidos, e.nombres, e.gradoId)));

    // ── Documento provisional correlativo: TMP-0001, TMP-0002… ────────────────
    const tmpPrevios = await tx.estudiante.findMany({
      where: { numeroDocumento: { startsWith: 'TMP-' } },
      select: { numeroDocumento: true },
    });
    let consecutivo = tmpPrevios.reduce((max, e) => {
      const n = parseInt(e.numeroDocumento.slice(4), 10);
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);

    for (const fila of filas) {
      const gradoId = idPorCurso.get(`${fila.grado}|${fila.grupo}`)!;
      const llave = clave(fila.apellidos, fila.nombres, gradoId);
      if (existentes.has(llave)) { resumen.omitidos++; continue; }

      try {
        consecutivo++;
        await tx.estudiante.create({
          data: {
            nombres: fila.nombres,
            apellidos: fila.apellidos,
            // Provisionales: secretaría los reemplaza al completar la ficha
            tipoDocumento: NIVEL[fila.grado] === 'secundaria' ? TipoDocumento.TI : TipoDocumento.RC,
            numeroDocumento: `TMP-${String(consecutivo).padStart(4, '0')}`,
            gradoId,
            estado: 'ACTIVO',
            datosPendientes: true,
          },
        });
        existentes.add(llave);
        resumen.creados++;
      } catch (err) {
        resumen.fallidos.push(`Línea ${fila.linea} — ${fila.original}: ${(err as Error).message.split('\n').pop()}`);
      }
    }

    if (resumen.fallidos.length > 0) {
      throw new Error(`${resumen.fallidos.length} estudiante(s) no se pudieron importar; no se guardó nada`);
    }
  }, { timeout: 120_000, maxWait: 20_000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  console.log('─────────── RESUMEN ───────────');
  console.log(`Estudiantes creados:            ${resumen.creados}`);
  console.log(`Omitidos por estar ya creados:  ${resumen.omitidos}`);
  console.log(`Fallidos:                       ${resumen.fallidos.length}`);
  if (resumen.gradosCreados.length > 0) console.log(`Grados creados:                 ${resumen.gradosCreados.join(', ')}`);

  // ── Verificación por curso ────────────────────────────────────────────────
  const porCurso = await prisma.grado.findMany({
    where: { anio: ANIO },
    select: { nombre: true, grupo: true, cupoMaximo: true, _count: { select: { estudiantes: true } } },
    orderBy: [{ nivel: 'asc' }, { nombre: 'asc' }, { grupo: 'asc' }],
  });
  console.log('\n──────── ESTUDIANTES POR CURSO ────────');
  let total = 0;
  for (const g of porCurso) {
    total += g._count.estudiantes;
    console.log(`${(g.nombre + ' ' + g.grupo).padEnd(20)} ${String(g._count.estudiantes).padStart(3)}   (cupo ${g.cupoMaximo ?? '—'})`);
  }
  console.log(`${'TOTAL'.padEnd(20)} ${String(total).padStart(3)}`);
}

main()
  .catch(err => {
    console.error('\nLa importación falló:', (err as Error).message);
    console.error('No se guardó ningún cambio.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
