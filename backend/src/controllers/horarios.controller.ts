import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { audit } from '../utils/audit';
import { logger } from '../utils/logger';

import { prisma } from '../utils/prisma';

// Horario semanal de clases. En los grados ROTATIVO_HORARIO, la franja marcada
// como primera clase define qué profesor llama a lista ese día.

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export const validarHorario = [
  body('gradoId').isUUID().withMessage('Grado inválido'),
  body('materiaId').isUUID().withMessage('Materia inválida'),
  body('profesorId').isUUID().withMessage('Profesor inválido'),
  body('diaSemana').isInt({ min: 1, max: 5 }).withMessage('Día de la semana entre 1 (lunes) y 5 (viernes)'),
  body('horaInicio').matches(HORA).withMessage('Hora de inicio inválida (formato HH:MM)'),
  body('horaFin').matches(HORA).withMessage('Hora de fin inválida (formato HH:MM)'),
  body('esPrimeraClase').optional().isBoolean().withMessage('Valor inválido en primera clase'),
];

export async function listarHorarios(req: Request, res: Response): Promise<void> {
  const { gradoId, profesorId } = req.query;
  try {
    const horarios = await prisma.horarioClase.findMany({
      where: {
        gradoId: gradoId as string | undefined,
        profesorId: profesorId as string | undefined,
      },
      include: {
        materia: { select: { id: true, nombre: true } },
        profesor: { select: { id: true, nombres: true, apellidos: true } },
        grado: { select: { id: true, nombre: true, grupo: true, tipoAsistencia: true } },
      },
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
    });
    res.json({ ok: true, datos: horarios });
  } catch (err) {
    logger.error('Error al listar horarios', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function crearHorario(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) { res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) }); return; }

  const { gradoId, materiaId, profesorId, diaSemana, horaInicio, horaFin, esPrimeraClase } = req.body;

  try {
    if (horaFin <= horaInicio) {
      res.status(400).json({ ok: false, mensaje: 'La hora de fin debe ser posterior a la de inicio' });
      return;
    }

    // El profesor debe dictar esa materia en ese grado
    const asignacion = await prisma.materiaGradoProfesor.findFirst({ where: { gradoId, materiaId, profesorId } });
    if (!asignacion) {
      res.status(400).json({ ok: false, mensaje: 'Ese profesor no tiene esa materia asignada en ese grado' });
      return;
    }

    // Una sola primera clase por grado y día
    if (esPrimeraClase) {
      const yaHay = await prisma.horarioClase.findFirst({ where: { gradoId, diaSemana: Number(diaSemana), esPrimeraClase: true } });
      if (yaHay) {
        res.status(409).json({ ok: false, mensaje: 'Ese grado ya tiene marcada la primera clase de ese día' });
        return;
      }
    }

    const horario = await prisma.horarioClase.create({
      data: {
        gradoId, materiaId, profesorId,
        diaSemana: Number(diaSemana), horaInicio, horaFin,
        esPrimeraClase: !!esPrimeraClase,
      },
      include: { materia: true, profesor: true },
    });

    await audit({ usuarioId: req.usuario!.sub, accion: 'CREAR', entidad: 'horarios_clase', entidadId: horario.id, datosDespues: horario, ip: req.ip });
    res.status(201).json({ ok: true, datos: horario });
  } catch (err) {
    logger.error('Error al crear franja de horario', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function eliminarHorario(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const horario = await prisma.horarioClase.findUnique({ where: { id } });
    if (!horario) { res.status(404).json({ ok: false, mensaje: 'Franja de horario no encontrada' }); return; }

    await prisma.horarioClase.delete({ where: { id } });
    await audit({ usuarioId: req.usuario!.sub, accion: 'ELIMINAR', entidad: 'horarios_clase', entidadId: id, datosAntes: horario, ip: req.ip });
    res.json({ ok: true, mensaje: 'Franja eliminada' });
  } catch (err) {
    logger.error('Error al eliminar franja de horario', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── RESUMEN: QUIÉN TOMA ASISTENCIA CADA DÍA ─────────────────────────────────

export async function resumenResponsablesAsistencia(_req: Request, res: Response): Promise<void> {
  try {
    const grados = await prisma.grado.findMany({
      include: {
        directorCurso: { select: { id: true, nombres: true, apellidos: true } },
        horarios: {
          where: { esPrimeraClase: true },
          include: {
            materia: { select: { nombre: true } },
            profesor: { select: { id: true, nombres: true, apellidos: true } },
          },
          orderBy: { diaSemana: 'asc' },
        },
      },
      orderBy: [{ nivel: 'asc' }, { nombre: 'asc' }, { grupo: 'asc' }],
    });

    const datos = grados.map(g => {
      // Lunes (1) a viernes (5)
      const porDia = [1, 2, 3, 4, 5].map(dia => {
        if (g.tipoAsistencia === 'DIRECTOR_FIJO') {
          return {
            diaSemana: dia,
            profesor: g.directorCurso ? `${g.directorCurso.nombres} ${g.directorCurso.apellidos}` : null,
            materia: null as string | null,
          };
        }
        const franja = g.horarios.find(h => h.diaSemana === dia);
        return {
          diaSemana: dia,
          profesor: franja ? `${franja.profesor.nombres} ${franja.profesor.apellidos}` : null,
          materia: franja?.materia.nombre ?? null,
        };
      });

      const diasSinResponsable = porDia.filter(d => !d.profesor).map(d => d.diaSemana);

      return {
        gradoId: g.id,
        grado: `${g.nombre}${g.grupo}`,
        nivel: g.nivel,
        tipoAsistencia: g.tipoAsistencia,
        directorCurso: g.directorCurso ? `${g.directorCurso.nombres} ${g.directorCurso.apellidos}` : null,
        porDia,
        diasSinResponsable,
      };
    });

    res.json({ ok: true, datos });
  } catch (err) {
    logger.error('Error al generar el resumen de responsables de asistencia', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}
