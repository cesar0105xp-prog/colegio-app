import { Request, Response } from 'express';
import { PrismaClient, TipoEvento } from '@prisma/client';
import { body, param, validationResult } from 'express-validator';
import { audit } from '../utils/audit';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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

// ─── VALIDACIONES ─────────────────────────────────────────────────────────────

export const validarEvento = [
  body('titulo').trim().isLength({ min: 3, max: 100 }).withMessage('El título debe tener entre 3 y 100 caracteres'),
  body('descripcion').optional({ checkFalsy: true }).trim().isLength({ max: 800 }).withMessage('Descripción máximo 800 caracteres'),
  body('fechaInicio').custom(esFechaValida).withMessage('Fecha de inicio inválida (formato YYYY-MM-DD)'),
  body('fechaFin').optional({ checkFalsy: true }).custom(esFechaValida).withMessage('Fecha de fin inválida (formato YYYY-MM-DD)'),
  body('tipoEvento').isIn(Object.values(TipoEvento)).withMessage('Tipo de evento inválido'),
  body('gradoId').optional({ checkFalsy: true }).isUUID().withMessage('Grado inválido'),
];

export const validarTarea = [
  body('titulo').trim().isLength({ min: 3, max: 100 }).withMessage('El título debe tener entre 3 y 100 caracteres'),
  body('descripcion').optional({ checkFalsy: true }).trim().isLength({ max: 800 }).withMessage('Descripción máximo 800 caracteres'),
  body('fechaEntrega').custom(esFechaValida).withMessage('Fecha de entrega inválida (formato YYYY-MM-DD)'),
  body('materiaId').isUUID().withMessage('Materia inválida'),
  body('gradoId').isUUID().withMessage('Grado inválido'),
];

export const validarId = [param('id').isUUID().withMessage('ID inválido')];

// ─── LISTAR AGENDA (eventos + tareas del período, todos los roles) ────────────

