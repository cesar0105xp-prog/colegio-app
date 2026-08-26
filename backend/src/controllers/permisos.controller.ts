import { Request, Response } from 'express';
import { PrismaClient, MotivoPermiso } from '@prisma/client';
import { body, param, validationResult } from 'express-validator';
import { audit } from '../utils/audit';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ESTADOS_PERMISO = ['PENDIENTE', 'APROBADO', 'RECHAZADO'];
const MAX_DIAS_RANGO = 30;

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

// ─── VALIDACIONES ─────────────────────────────────────────────────────────────

export const validarSolicitudPermiso = [
  body('estudianteId').isUUID().withMessage('Estudiante inválido'),
  body('fechaPermiso').custom(esFechaValida).withMessage('Fecha inválida (formato YYYY-MM-DD)')
    .custom((valor: string) => {
      const fecha = parseFechaUTC(valor);
      const hoy = hoyUTC();
      const diffDias = Math.round((fecha.getTime() - hoy.getTime()) / 86400000);
      if (Math.abs(diffDias) > MAX_DIAS_RANGO) throw new Error(`La fecha debe estar dentro de ${MAX_DIAS_RANGO} días antes o después de hoy`);
      return true;
    }),
  body('motivoCodigo').isIn(Object.values(MotivoPermiso)).withMessage('Motivo inválido'),
  body('descripcion').trim().isLength({ min: 10, max: 500 }).withMessage('La descripción debe tener entre 10 y 500 caracteres'),
];

export const validarRechazar = [
  param('id').isUUID().withMessage('ID inválido'),
  body('observacionResp').trim().notEmpty().withMessage('El motivo de rechazo es requerido')
    .isLength({ max: 300 }).withMessage('El motivo no puede superar 300 caracteres'),
];

export const validarAprobar = [
  param('id').isUUID().withMessage('ID inválido'),
  body('observacionResp').optional({ checkFalsy: true }).trim().isLength({ max: 300 }).withMessage('Máximo 300 caracteres'),
];

// ─── CREAR SOLICITUD (PADRE) ────────────────────────────────────────────────────

