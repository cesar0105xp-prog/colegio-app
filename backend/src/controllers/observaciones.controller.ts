import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import { audit } from '../utils/audit';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export const validarObservacion = [
  body('estudianteId').isUUID().withMessage('Estudiante inválido'),
  body('tipo').isIn(['POSITIVA','NEGATIVA','NEUTRA','DISCIPLINARIA','ACADEMICA','CONVIVENCIA']).withMessage('Tipo inválido'),
  body('descripcion').trim().notEmpty().withMessage('La descripción es requerida')
    .isLength({ min: 10, max: 1000 }).withMessage('Entre 10 y 1000 caracteres'),
  body('materiaId').optional().isUUID().withMessage('Materia inválida'),
];

export const validarEditarObservacion = [
  body('tipo').isIn(['POSITIVA','NEGATIVA','NEUTRA','DISCIPLINARIA','ACADEMICA','CONVIVENCIA']).withMessage('Tipo inválido'),
  body('descripcion').trim().notEmpty().withMessage('La descripción es requerida')
    .isLength({ min: 10, max: 1000 }).withMessage('Entre 10 y 1000 caracteres'),
  body('materiaId').optional().isUUID().withMessage('Materia inválida'),
];

// ─── LISTAR OBSERVACIONES ─────────────────────────────────────────────────────
export async function listarObservaciones(req: Request, res: Response): Promise<void> {
  const { estudianteId } = req.params;
  try {
    const observaciones = await prisma.observacion.findMany({
      where: { estudianteId },
      include: {
        profesor: { select: { nombres: true, apellidos: true } },
        materia: { select: { nombre: true } },
        vistas: true,
      },
      orderBy: { fecha: 'desc' },
    });

    res.json({
      ok: true,
      datos: observaciones.map(o => ({
        id: o.id,
        tipo: o.tipo,
        descripcion: o.descripcion,
        fecha: o.fecha,
        profesor: o.profesor,
        materia: o.materia,
        profesorId: o.profesorId,
        yaVista: o.vistas.length > 0,
      })),
    });
  } catch (err) {
    logger.error('Error al listar observaciones', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── CREAR OBSERVACIÓN ────────────────────────────────────────────────────────
export async function crearObservacion(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) });
    return;
  }

  const { estudianteId, tipo, descripcion, materiaId } = req.body;

  try {
    const profesor = await prisma.profesor.findUnique({ where: { usuarioId: req.usuario!.sub } });
    if (!profesor && req.usuario!.rol === 'PROFESOR') {
      res.status(403).json({ ok: false, mensaje: 'Perfil de profesor no encontrado' });
      return;
    }

    const observacion = await prisma.observacion.create({
      data: {
        estudianteId,
        tipo,
        descripcion: descripcion.trim(),
        profesorId: profesor!.id,
        materiaId: materiaId ?? null,
      },
      include: {
        profesor: { select: { nombres: true, apellidos: true } },
        materia: { select: { nombre: true } },
      },
    });

    await audit({ usuarioId: req.usuario!.sub, accion: 'CREAR', entidad: 'observaciones', entidadId: observacion.id, datosDespues: observacion, ip: req.ip });
    res.status(201).json({ ok: true, datos: observacion });
  } catch (err) {
    logger.error('Error al crear observación', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── EDITAR OBSERVACIÓN ───────────────────────────────────────────────────────
export async function editarObservacion(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) });
    return;
  }

  const { id } = req.params;
  const { tipo, descripcion, materiaId } = req.body;

  try {
    const obs = await prisma.observacion.findUnique({ where: { id } });
    if (!obs) { res.status(404).json({ ok: false, mensaje: 'Observación no encontrada' }); return; }

    // Profesor solo puede editar las suyas
    if (req.usuario!.rol === 'PROFESOR') {
      const profesor = await prisma.profesor.findUnique({ where: { usuarioId: req.usuario!.sub } });
      if (!profesor || obs.profesorId !== profesor.id) {
        res.status(403).json({ ok: false, mensaje: 'Solo puedes editar tus propias observaciones' });
        return;
      }
    }

    const actualizada = await prisma.observacion.update({
      where: { id },
      data: { tipo, descripcion: descripcion.trim(), materiaId: materiaId ?? null },
      include: {
        profesor: { select: { nombres: true, apellidos: true } },
        materia: { select: { nombre: true } },
      },
    });

    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'observaciones', entidadId: id, datosAntes: obs, datosDespues: actualizada, ip: req.ip });
    res.json({ ok: true, datos: actualizada });
  } catch (err) {
    logger.error('Error al editar observación', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── ELIMINAR OBSERVACIÓN ─────────────────────────────────────────────────────
export async function eliminarObservacion(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const obs = await prisma.observacion.findUnique({ where: { id } });
    if (!obs) { res.status(404).json({ ok: false, mensaje: 'Observación no encontrada' }); return; }

    // Profesor solo puede eliminar las suyas
    if (req.usuario!.rol === 'PROFESOR') {
      const profesor = await prisma.profesor.findUnique({ where: { usuarioId: req.usuario!.sub } });
      if (!profesor || obs.profesorId !== profesor.id) {
        res.status(403).json({ ok: false, mensaje: 'Solo puedes eliminar tus propias observaciones' });
        return;
      }
    }

    await prisma.observacionVista.deleteMany({ where: { observacionId: id } });
    await prisma.observacion.delete({ where: { id } });
    await audit({ usuarioId: req.usuario!.sub, accion: 'ELIMINAR', entidad: 'observaciones', entidadId: id, datosAntes: obs, ip: req.ip });
    res.json({ ok: true, mensaje: 'Observación eliminada' });
  } catch (err) {
    logger.error('Error al eliminar observación', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── MARCAR OBSERVACIÓN COMO VISTA ───────────────────────────────────────────
export async function marcarObservacionVista(req: Request, res: Response): Promise<void> {
  const { observacionId } = req.params;
  try {
    const padre = await prisma.padre.findUnique({ where: { usuarioId: req.usuario!.sub } });
    if (!padre) { res.status(404).json({ ok: false, mensaje: 'Perfil de padre no encontrado' }); return; }

    await prisma.observacionVista.upsert({
      where: { observacionId_padreId: { observacionId, padreId: padre.id } },
      update: {},
      create: { observacionId, padreId: padre.id },
    });

    res.json({ ok: true, mensaje: 'Observación marcada como vista' });
  } catch (err) {
    logger.error('Error al marcar observación como vista', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}