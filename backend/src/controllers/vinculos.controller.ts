import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import { audit } from '../utils/audit';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// ─── VALIDACIONES ────────────────────────────────────────────────────────────
export const validarVinculo = [
  body('padreId').isUUID().withMessage('Padre inválido'),
  body('estudianteId').isUUID().withMessage('Estudiante inválido'),
  body('parentesco')
    .trim()
    .isIn(['padre', 'madre', 'acudiente', 'abuelo', 'abuela', 'tio', 'tia', 'hermano', 'hermana', 'otro'])
    .withMessage('Parentesco inválido'),
];

// ─── LISTAR TODOS LOS VÍNCULOS ────────────────────────────────────────────────
export async function listarVinculos(req: Request, res: Response): Promise<void> {
  const { estudianteId, padreId } = req.query;
  try {
    const vinculos = await prisma.padreEstudiante.findMany({
      where: {
        estudianteId: estudianteId as string | undefined,
        padreId: padreId as string | undefined,
      },
      include: {
        padre: { select: { id: true, nombres: true, apellidos: true, numeroDocumento: true, telefono: true } },
        estudiante: { select: { id: true, nombres: true, apellidos: true, numeroDocumento: true, grado: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ ok: true, datos: vinculos });
  } catch (err) {
    logger.error('Error al listar vínculos', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── CREAR VÍNCULO PADRE-ESTUDIANTE ───────────────────────────────────────────
export async function crearVinculo(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) });
    return;
  }

  const { padreId, estudianteId, parentesco, esPrincipal } = req.body;

  try {
    const padre = await prisma.padre.findUnique({ where: { id: padreId } });
    const estudiante = await prisma.estudiante.findUnique({ where: { id: estudianteId } });

    if (!padre) { res.status(404).json({ ok: false, mensaje: 'Padre no encontrado' }); return; }
    if (!estudiante) { res.status(404).json({ ok: false, mensaje: 'Estudiante no encontrado' }); return; }

    const existe = await prisma.padreEstudiante.findUnique({
      where: { padreId_estudianteId: { padreId, estudianteId } },
    });
    if (existe) {
      res.status(409).json({ ok: false, mensaje: 'Este padre ya está vinculado a este estudiante' });
      return;
    }

    // Si se marca como principal, desmarcar otros principales del mismo estudiante
    if (esPrincipal) {
      await prisma.padreEstudiante.updateMany({
        where: { estudianteId },
        data: { esPrincipal: false },
      });
    }

    const vinculo = await prisma.padreEstudiante.create({
      data: { padreId, estudianteId, parentesco, esPrincipal: esPrincipal ?? false },
      include: {
        padre: { select: { nombres: true, apellidos: true } },
        estudiante: { select: { nombres: true, apellidos: true } },
      },
    });

    await audit({
      usuarioId: req.usuario!.sub,
      accion: 'CREAR',
      entidad: 'padres_estudiantes',
      entidadId: vinculo.id,
      datosDespues: { padreId, estudianteId, parentesco },
      ip: req.ip,
    });

    res.status(201).json({ ok: true, datos: vinculo });
  } catch (err) {
    logger.error('Error al crear vínculo', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── ELIMINAR VÍNCULO ─────────────────────────────────────────────────────────
export async function eliminarVinculo(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const vinculo = await prisma.padreEstudiante.findUnique({ where: { id } });
    if (!vinculo) { res.status(404).json({ ok: false, mensaje: 'Vínculo no encontrado' }); return; }

    await prisma.padreEstudiante.delete({ where: { id } });

    await audit({
      usuarioId: req.usuario!.sub,
      accion: 'ELIMINAR',
      entidad: 'padres_estudiantes',
      entidadId: id,
      datosAntes: vinculo,
      ip: req.ip,
    });

    res.json({ ok: true, mensaje: 'Vínculo eliminado correctamente' });
  } catch (err) {
    logger.error('Error al eliminar vínculo', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}