export async function listarAgenda(req: Request, res: Response): Promise<void> {
  const { desde, hasta, gradoId } = req.query;
  if (!desde || !hasta || !esFechaValida(desde as string) || !esFechaValida(hasta as string)) {
    res.status(400).json({ ok: false, mensaje: 'Debes indicar un rango de fechas válido (desde, hasta)' });
    return;
  }
  const fechaDesde = parseFechaUTC(desde as string);
  const fechaHasta = parseFechaUTC(hasta as string);
  const gradoFiltro = gradoId && UUID_REGEX.test(gradoId as string) ? (gradoId as string) : undefined;

  try {
    const whereEventos: Record<string, unknown> = {
      visible: true,
      fechaInicio: { gte: fechaDesde, lte: fechaHasta },
    };
    if (gradoFiltro) whereEventos.OR = [{ gradoId: gradoFiltro }, { gradoId: null }];

    const whereTareas: Record<string, unknown> = { fechaEntrega: { gte: fechaDesde, lte: fechaHasta } };
    if (gradoFiltro) whereTareas.gradoId = gradoFiltro;

    const [eventos, tareas] = await Promise.all([
      prisma.eventoAgenda.findMany({
        where: whereEventos,
        include: { grado: { select: { id: true, nombre: true, grupo: true } } },
        orderBy: { fechaInicio: 'asc' },
      }),
      prisma.tareaAgenda.findMany({
        where: whereTareas,
        include: {
          materia: { select: { id: true, nombre: true } },
          grado: { select: { id: true, nombre: true, grupo: true } },
        },
        orderBy: { fechaEntrega: 'asc' },
      }),
    ]);

    res.json({ ok: true, datos: { eventos, tareas } });
  } catch (err) {
    logger.error('Error al listar agenda', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── EVENTOS ───────────────────────────────────────────────────────────────────

export async function crearEvento(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) { res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) }); return; }

  const { titulo, descripcion, fechaInicio: fi, fechaFin: ff, tipoEvento, gradoId } = req.body;
  const fechaInicio = parseFechaUTC(fi);
  const fechaFin = ff ? parseFechaUTC(ff) : null;

  if (fechaFin && fechaFin.getTime() < fechaInicio.getTime()) {
    res.status(400).json({ ok: false, mensaje: 'La fecha de fin no puede ser anterior a la fecha de inicio' });
    return;
  }

  try {
    const evento = await prisma.eventoAgenda.create({
      data: {
        titulo: titulo.trim(), descripcion: descripcion?.trim() || null,
        fechaInicio, fechaFin, tipoEvento, gradoId: gradoId || null,
        creadorId: req.usuario!.sub,
      },
    });
    await audit({ usuarioId: req.usuario!.sub, accion: 'CREAR', entidad: 'eventos_agenda', entidadId: evento.id, ip: req.ip });
    res.status(201).json({ ok: true, mensaje: 'Evento creado correctamente', datos: evento });
  } catch (err) {
    logger.error('Error al crear evento de agenda', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function editarEvento(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) { res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) }); return; }

  const { id } = req.params;
  try {
    const evento = await prisma.eventoAgenda.findUnique({ where: { id } });
    if (!evento) { res.status(404).json({ ok: false, mensaje: 'Evento no encontrado' }); return; }
    if (evento.creadorId !== req.usuario!.sub && req.usuario!.rol !== 'ADMINISTRADOR') {
      res.status(403).json({ ok: false, mensaje: 'Solo el creador del evento o un administrador puede editarlo' });
      return;
    }

    const { titulo, descripcion, fechaInicio: fi, fechaFin: ff, tipoEvento, gradoId, visible } = req.body;
    const fechaInicio = parseFechaUTC(fi);
    const fechaFin = ff ? parseFechaUTC(ff) : null;
    if (fechaFin && fechaFin.getTime() < fechaInicio.getTime()) {
      res.status(400).json({ ok: false, mensaje: 'La fecha de fin no puede ser anterior a la fecha de inicio' });
      return;
    }

    const actualizado = await prisma.eventoAgenda.update({
      where: { id },
      data: {
        titulo: titulo.trim(), descripcion: descripcion?.trim() || null,
        fechaInicio, fechaFin, tipoEvento, gradoId: gradoId || null,
        visible: visible ?? evento.visible,
      },
    });
    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'eventos_agenda', entidadId: id, ip: req.ip });
    res.json({ ok: true, mensaje: 'Evento actualizado correctamente', datos: actualizado });
  } catch (err) {
    logger.error('Error al editar evento de agenda', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function eliminarEvento(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!UUID_REGEX.test(id)) { res.status(400).json({ ok: false, mensaje: 'ID inválido' }); return; }

  try {
    const evento = await prisma.eventoAgenda.findUnique({ where: { id } });
    if (!evento) { res.status(404).json({ ok: false, mensaje: 'Evento no encontrado' }); return; }

    await prisma.eventoAgenda.delete({ where: { id } });
    await audit({ usuarioId: req.usuario!.sub, accion: 'ELIMINAR', entidad: 'eventos_agenda', entidadId: id, ip: req.ip });
    res.json({ ok: true, mensaje: 'Evento eliminado correctamente' });
  } catch (err) {
    logger.error('Error al eliminar evento de agenda', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── TAREAS ────────────────────────────────────────────────────────────────────

export async function crearTarea(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) { res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) }); return; }

  const { titulo, descripcion, fechaEntrega: fe, materiaId, gradoId } = req.body;
  const profesorId = req.usuario!.sub;
  const fechaEntrega = parseFechaUTC(fe);

  try {
    const asignacion = await prisma.materiaGradoProfesor.findFirst({
      where: { materiaId, gradoId, profesor: { usuarioId: profesorId } },
    });
    if (!asignacion) {
      res.status(403).json({ ok: false, mensaje: 'No tienes esta materia asignada en este grado' });
      return;
    }

    const tarea = await prisma.tareaAgenda.create({
      data: { titulo: titulo.trim(), descripcion: descripcion?.trim() || null, fechaEntrega, materiaId, gradoId, profesorId },
    });
    await audit({ usuarioId: profesorId, accion: 'CREAR', entidad: 'tareas_agenda', entidadId: tarea.id, ip: req.ip });
    res.status(201).json({ ok: true, mensaje: 'Tarea publicada correctamente', datos: tarea });
  } catch (err) {
    logger.error('Error al crear tarea de agenda', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function editarTarea(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) { res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) }); return; }

  const { id } = req.params;
  try {
    const tarea = await prisma.tareaAgenda.findUnique({ where: { id } });
    if (!tarea) { res.status(404).json({ ok: false, mensaje: 'Tarea no encontrada' }); return; }
    if (tarea.profesorId !== req.usuario!.sub && req.usuario!.rol !== 'ADMINISTRADOR') {
      res.status(403).json({ ok: false, mensaje: 'Solo el profesor que la creó o un administrador puede editarla' });
      return;
    }

    const { titulo, descripcion, fechaEntrega: fe, materiaId, gradoId } = req.body;

    if (req.usuario!.rol !== 'ADMINISTRADOR') {
      const asignacion = await prisma.materiaGradoProfesor.findFirst({ where: { materiaId, gradoId, profesor: { usuarioId: req.usuario!.sub } } });
      if (!asignacion) { res.status(403).json({ ok: false, mensaje: 'No tienes esta materia asignada en este grado' }); return; }
    }

    const actualizada = await prisma.tareaAgenda.update({
      where: { id },
      data: { titulo: titulo.trim(), descripcion: descripcion?.trim() || null, fechaEntrega: parseFechaUTC(fe), materiaId, gradoId },
    });
    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'tareas_agenda', entidadId: id, ip: req.ip });
    res.json({ ok: true, mensaje: 'Tarea actualizada correctamente', datos: actualizada });
  } catch (err) {
    logger.error('Error al editar tarea de agenda', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function eliminarTarea(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!UUID_REGEX.test(id)) { res.status(400).json({ ok: false, mensaje: 'ID inválido' }); return; }

  try {
    const tarea = await prisma.tareaAgenda.findUnique({ where: { id } });
    if (!tarea) { res.status(404).json({ ok: false, mensaje: 'Tarea no encontrada' }); return; }
    if (tarea.profesorId !== req.usuario!.sub && req.usuario!.rol !== 'ADMINISTRADOR') {
      res.status(403).json({ ok: false, mensaje: 'Solo el profesor que la creó o un administrador puede eliminarla' });
      return;
    }

    await prisma.tareaAgenda.delete({ where: { id } });
    await audit({ usuarioId: req.usuario!.sub, accion: 'ELIMINAR', entidad: 'tareas_agenda', entidadId: id, ip: req.ip });
    res.json({ ok: true, mensaje: 'Tarea eliminada correctamente' });
  } catch (err) {
    logger.error('Error al eliminar tarea de agenda', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── MIS TAREAS (PADRE) ─────────────────────────────────────────────────────────

export async function misTareas(req: Request, res: Response): Promise<void> {
  try {
    const padre = await prisma.padre.findUnique({ where: { usuarioId: req.usuario!.sub }, include: { hijos: { include: { estudiante: true } } } });
    if (!padre) { res.status(403).json({ ok: false, mensaje: 'Perfil de padre no encontrado' }); return; }

    const gradoIds = [...new Set(padre.hijos.map(h => h.estudiante.gradoId))];
    if (gradoIds.length === 0) { res.json({ ok: true, datos: [] }); return; }

    const hoy = new Date();
    const inicioHoy = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));

    const tareas = await prisma.tareaAgenda.findMany({
      where: { gradoId: { in: gradoIds }, fechaEntrega: { gte: inicioHoy } },
      include: {
        materia: { select: { id: true, nombre: true } },
        grado: { select: { id: true, nombre: true, grupo: true } },
      },
      orderBy: { fechaEntrega: 'asc' },
    });

    res.json({ ok: true, datos: tareas });
  } catch (err) {
    logger.error('Error al obtener mis tareas', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}
