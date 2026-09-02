import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { body, param, validationResult } from 'express-validator';
import { audit } from '../utils/audit';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// ─── VALIDACIONES ─────────────────────────────────────────────────────────────
export const validarSolicitudCupo = [
  body('nombreEstudiante').trim().notEmpty().withMessage('Nombre del estudiante requerido').isLength({ min: 2, max: 100 }).withMessage('Entre 2 y 100 caracteres'),
  body('gradoInteres').trim().notEmpty().withMessage('Grado de interés requerido').isLength({ min: 2, max: 50 }).withMessage('Entre 2 y 50 caracteres'),
  body('nombreAcudiente').trim().notEmpty().withMessage('Nombre del acudiente requerido').isLength({ min: 2, max: 100 }).withMessage('Entre 2 y 100 caracteres'),
  body('telefonoAcudiente').trim().notEmpty().withMessage('Teléfono del acudiente requerido').matches(/^[0-9]{7,10}$/).withMessage('Teléfono inválido (7 a 10 dígitos)'),
  body('emailAcudiente').trim().notEmpty().withMessage('Correo del acudiente requerido').isEmail().withMessage('Correo inválido').isLength({ max: 100 }).withMessage('Máximo 100 caracteres'),
];

export const validarEstadoSolicitud = [
  param('id').isUUID().withMessage('Id inválido'),
  body('estado').isIn(['CONTACTADO', 'DESCARTADO']).withMessage('Estado inválido'),
  body('observaciones').optional({ checkFalsy: true }).trim().isLength({ max: 300 }).withMessage('Máximo 300 caracteres'),
];

// ─── CREAR SOLICITUD DE CUPO (público, sin autenticación) ──────────────────────
export async function crearSolicitudCupo(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) });
    return;
  }

  const { nombreEstudiante, gradoInteres, nombreAcudiente, telefonoAcudiente, emailAcudiente } = req.body;

  try {
    const solicitud = await prisma.solicitudCupo.create({
      data: {
        nombreEstudiante: nombreEstudiante.trim(),
        gradoInteres: gradoInteres.trim(),
        nombreAcudiente: nombreAcudiente.trim(),
        telefonoAcudiente: telefonoAcudiente.trim(),
        emailAcudiente: emailAcudiente.trim(),
      },
    });

    res.status(201).json({
      ok: true,
      mensaje: 'Solicitud enviada correctamente. Nos pondremos en contacto pronto.',
      datos: { id: solicitud.id },
    });
  } catch (err) {
    logger.error('Error al crear solicitud de cupo', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── LISTAR SOLICITUDES (secretario/admin) ─────────────────────────────────────
export async function listarSolicitudesCupo(req: Request, res: Response): Promise<void> {
  const { estado } = req.query;
  try {
    const solicitudes = await prisma.solicitudCupo.findMany({
      where: estado ? { estado: estado as 'PENDIENTE' | 'CONTACTADO' | 'MATRICULADO' | 'DESCARTADO' } : undefined,
      include: { matricula: { select: { id: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ ok: true, datos: solicitudes });
  } catch (err) {
    logger.error('Error al listar solicitudes de cupo', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── ACTUALIZAR ESTADO (contactado / descartado) ───────────────────────────────
export async function actualizarEstadoSolicitud(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) });
    return;
  }

  const { id } = req.params;
  const { estado, observaciones } = req.body;

  try {
    const solicitud = await prisma.solicitudCupo.findUnique({ where: { id } });
    if (!solicitud) { res.status(404).json({ ok: false, mensaje: 'Solicitud no encontrada' }); return; }
    if (solicitud.estado === 'MATRICULADO') {
      res.status(400).json({ ok: false, mensaje: 'Esta solicitud ya fue matriculada y no puede cambiar de estado' });
      return;
    }

    await prisma.solicitudCupo.update({
      where: { id },
      data: {
        estado,
        observaciones: observaciones?.trim() || null,
        contactadoPor: req.usuario!.sub,
        fechaContacto: new Date(),
      },
    });

    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'solicitudes_cupo', entidadId: id, datosDespues: { estado }, ip: req.ip });
    res.json({ ok: true, mensaje: 'Solicitud actualizada' });
  } catch (err) {
    logger.error('Error al actualizar solicitud de cupo', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}
