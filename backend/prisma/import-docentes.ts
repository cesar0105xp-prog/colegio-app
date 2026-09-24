/**
 * Importación de docentes, materias y asignaciones desde la planilla del colegio.
 *
 *   npm run import:docentes                 (lee ../asignaciones_docentes.csv)
 *   npm run import:docentes -- ruta.csv
 *
 * El CSV trae: docente, materia, grado, grupo (ya expandido por grupo).
 *
 * - Los docentes que ya están registrados se reutilizan: se emparejan por nombre
 *   (sin importar tildes ni un nombre de pila abreviado). Si alguno no existe, se
 *   crea con correo provisional nombre.apellido@pendiente.local, documento
 *   TMP-DOC-01 y una contraseña temporal distinta, marcado como datos pendientes.
 *   NO se envía ningún correo: esas direcciones son falsas.
 * - Las materias que falten se crean; si hay una con nombre parecido, se detiene.
 * - Los grados deben existir (se crearon al importar los estudiantes).
 * - Todo va en una transacción y es idempotente: correrlo dos veces no duplica.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient, Prisma, TipoDocumento } from '@prisma/client';

const prisma = new PrismaClient();

const COLUMNAS = ['docente', 'materia', 'grado', 'grupo'];
const ANIO = new Date().getFullYear();
const SALT_ROUNDS = 12;

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const normalizar = (t: string) => sinTildes(t).replace(/\s+/g, ' ');

/** Distancia de edición, para tolerar "Valery"/"Valerie" o "Yudy"/"Yudi". */
function distancia(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

// Palabras cortas exigen más parecido; en las largas se toleran dos cambios
// ("Valery"/"Valerie", "Yudy"/"Yudi", "Katerin"/"Katherine").
const palabraCoincide = (a: string, b: string) => {
  if (a === b || a.startsWith(b) || b.startsWith(a)) return true;
  const tolerancia = Math.min(a.length, b.length) >= 6 ? 2 : 1;
  return distancia(a, b) <= tolerancia;
};

/** Cada palabra del nombre del CSV debe aparecer en el nombre completo registrado. */
function coincideNombre(nombreCsv: string, nombreCompleto: string): boolean {
  const buscadas = normalizar(nombreCsv).split(' ');
  const registradas = normalizar(nombreCompleto).split(' ');
  return buscadas.every(b => registradas.some(r => palabraCoincide(r, b)));
}

function contrasenaTemporal(): string {
  const MAYUS = 'ABCDEFGHJKLMNPQRSTUVWXYZ', MINUS = 'abcdefghijkmnpqrstuvwxyz', NUMS = '23456789', ESPECIALES = '!@#$*-_';
  const elegir = (s: string) => s[crypto.randomInt(s.length)];
  const chars = [elegir(MAYUS), elegir(MAYUS), elegir(NUMS), elegir(NUMS), elegir(ESPECIALES)];
  while (chars.length < 10) chars.push(elegir(MINUS + NUMS));
  for (let i = chars.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join('');
}

type Fila = { docente: string; materia: string; grado: string; grupo: string; linea: number };

function leerCsv(ruta: string): Fila[] {
  if (!fs.existsSync(ruta)) {
    throw new Error(`No se encontró el archivo ${ruta}. Déjalo en la raíz del proyecto como asignaciones_docentes.csv`);
  }
  const lineas = fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim() !== '');
  if (lineas.length < 2) throw new Error('El archivo no tiene filas de asignaciones');

  const encabezado = lineas[0].split(',').map(c => c.trim().toLowerCase());
  if (encabezado.length !== COLUMNAS.length || !COLUMNAS.every((c, i) => encabezado[i] === c)) {
    throw new Error(`El encabezado debe ser: ${COLUMNAS.join(', ')} — se encontró: ${encabezado.join(', ')}`);
  }

  return lineas.slice(1).map((linea, i) => {
    const campos = linea.split(',').map(c => c.trim());
    if (campos.length !== COLUMNAS.length) {
      throw new Error(`La línea ${i + 2} tiene ${campos.length} columnas y deberían ser ${COLUMNAS.length}: ${linea}`);
    }
    const [docente, materia, grado, grupo] = campos;
    if (!docente || !materia || !grado) {
      throw new Error(`La línea ${i + 2} está incompleta (docente, materia y grado son obligatorios): ${linea}`);
    }
    return { docente, materia, grado: grado.toUpperCase(), grupo: grupo.toUpperCase(), linea: i + 2 };
  });
}

async function main() {
  const ruta = process.argv[2] ?? path.resolve(__dirname, '../../asignaciones_docentes.csv');
  const filas = leerCsv(ruta);
  console.log(`Archivo leído: ${filas.length} asignación(es) en ${ruta}\n`);

  const resumen = {
    docentesCreados: [] as string[],
    docentesReutilizados: [] as string[],
    materiasCreadas: [] as string[],
    asignacionesCreadas: 0,
    asignacionesOmitidas: 0,
    asignacionesReasignadas: [] as string[],
    credenciales: [] as { docente: string; email: string; password: string }[],
  };

  await prisma.$transaction(async (tx) => {
    // ── Grados: deben existir ya (los creó la importación de estudiantes) ─────
    const grados = await tx.grado.findMany({ where: { anio: ANIO } });
    const buscarGrado = (nombre: string, grupo: string) =>
      grados.find(g => sinTildes(g.nombre) === sinTildes(nombre) && g.grupo.toUpperCase() === grupo);

    for (const fila of filas) {
      if (!buscarGrado(fila.grado, fila.grupo)) {
        throw new Error(`El grado "${fila.grado}${fila.grupo ? ' ' + fila.grupo : ''}" (línea ${fila.linea}) no existe en la base de datos. Créalo desde administración antes de importar.`);
      }
    }

    // ── Materias: crear solo las que falten, avisando de nombres parecidos ────
    const materias = await tx.materia.findMany();
    const nombresCsv = [...new Set(filas.map(f => f.materia))];

    for (const nombre of nombresCsv) {
      const exacta = materias.find(m => normalizar(m.nombre) === normalizar(nombre));
      if (exacta) continue;

      const parecida = materias.find(m => {
        const a = normalizar(m.nombre), b = normalizar(nombre);
        return a.includes(b) || b.includes(a) || distancia(a, b) <= 2;
      });
      if (parecida) {
        throw new Error(`La materia "${nombre}" se parece a "${parecida.nombre}", que ya existe. Revísalo y dime cuál dejamos; no creo duplicados.`);
      }

      const creada = await tx.materia.create({ data: { nombre } });
      materias.push(creada);
      resumen.materiasCreadas.push(nombre);
    }

    // ── Docentes: reutilizar los registrados y crear los que falten ───────────
    const profesores = await tx.profesor.findMany({ include: { usuario: { select: { email: true } } } });
    const idPorDocente = new Map<string, string>();
    const docentesCsv = [...new Set(filas.map(f => f.docente))];

    let consecutivoDoc = profesores.reduce((max, p) => {
      const n = parseInt(p.numeroDocumento.replace(/^TMP-DOC-/i, ''), 10);
      return /^TMP-DOC-/i.test(p.numeroDocumento) && Number.isFinite(n) && n > max ? n : max;
    }, 0);

    for (const docente of docentesCsv) {
      const candidatos = profesores.filter(p => coincideNombre(docente, `${p.nombres} ${p.apellidos}`));
      if (candidatos.length > 1) {
        throw new Error(`"${docente}" coincide con varios docentes registrados (${candidatos.map(c => `${c.nombres} ${c.apellidos}`).join(', ')}). Aclárame cuál es antes de importar.`);
      }

      if (candidatos.length === 1) {
        idPorDocente.set(docente, candidatos[0].id);
        resumen.docentesReutilizados.push(`${docente} → ${candidatos[0].nombres} ${candidatos[0].apellidos} (${candidatos[0].usuario.email})`);
        continue;
      }

      // No está registrado: se crea con datos provisionales y sin enviar correos
      const partes = docente.trim().split(/\s+/);
      const nombres = partes[0];
      const apellidos = partes.slice(1).join(' ');
      const email = `${sinTildes(partes.join('.'))}@pendiente.local`;
      const password = contrasenaTemporal();
      consecutivoDoc++;

      const usuario = await tx.usuario.create({
        data: {
          email,
          passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
          rol: 'PROFESOR',
          estado: 'ACTIVO',
          debeCambiarPassword: true,
          perfilProfesor: {
            create: {
              nombres,
              apellidos: apellidos || nombres, // algunos docentes vienen sin apellido
              tipoDocumento: TipoDocumento.CC,
              numeroDocumento: `TMP-DOC-${String(consecutivoDoc).padStart(2, '0')}`,
              telefono: '',
              datosPendientes: true,
            },
          },
        },
        include: { perfilProfesor: true },
      });

      idPorDocente.set(docente, usuario.perfilProfesor!.id);
      profesores.push({ ...usuario.perfilProfesor!, usuario: { email } });
      resumen.docentesCreados.push(`${docente} (${email})`);
      resumen.credenciales.push({ docente, email, password });
    }

    // ── Asignaciones ─────────────────────────────────────────────────────────
    for (const fila of filas) {
      const gradoId = buscarGrado(fila.grado, fila.grupo)!.id;
      const materiaId = materias.find(m => normalizar(m.nombre) === normalizar(fila.materia))!.id;
      const profesorId = idPorDocente.get(fila.docente)!;

      // Solo puede haber un docente por materia y grado en el año
      const existente = await tx.materiaGradoProfesor.findUnique({
        where: { materiaId_gradoId_anio: { materiaId, gradoId, anio: ANIO } },
      });

      if (!existente) {
        await tx.materiaGradoProfesor.create({ data: { materiaId, gradoId, profesorId, anio: ANIO } });
        resumen.asignacionesCreadas++;
      } else if (existente.profesorId === profesorId) {
        resumen.asignacionesOmitidas++;
      } else {
        const antes = profesores.find(p => p.id === existente.profesorId);
        await tx.materiaGradoProfesor.update({ where: { id: existente.id }, data: { profesorId } });
        resumen.asignacionesReasignadas.push(
          `${fila.materia} ${fila.grado}${fila.grupo ? ' ' + fila.grupo : ''}: ${antes ? antes.nombres + ' ' + antes.apellidos : 'otro docente'} → ${fila.docente}`
        );
      }
    }
  }, { timeout: 120_000, maxWait: 20_000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  console.log('─────────── RESUMEN ───────────');
  console.log(`Docentes creados:          ${resumen.docentesCreados.length}`);
  resumen.docentesCreados.forEach(d => console.log(`   + ${d}`));
  console.log(`Docentes ya registrados:   ${resumen.docentesReutilizados.length}`);
  resumen.docentesReutilizados.forEach(d => console.log(`   = ${d}`));
  console.log(`Materias creadas:          ${resumen.materiasCreadas.length}${resumen.materiasCreadas.length ? ' — ' + resumen.materiasCreadas.join(', ') : ''}`);
  console.log(`Asignaciones creadas:      ${resumen.asignacionesCreadas}`);
  console.log(`Omitidas por ya existir:   ${resumen.asignacionesOmitidas}`);
  console.log(`Reasignadas a otro docente: ${resumen.asignacionesReasignadas.length}`);
  resumen.asignacionesReasignadas.forEach(a => console.log(`   ~ ${a}`));

  if (resumen.credenciales.length > 0) {
    console.log('\n──── CONTRASEÑAS TEMPORALES (no se envió ningún correo) ────');
    resumen.credenciales.forEach(c => console.log(`${c.docente.padEnd(24)} ${c.email.padEnd(40)} ${c.password}`));
  }

  // ── Verificación: asignaciones por docente ────────────────────────────────
  const porDocente = await prisma.profesor.findMany({
    select: { nombres: true, apellidos: true, _count: { select: { materiaGrados: true } } },
    orderBy: { nombres: 'asc' },
  });
  console.log('\n──────── ASIGNACIONES POR DOCENTE ────────');
  let total = 0;
  for (const p of porDocente) {
    total += p._count.materiaGrados;
    console.log(`${(p.nombres + ' ' + p.apellidos).padEnd(34)} ${String(p._count.materiaGrados).padStart(3)}`);
  }
  console.log(`${'TOTAL'.padEnd(34)} ${String(total).padStart(3)}`);
  console.log(`Materias en el sistema: ${await prisma.materia.count()}`);
}

main()
  .catch(err => {
    console.error('\nLa importación falló:', (err as Error).message);
    console.error('No se guardó ningún cambio.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
