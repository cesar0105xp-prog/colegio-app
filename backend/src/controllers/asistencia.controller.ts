import { Request, Response } from 'express';
import { EstadoAsistencia } from '@prisma/client';
import { body, param, validationResult } from 'express-validator';
import { audit } from '../utils/audit';
import { logger } from '../utils/logger';

import { prisma } from '../utils/prisma';

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ESTADOS = Object.values(EstadoAsistencia);
const MAX_DIAS_ATRAS = 3;

function esFechaValida(valor: string): boolean {
  if (!FECHA_REGEX.test(valor)) return false;
  const [y, m, d] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  return fecha.getUTCFullYear() === y && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d;
}

function parseFechaUTC(valor: string): Date {
  const [y, m, d] = valor.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function hoyUTC(): Date {
  const ahora = new Date();
  return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
}

function mismaFecha(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

/** Días anteriores hasta 3 días atrás, nunca futuras. */
function fechaEnRangoPermitido(fecha: Date): string | null {
  const hoy = hoyUTC();
  if (fecha.getTime() > hoy.getTime()) return 'No se puede registrar asistencia de días futuros';
  const limite = new Date(hoy);
  limite.setUTCDate(limite.getUTCDate() - MAX_DIAS_ATRAS);
  if (fecha.getTime() < limite.getTime()) return `Solo se puede registrar asistencia de hasta ${MAX_DIAS_ATRAS} días atrás`;
  return null;
}

/** El peor estado del día entre todas las materias, para colorear el calendario. */
function peorEstado(estados: string[]): string {
  for (const peor of ['AUSENTE', 'TARDE', 'EXCUSA']) if (estados.includes(peor)) return peor;
  return 'PRESENTE';
}

// ─── VALIDACIONES ─────────────────────────────────────────────────────────────

export const validarAsistenciaGrado = [
  body('gradoId').isUUID().withMessage('Grado inválido'),
  body('materiaId').isUUID().withMessage('Materia inválida'),
  body('fecha').custom(esFechaValida).withMessage('Fecha inválida (formato YYYY-MM-DD)'),
  body('registros').isArray({ min: 1, max: 200 }).withMessage('Debe incluir al menos un registro'),
  body('registros.*.estudianteId').isUUID().withMessage('Estudiante inválido'),
  body('registros.*.estado').isIn(ESTADOS).withMessage('Estado de asistencia inválido'),
  body('registros.*.observacion').optional({ checkFalsy: true }).trim().isLength({ max: 300 }).withMessage('Observación máximo 300 caracteres'),
];

export const validarEditarAsistencia = [
  param('id').isUUID().withMessage('ID inválido'),
  body('estado').isIn(ESTADOS).withMessage('Estado de asistencia inválido'),
  body('observacion').optional({ checkFalsy: true }).trim().isLength({ max: 300 }).withMessage('Observación máximo 300 caracteres'),
  body('justificada').optional().isBoolean().withMessage('Valor de justificada inválido'),
];

// ─── REGISTRAR ASISTENCIA MASIVA DE UN GRADO ──────────────────────────────────

export async function registrarAsistenciaGrado(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) { res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) }); return; }

  const { gradoId, materiaId, fecha: fechaStr, registros } = req.body as { gradoId: string; materiaId: string; fecha: string; registros: { estudianteId: string; estado: string; observacion?: string }[] };
  const fecha = parseFechaUTC(fechaStr);

  const errorRango = fechaEnRangoPermitido(fecha);
  if (errorRango) { res.status(400).json({ ok: false, mensaje: errorRango }); return; }

  try {
    // La asistencia es de la clase del profesor: debe tener esa materia en ese grado
    const asignado = await prisma.materiaGradoProfesor.findFirst({
      where: { gradoId, materiaId, profesor: { usuarioId: req.usuario!.sub } },
    });
    if (!asignado) {
      res.status(403).json({ ok: false, mensaje: 'No tienes esta materia asignada en este grado' });
      return;
    }

    const estudianteIds = registros.map(r => r.estudianteId);
    const estudiantesValidos = await prisma.estudiante.count({ where: { id: { in: estudianteIds }, gradoId } });
    if (estudiantesValidos !== new Set(estudianteIds).size) {
      res.status(400).json({ ok: false, mensaje: 'Algunos estudiantes no pertenecen a este grado' });
      return;
    }

    const profesorId = req.usuario!.sub;
    await prisma.$transaction(
      registros.map(r => prisma.registroAsistencia.upsert({
        where: { estudianteId_fecha_materiaId: { estudianteId: r.estudianteId, fecha, materiaId } },
        update: { estado: r.estado as EstadoAsistencia, observacion: r.observacion?.trim() || null, profesorId },
        create: {
          estudianteId: r.estudianteId, fecha, profesorId, materiaId,
          estado: r.estado as EstadoAsistencia,
          observacion: r.observacion?.trim() || null,
        },
      }))
    );

    await audit({ usuarioId: profesorId, accion: 'CREAR', entidad: 'registros_asistencia', datosDespues: { gradoId, materiaId, fecha: fechaStr, cantidad: registros.length }, ip: req.ip });
    res.status(201).json({ ok: true, mensaje: `Asistencia guardada para ${registros.length} estudiante(s)` });
  } catch (err) {
    logger.error('Error al registrar asistencia del grado', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── LISTAR ASISTENCIA DE UN GRADO EN UNA FECHA ───────────────────────────────

export async function listarAsistenciaGrado(req: Request, res: Response): Promise<void> {
  const { gradoId } = req.params;
  const { fecha: fechaStr, materiaId } = req.query;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!UUID.test(gradoId)) {
    res.status(400).json({ ok: false, mensaje: 'Grado inválido' }); return;
  }
  if (!materiaId || !UUID.test(materiaId as string)) {
    res.status(400).json({ ok: false, mensaje: 'Indica la materia de la clase' }); return;
  }
  if (!fechaStr || !esFechaValida(fechaStr as string)) {
    res.status(400).json({ ok: false, mensaje: 'Fecha inválida (formato YYYY-MM-DD)' }); return;
  }

  const fecha = parseFechaUTC(fechaStr as string);
  const inicioMes = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), 1));
  const finMes = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, 0));

  try {

    const estudiantes = await prisma.estudiante.findMany({
      where: { gradoId, estado: 'ACTIVO' },
      select: { id: true, nombres: true, apellidos: true },
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
    });
    if (estudiantes.length === 0) { res.json({ ok: true, datos: [] }); return; }

    const estudianteIds = estudiantes.map(e => e.id);

    const [registrosDelDia, registrosDelMes] = await Promise.all([
      // Del día: solo la clase de esta materia
      prisma.registroAsistencia.findMany({
        where: { estudianteId: { in: estudianteIds }, fecha, materiaId: materiaId as string },
        select: { id: true, estudianteId: true, estado: true, observacion: true, justificada: true },
      }),
      // Del mes: todas las materias, para avisar de estudiantes con varias ausencias
      prisma.registroAsistencia.findMany({
        where: { estudianteId: { in: estudianteIds }, fecha: { gte: inicioMes, lte: finMes }, estado: 'AUSENTE' },
        select: { estudianteId: true, fecha: true },
      }),
    ]);

    const porEstudiante = new Map(registrosDelDia.map(r => [r.estudianteId, r]));
    // Un día con ausencia en varias materias cuenta como un solo día ausente
    const diasAusente = new Map<string, Set<number>>();
    for (const r of registrosDelMes) {
      if (!diasAusente.has(r.estudianteId)) diasAusente.set(r.estudianteId, new Set());
      diasAusente.get(r.estudianteId)!.add(r.fecha.getTime());
    }

    const datos = estudiantes.map(e => {
      const registro = porEstudiante.get(e.id);
      return {
        estudianteId: e.id,
        nombres: e.nombres,
        apellidos: e.apellidos,
        registroId: registro?.id ?? null,
        estado: registro?.estado ?? 'PRESENTE',
        observacion: registro?.observacion ?? null,
        justificada: registro?.justificada ?? false,
        ausenciasMes: diasAusente.get(e.id)?.size ?? 0,
      };
    });

    res.json({ ok: true, datos });
  } catch (err) {
    logger.error('Error al listar asistencia del grado', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── CORREGIR UN REGISTRO (mismo día) ─────────────────────────────────────────

export async function editarAsistencia(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) { res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) }); return; }

  const { id } = req.params;
  const { estado, observacion, justificada } = req.body;

  try {
    const registro = await prisma.registroAsistencia.findUnique({ where: { id } });
    if (!registro) { res.status(404).json({ ok: false, mensaje: 'Registro de asistencia no encontrado' }); return; }

    if (registro.profesorId !== req.usuario!.sub) {
      res.status(403).json({ ok: false, mensaje: 'Solo puedes corregir registros que tú mismo hayas creado' });
      return;
    }
    if (!mismaFecha(registro.fecha, hoyUTC())) {
      res.status(400).json({ ok: false, mensaje: 'Solo puedes corregir registros del día de hoy' });
      return;
    }

    const actualizado = await prisma.registroAsistencia.update({
      where: { id },
      data: {
        estado,
        observacion: observacion?.trim() || null,
        justificada: justificada ?? registro.justificada,
      },
    });

    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'registros_asistencia', entidadId: id, ip: req.ip });
    res.json({ ok: true, mensaje: 'Registro actualizado', datos: actualizado });
  } catch (err) {
    logger.error('Error al corregir asistencia', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── HISTORIAL DE UN ESTUDIANTE ────────────────────────────────────────────────

export async function historialEstudiante(req: Request, res: Response): Promise<void> {
  const { estudianteId } = req.params;
  const { desde, hasta } = req.query;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(estudianteId)) {
    res.status(400).json({ ok: false, mensaje: 'Estudiante inválido' }); return;
  }

  let fechaDesde: Date, fechaHasta: Date;
  if (desde && hasta) {
    if (!esFechaValida(desde as string) || !esFechaValida(hasta as string)) {
      res.status(400).json({ ok: false, mensaje: 'Rango de fechas inválido' }); return;
    }
    fechaDesde = parseFechaUTC(desde as string);
    fechaHasta = parseFechaUTC(hasta as string);
  } else {
    const hoy = hoyUTC();
    fechaDesde = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
    fechaHasta = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() + 1, 0));
  }

  try {
    const registros = await prisma.registroAsistencia.findMany({
      where: { estudianteId, fecha: { gte: fechaDesde, lte: fechaHasta } },
      include: { materia: { select: { id: true, nombre: true } } },
      orderBy: [{ fecha: 'asc' }, { materia: { nombre: 'asc' } }],
    });

    // Un día puede tener varias clases; se agrupan y el día toma el peor estado
    type Clase = { id: string; materia: string; materiaId: string; estado: string; observacion: string | null; justificada: boolean };
    const porDia = new Map<number, { fecha: Date; clases: Clase[] }>();
    for (const r of registros) {
      if (!porDia.has(r.fecha.getTime())) porDia.set(r.fecha.getTime(), { fecha: r.fecha, clases: [] });
      porDia.get(r.fecha.getTime())!.clases.push({
        id: r.id, materia: r.materia.nombre, materiaId: r.materiaId,
        estado: r.estado, observacion: r.observacion, justificada: r.justificada,
      });
    }

    const contador = { presencias: 0, ausencias: 0, tardanzas: 0, excusas: 0 };
    let ausenciasSinJustificar = 0;
    const datos = [...porDia.values()].map(({ fecha, clases }) => {
      const estadoDia = peorEstado(clases.map(c => c.estado));
      if (estadoDia === 'AUSENTE') {
        contador.ausencias++;
        if (clases.some(c => c.estado === 'AUSENTE' && !c.justificada)) ausenciasSinJustificar++;
      }
      else if (estadoDia === 'TARDE') contador.tardanzas++;
      else if (estadoDia === 'EXCUSA') contador.excusas++;
      else contador.presencias++;
      return { fecha, estadoDia, clases };
    });

    res.json({ ok: true, datos: { registros: datos, contador, ausenciasSinJustificar } });
  } catch (err) {
    logger.error('Error al obtener historial de asistencia', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── REPORTE DE AUSENCIAS (ADMIN) ──────────────────────────────────────────────

export async function reporteAusencias(req: Request, res: Response): Promise<void> {
  const { grado, mes, anio } = req.query;
  const hoy = hoyUTC();
  const mesNum = mes ? parseInt(mes as string) : hoy.getUTCMonth() + 1;
  const anioNum = anio ? parseInt(anio as string) : hoy.getUTCFullYear();

  if (mesNum < 1 || mesNum > 12) { res.status(400).json({ ok: false, mensaje: 'Mes inválido' }); return; }

  const inicioMes = new Date(Date.UTC(anioNum, mesNum - 1, 1));
  const finMes = new Date(Date.UTC(anioNum, mesNum, 0));

  try {
    const where: Record<string, unknown> = { fecha: { gte: inicioMes, lte: finMes } };
    if (grado) where.estudiante = { gradoId: grado as string };

    const registros = await prisma.registroAsistencia.findMany({
      where,
      select: {
        estado: true, justificada: true, fecha: true,
        estudiante: { select: { id: true, nombres: true, apellidos: true, grado: { select: { nombre: true, grupo: true } } } },
      },
    });

    type Resumen = { estudianteId: string; nombres: string; apellidos: string; grado: string; totalAusencias: number; totalTardanzas: number; totalExcusas: number; ausenciasSinJustificar: number };
    // Se cuenta por DÍA: si falta a varias clases el mismo día, es una sola ausencia
    const diasPorEstudiante = new Map<string, Map<number, { estados: string[]; sinJustificar: boolean }>>();
    const porEstudiante = new Map<string, Resumen>();

    for (const r of registros) {
      const key = r.estudiante.id;
      if (!porEstudiante.has(key)) {
        porEstudiante.set(key, {
          estudianteId: key, nombres: r.estudiante.nombres, apellidos: r.estudiante.apellidos,
          grado: `${r.estudiante.grado.nombre}${r.estudiante.grado.grupo}`,
          totalAusencias: 0, totalTardanzas: 0, totalExcusas: 0, ausenciasSinJustificar: 0,
        });
        diasPorEstudiante.set(key, new Map());
      }
      const dias = diasPorEstudiante.get(key)!;
      const dia = dias.get(r.fecha.getTime()) ?? { estados: [], sinJustificar: false };
      dia.estados.push(r.estado);
      if (r.estado === 'AUSENTE' && !r.justificada) dia.sinJustificar = true;
      dias.set(r.fecha.getTime(), dia);
    }

    for (const [key, dias] of diasPorEstudiante) {
      const item = porEstudiante.get(key)!;
      for (const dia of dias.values()) {
        const estado = peorEstado(dia.estados);
        if (estado === 'AUSENTE') { item.totalAusencias++; if (dia.sinJustificar) item.ausenciasSinJustificar++; }
        else if (estado === 'TARDE') item.totalTardanzas++;
        else if (estado === 'EXCUSA') item.totalExcusas++;
      }
    }

    const datos = Array.from(porEstudiante.values())
      .filter(r => r.totalAusencias > 0 || r.totalTardanzas > 0 || r.totalExcusas > 0)
      .sort((a, b) => b.totalAusencias - a.totalAusencias);

    res.json({ ok: true, datos, meta: { mes: mesNum, anio: anioNum } });
  } catch (err) {
    logger.error('Error al generar reporte de ausencias', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── ALERTAS: 3+ AUSENCIAS SIN JUSTIFICAR EN EL MES (ADMIN) ───────────────────

export async function alertasAusencias(req: Request, res: Response): Promise<void> {
  const { mes, anio } = req.query;
  const hoy = hoyUTC();
  const mesNum = mes ? parseInt(mes as string) : hoy.getUTCMonth() + 1;
  const anioNum = anio ? parseInt(anio as string) : hoy.getUTCFullYear();
  const UMBRAL = 3;

  const inicioMes = new Date(Date.UTC(anioNum, mesNum - 1, 1));
  const finMes = new Date(Date.UTC(anioNum, mesNum, 0));

  try {
    const registros = await prisma.registroAsistencia.findMany({
      where: { fecha: { gte: inicioMes, lte: finMes }, justificada: false, estado: 'AUSENTE' },
      select: {
        fecha: true,
        estudiante: { select: { id: true, nombres: true, apellidos: true, grado: { select: { nombre: true, grupo: true } } } },
      },
    });

    type Alerta = { estudianteId: string; nombres: string; apellidos: string; grado: string; ausenciasSinJustificar: number };
    const conteo = new Map<string, Alerta>();
    // Faltar a varias clases el mismo día cuenta como un solo día ausente
    const dias = new Map<string, Set<number>>();

    for (const r of registros) {
      const key = r.estudiante.id;
      if (!conteo.has(key)) {
        conteo.set(key, { estudianteId: key, nombres: r.estudiante.nombres, apellidos: r.estudiante.apellidos, grado: `${r.estudiante.grado.nombre}${r.estudiante.grado.grupo}`, ausenciasSinJustificar: 0 });
        dias.set(key, new Set());
      }
      dias.get(key)!.add(r.fecha.getTime());
    }
    for (const [key, fechas] of dias) conteo.get(key)!.ausenciasSinJustificar = fechas.size;

    const datos = Array.from(conteo.values()).filter(a => a.ausenciasSinJustificar >= UMBRAL).sort((a, b) => b.ausenciasSinJustificar - a.ausenciasSinJustificar);
    res.json({ ok: true, datos, meta: { mes: mesNum, anio: anioNum, umbral: UMBRAL } });
  } catch (err) {
    logger.error('Error al calcular alertas de ausencias', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}