export async function crearSolicitudPermiso(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) { res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) }); return; }

  const { estudianteId, fechaPermiso: fechaStr, motivoCodigo, descripcion } = req.body;
  const fechaPermiso = parseFechaUTC(fechaStr);
  const padreId = req.usuario!.sub;

  try {
    const duplicado = await prisma.solicitudPermiso.findFirst({ where: { estudianteId, fechaPermiso } });
    if (duplicado) { res.status(400).json({ ok: false, mensaje: 'Ya existe una solicitud de permiso para este estudiante en esta fecha' }); return; }

    const solicitud = await prisma.solicitudPermiso.create({
      data: { estudianteId, padreId, fechaPermiso, motivoCodigo, descripcion: descripcion.trim() },
    });

    await audit({ usuarioId: padreId, accion: 'CREAR', entidad: 'solicitudes_permiso', entidadId: solicitud.id, ip: req.ip });
    res.status(201).json({ ok: true, mensaje: 'Solicitud de permiso enviada correctamente', datos: solicitud });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      res.status(400).json({ ok: false, mensaje: 'Ya existe una solicitud de permiso para este estudiante en esta fecha' });
      return;
    }
    logger.error('Error al crear solicitud de permiso', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── LISTAR (ADMIN/SECRETARIO) ──────────────────────────────────────────────────

export async function listarPermisos(req: Request, res: Response): Promise<void> {
  const { estado, fecha, grado } = req.query;
  try {
    const where: Record<string, unknown> = {};
    where.estado = estado && ESTADOS_PERMISO.includes(estado as string) ? estado : 'PENDIENTE';
    if (fecha && esFechaValida(fecha as string)) where.fechaPermiso = parseFechaUTC(fecha as string);
    if (grado && UUID_REGEX.test(grado as string)) where.estudiante = { gradoId: grado as string };

    const solicitudes = await prisma.solicitudPermiso.findMany({
      where,
      include: {
        estudiante: { select: { id: true, nombres: true, apellidos: true, grado: { select: { nombre: true, grupo: true } } } },
        padre: { select: { email: true, perfilPadre: { select: { nombres: true, apellidos: true, telefono: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ ok: true, datos: solicitudes });
  } catch (err) {
    logger.error('Error al listar permisos', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── MIS SOLICITUDES (PADRE) ────────────────────────────────────────────────────

export async function misSolicitudesPermiso(req: Request, res: Response): Promise<void> {
  const { estudianteId } = req.query;
  try {
    const where: Record<string, unknown> = { padreId: req.usuario!.sub };
    if (estudianteId && UUID_REGEX.test(estudianteId as string)) where.estudianteId = estudianteId as string;

    const solicitudes = await prisma.solicitudPermiso.findMany({
      where,
      include: { estudiante: { select: { id: true, nombres: true, apellidos: true, grado: { select: { nombre: true, grupo: true } } } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ ok: true, datos: solicitudes });
  } catch (err) {
    logger.error('Error al listar mis solicitudes de permiso', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── APROBAR / RECHAZAR (ADMIN/SECRETARIO) ─────────────────────────────────────

export async function aprobarPermiso(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) { res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) }); return; }

  const { id } = req.params;
  const { observacionResp } = req.body;
  try {
    const solicitud = await prisma.solicitudPermiso.findUnique({ where: { id } });
    if (!solicitud) { res.status(404).json({ ok: false, mensaje: 'Solicitud no encontrada' }); return; }
    if (solicitud.estado !== 'PENDIENTE') { res.status(400).json({ ok: false, mensaje: 'Esta solicitud ya fue procesada' }); return; }

    const actualizada = await prisma.solicitudPermiso.update({
      where: { id },
      data: { estado: 'APROBADO', revisadoPor: req.usuario!.sub, fechaRevision: new Date(), observacionResp: observacionResp?.trim() || null },
    });

    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'solicitudes_permiso', entidadId: id, datosDespues: { estado: 'APROBADO' }, ip: req.ip });
    res.json({ ok: true, mensaje: 'Solicitud aprobada', datos: actualizada });
  } catch (err) {
    logger.error('Error al aprobar permiso', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function rechazarPermiso(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) { res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) }); return; }

  const { id } = req.params;
  const { observacionResp } = req.body;
  try {
    const solicitud = await prisma.solicitudPermiso.findUnique({ where: { id } });
    if (!solicitud) { res.status(404).json({ ok: false, mensaje: 'Solicitud no encontrada' }); return; }
    if (solicitud.estado !== 'PENDIENTE') { res.status(400).json({ ok: false, mensaje: 'Esta solicitud ya fue procesada' }); return; }

    const actualizada = await prisma.solicitudPermiso.update({
      where: { id },
      data: { estado: 'RECHAZADO', revisadoPor: req.usuario!.sub, fechaRevision: new Date(), observacionResp: observacionResp.trim() },
    });

    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'solicitudes_permiso', entidadId: id, datosDespues: { estado: 'RECHAZADO' }, ip: req.ip });
    res.json({ ok: true, mensaje: 'Solicitud rechazada', datos: actualizada });
  } catch (err) {
    logger.error('Error al rechazar permiso', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── HISTORIAL DE UN ESTUDIANTE (ADMIN/PROF) ───────────────────────────────────

export async function historialPermisosEstudiante(req: Request, res: Response): Promise<void> {
  const { estudianteId } = req.params;
  if (!UUID_REGEX.test(estudianteId)) { res.status(400).json({ ok: false, mensaje: 'Estudiante inválido' }); return; }

  try {
    const solicitudes = await prisma.solicitudPermiso.findMany({
      where: { estudianteId },
      orderBy: { fechaPermiso: 'desc' },
    });
    res.json({ ok: true, datos: solicitudes });
  } catch (err) {
    logger.error('Error al obtener historial de permisos', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}
