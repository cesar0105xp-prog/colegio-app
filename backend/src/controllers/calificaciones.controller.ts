import { Request, Response } from 'express';
import { PrismaClient, TipoActividad } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import { audit } from '../utils/audit';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// ─── VALIDACIONES ────────────────────────────────────────────────────────────

export const validarActividad = [
  body('nombre')
    .trim()
    .notEmpty().withMessage('El nombre de la actividad es requerido')
    .isLength({ max: 100 }).withMessage('Máximo 100 caracteres'),
  body('tipo')
    .isIn(Object.values(TipoActividad))
    .withMessage('Tipo de actividad inválido'),
  body('porcentaje')
    .isInt({ min: 1, max: 100 })
    .withMessage('El porcentaje debe ser un número entre 1 y 100'),
  body('materiaId').isUUID().withMessage('Materia inválida'),
  body('gradoId').isUUID().withMessage('Grado inválido'),
  body('periodoId').isUUID().withMessage('Período inválido'),
];

export const validarEditarActividad = [
  body('nombre').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Nombre entre 1 y 100 caracteres'),
  body('tipo').optional().isIn(Object.values(TipoActividad)).withMessage('Tipo de actividad inválido'),
  body('descripcion').optional({ checkFalsy: true }).trim().isLength({ max: 500 }).withMessage('Máximo 500 caracteres'),
  body('fechaEntrega').optional({ checkFalsy: true }).isISO8601().withMessage('Fecha de entrega inválida'),
];

export const validarCalificacion = [
  body('actividadId').isUUID().withMessage('Actividad inválida'),
  body('estudianteId').isUUID().withMessage('Estudiante inválido'),
  body('valor')
    .isFloat({ min: 0, max: 100 })
    .withMessage('La nota debe estar entre 0 y 100'),
  body('observacion')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('La observación no puede superar 500 caracteres'),
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Valida que la suma de porcentajes en un periodo+materia+grado no supere 100%
 * antes de crear o editar una actividad.
 */
async function validarSumaPorcentajes(
  materiaId: string,
  gradoId: string,
  periodoId: string,
  porcentaje: number,
  excluirActividadId?: string
): Promise<{ ok: boolean; sumaActual: number }> {
  const actividades = await prisma.actividad.findMany({
    where: {
      materiaId,
      gradoId,
      periodoId,
      id: excluirActividadId ? { not: excluirActividadId } : undefined,
    },
    select: { porcentaje: true },
  });

  const sumaActual = actividades.reduce(
    (acc, a) => acc + Number(a.porcentaje),
    0
  );

  return { ok: sumaActual + porcentaje <= 100, sumaActual };
}

/**
 * Calcula la nota final ponderada de un estudiante en una materia/período.
 * notaPeriodo = SUM(calificacion.valor * actividad.porcentaje / 100)
 */
export async function calcularNotaPeriodo(
  estudianteId: string,
  materiaId: string,
  periodoId: string
): Promise<number | null> {
  const calificaciones = await prisma.calificacion.findMany({
    where: {
      estudianteId,
      actividad: { materiaId, periodoId },
    },
    include: {
      actividad: { select: { porcentaje: true } },
    },
  });

  if (calificaciones.length === 0) return null;

  const nota = calificaciones.reduce((acc, c) => {
    return acc + Number(c.valor) * (Number(c.actividad.porcentaje) / 100);
  }, 0);

  return Math.round(nota * 10) / 10; // redondear a 1 decimal
}

// ─── ACTIVIDADES ─────────────────────────────────────────────────────────────

export async function crearActividad(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) });
    return;
  }

  const { nombre, tipo, porcentaje, descripcion, fechaEntrega, materiaId, gradoId, periodoId } = req.body;

  try {
    // Verificar que el profesor tiene asignada esta materia y grado
    const profesor = await prisma.profesor.findUnique({ where: { usuarioId: req.usuario!.sub } });
    if (!profesor) {
      res.status(403).json({ ok: false, mensaje: 'Perfil de profesor no encontrado' });
      return;
    }

    // Admins y secretarios pueden omitir esta verificación
    if (req.usuario!.rol === 'PROFESOR') {
      const asignacion = await prisma.materiaGradoProfesor.findFirst({
        where: { materiaId, gradoId, profesorId: profesor.id },
      });
      if (!asignacion) {
        res.status(403).json({ ok: false, mensaje: 'No tienes esta materia asignada para este grado' });
        return;
      }
    }

    // Validar suma de porcentajes
    const { ok, sumaActual } = await validarSumaPorcentajes(materiaId, gradoId, periodoId, porcentaje);
    if (!ok) {
      res.status(400).json({
        ok: false,
        mensaje: `Los porcentajes superan el 100%. Suma actual: ${sumaActual}%. Disponible: ${100 - sumaActual}%`,
      });
      return;
    }

    const actividad = await prisma.actividad.create({
      data: {
        nombre: nombre.trim(),
        tipo,
        porcentaje,
        descripcion: descripcion?.trim(),
        fechaEntrega: fechaEntrega ? new Date(fechaEntrega) : undefined,
        materiaId,
        gradoId,
        periodoId,
        profesorId: profesor.id,
      },
      include: { materia: true, grado: true, periodo: true },
    });

    await audit({
      usuarioId: req.usuario!.sub,
      accion: 'CREAR',
      entidad: 'actividades',
      entidadId: actividad.id,
      datosDespues: actividad,
      ip: req.ip,
    });

    res.status(201).json({ ok: true, datos: actividad });
  } catch (err) {
    logger.error('Error al crear actividad', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function listarActividades(req: Request, res: Response): Promise<void> {
  const { materiaId, gradoId, periodoId } = req.query;

  try {
    const actividades = await prisma.actividad.findMany({
      where: {
        materiaId: materiaId as string | undefined,
        gradoId: gradoId as string | undefined,
        periodoId: periodoId as string | undefined,
      },
      include: { materia: true, grado: true, periodo: true, profesor: true },
      orderBy: { createdAt: 'asc' },
    });

    // Calcular porcentaje total ya asignado
    const totalPorcentaje = actividades.reduce((acc, a) => acc + Number(a.porcentaje), 0);

    res.json({ ok: true, datos: actividades, meta: { totalPorcentaje, restante: 100 - totalPorcentaje } });
  } catch (err) {
    logger.error('Error al listar actividades', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── CALIFICACIONES ──────────────────────────────────────────────────────────

export async function registrarCalificacion(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) });
    return;
  }

  const { actividadId, estudianteId, valor, observacion } = req.body;

  try {
    const actividad = await prisma.actividad.findUnique({
      where: { id: actividadId },
      include: { materia: true, periodo: true },
    });

    if (!actividad) {
      res.status(404).json({ ok: false, mensaje: 'Actividad no encontrada' });
      return;
    }

    // Upsert: si ya existe la calificación, la actualiza
    const anterior = await prisma.calificacion.findUnique({
      where: { actividadId_estudianteId: { actividadId, estudianteId } },
    });

    const calificacion = await prisma.calificacion.upsert({
      where: { actividadId_estudianteId: { actividadId, estudianteId } },
      update: { valor, observacion: observacion?.trim() },
      create: { actividadId, estudianteId, valor, observacion: observacion?.trim() },
    });

    await audit({
      usuarioId: req.usuario!.sub,
      accion: anterior ? 'EDITAR' : 'CREAR',
      entidad: 'calificaciones',
      entidadId: calificacion.id,
      datosAntes: anterior ?? undefined,
      datosDespues: calificacion,
      ip: req.ip,
    });

    // Calcular y retornar nota del período actualizada
    const notaPeriodo = await calcularNotaPeriodo(estudianteId, actividad.materiaId, actividad.periodoId);

    res.json({ ok: true, datos: { calificacion, notaPeriodo } });
  } catch (err) {
    logger.error('Error al registrar calificación', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── BOLETÍN COMPLETO DEL ESTUDIANTE ─────────────────────────────────────────

export async function obtenerBoletin(req: Request, res: Response): Promise<void> {
  const { estudianteId } = req.params;
  const { periodoId } = req.query;

  try {
    const estudiante = await prisma.estudiante.findUnique({
      where: { id: estudianteId },
      include: { grado: true },
    });

    if (!estudiante) {
      res.status(404).json({ ok: false, mensaje: 'Estudiante no encontrado' });
      return;
    }

    // Obtener todas las materias del grado
    const materiasGrado = await prisma.materiaGradoProfesor.findMany({
      where: { gradoId: estudiante.gradoId },
      include: { materia: true, profesor: true },
    });

    // Para cada materia, calcular la nota del período
    const boletin = await Promise.all(
      materiasGrado.map(async (mg) => {
        const actividades = await prisma.actividad.findMany({
          where: {
            materiaId: mg.materiaId,
            gradoId: estudiante.gradoId,
            periodoId: periodoId as string | undefined,
          },
          include: {
            calificaciones: { where: { estudianteId } },
          },
          orderBy: { createdAt: 'asc' },
        });

        const notaPeriodo = periodoId
          ? await calcularNotaPeriodo(estudianteId, mg.materiaId, periodoId as string)
          : null;

        return {
          materia: mg.materia,
          profesor: `${mg.profesor.nombres} ${mg.profesor.apellidos}`,
          actividades: actividades.map((a) => ({
            id: a.id,
            nombre: a.nombre,
            tipo: a.tipo,
            porcentaje: Number(a.porcentaje),
            nota: a.calificaciones[0]?.valor != null ? Number(a.calificaciones[0].valor) : null,
            observacion: a.calificaciones[0]?.observacion ?? null,
          })),
          notaPeriodo: notaPeriodo != null ? Number(notaPeriodo) : null,
          porcentajeTotal: actividades.reduce((acc, a) => acc + Number(a.porcentaje), 0),
        };
      })
    );

    res.json({
      ok: true,
      datos: {
        estudiante: {
          id: estudiante.id,
          nombres: estudiante.nombres,
          apellidos: estudiante.apellidos,
          grado: `${estudiante.grado.nombre}${estudiante.grado.grupo}`,
        },
        boletin,
      },
    });
  } catch (err) {
    logger.error('Error al obtener boletín', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── EDITAR ACTIVIDAD ─────────────────────────────────────────────────────────
export async function editarActividad(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) });
    return;
  }

  const { id } = req.params;
  const { nombre, tipo, descripcion, fechaEntrega } = req.body;

  try {
    const actividad = await prisma.actividad.findUnique({ where: { id } });
    if (!actividad) { res.status(404).json({ ok: false, mensaje: 'Actividad no encontrada' }); return; }

    // Solo el profesor que la creó o admin puede editarla
    if (req.usuario!.rol === 'PROFESOR') {
      const profesor = await prisma.profesor.findUnique({ where: { usuarioId: req.usuario!.sub } });
      if (!profesor || actividad.profesorId !== profesor.id) {
        res.status(403).json({ ok: false, mensaje: 'No tienes permiso para editar esta actividad' });
        return;
      }
    }

    const actualizada = await prisma.actividad.update({
      where: { id },
      data: {
        nombre: nombre?.trim(),
        tipo,
        descripcion: descripcion?.trim() ?? null,
        fechaEntrega: fechaEntrega ? new Date(fechaEntrega) : null,
      },
    });

    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'actividades', entidadId: id, datosDespues: actualizada, ip: req.ip });
    res.json({ ok: true, datos: actualizada });
  } catch (err) {
    logger.error('Error al editar actividad', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── ELIMINAR ACTIVIDAD (solo si no tiene notas) ─────────────────────────────
export async function eliminarActividad(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const actividad = await prisma.actividad.findUnique({
      where: { id },
      include: { _count: { select: { calificaciones: true } } },
    });
    if (!actividad) { res.status(404).json({ ok: false, mensaje: 'Actividad no encontrada' }); return; }

    if (actividad._count.calificaciones > 0) {
      res.status(400).json({ ok: false, mensaje: `No se puede eliminar: tiene ${actividad._count.calificaciones} nota(s) registrada(s)` });
      return;
    }

    if (req.usuario!.rol === 'PROFESOR') {
      const profesor = await prisma.profesor.findUnique({ where: { usuarioId: req.usuario!.sub } });
      if (!profesor || actividad.profesorId !== profesor.id) {
        res.status(403).json({ ok: false, mensaje: 'No tienes permiso para eliminar esta actividad' });
        return;
      }
    }

    await prisma.actividad.delete({ where: { id } });
    await audit({ usuarioId: req.usuario!.sub, accion: 'ELIMINAR', entidad: 'actividades', entidadId: id, datosAntes: actividad, ip: req.ip });
    res.json({ ok: true, mensaje: 'Actividad eliminada' });
  } catch (err) {
    logger.error('Error al eliminar actividad', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function obtenerResumenAnual(req: Request, res: Response): Promise<void> {
  const { estudianteId } = req.params;
  const { anio } = req.query;

  try {
    const periodos = await prisma.periodo.findMany({
      where: anio ? { anio: parseInt(anio as string) } : undefined,
      orderBy: { numero: 'asc' },
    });

    if (periodos.length === 0) {
      res.json({ ok: true, datos: { periodos: [], materias: [], resumen: [] } });
      return;
    }

    const estudiante = await prisma.estudiante.findUnique({
      where: { id: estudianteId },
      include: { grado: { include: { materiaGrados: { include: { materia: true, profesor: true } } } } },
    });

    if (!estudiante) {
      res.status(404).json({ ok: false, mensaje: 'Estudiante no encontrado' });
      return;
    }

    const materias = estudiante.grado.materiaGrados.map(mg => ({
      id: mg.materia.id,
      nombre: mg.materia.nombre,
      profesor: `${mg.profesor.nombres} ${mg.profesor.apellidos}`,
    }));

    const resumen = await Promise.all(materias.map(async (mat) => {
      const notasPorPeriodo: Record<string, number | null> = {};

      await Promise.all(periodos.map(async (per) => {
        const calificaciones = await prisma.calificacion.findMany({
          where: { estudianteId, actividad: { materiaId: mat.id, periodoId: per.id } },
          include: { actividad: { select: { porcentaje: true } } },
        });

        if (calificaciones.length === 0) {
          notasPorPeriodo[per.id] = null;
        } else {
          const nota = calificaciones.reduce((acc, c) =>
            acc + Number(c.valor) * (Number(c.actividad.porcentaje) / 100), 0
          );
          notasPorPeriodo[per.id] = Math.round(nota * 10) / 10;
        }
      }));

      const notasValidas = Object.values(notasPorPeriodo).filter(n => n !== null) as number[];
      const promedioAnual = notasValidas.length > 0
        ? Math.round((notasValidas.reduce((a, b) => a + b, 0) / notasValidas.length) * 10) / 10
        : null;

      return { materia: { id: mat.id, nombre: mat.nombre }, profesor: mat.profesor, notasPorPeriodo, promedioAnual };
    }));

    const promediosPorPeriodo: Record<string, number | null> = {};
    periodos.forEach(per => {
      const notas = resumen.map(r => r.notasPorPeriodo[per.id]).filter(n => n !== null) as number[];
      promediosPorPeriodo[per.id] = notas.length > 0
        ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10
        : null;
    });

    res.json({
      ok: true,
      datos: {
        estudiante: { nombres: estudiante.nombres, apellidos: estudiante.apellidos, grado: `${estudiante.grado.nombre}${estudiante.grado.grupo}` },
        periodos: periodos.map(p => ({ id: p.id, nombre: p.nombre, numero: p.numero, activo: p.activo })),
        resumen,
        promediosPorPeriodo,
      },
    });
  } catch (err) {
    logger.error('Error al obtener resumen anual', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function eliminarCalificacionesActividad(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const actividad = await prisma.actividad.findUnique({
      where: { id },
      include: { _count: { select: { calificaciones: true } } },
    });
    if (!actividad) { res.status(404).json({ ok: false, mensaje: 'Actividad no encontrada' }); return; }

    if (req.usuario!.rol === 'PROFESOR') {
      const profesor = await prisma.profesor.findUnique({ where: { usuarioId: req.usuario!.sub } });
      if (!profesor || actividad.profesorId !== profesor.id) {
        res.status(403).json({ ok: false, mensaje: 'No tienes permiso' });
        return;
      }
    }

    const total = actividad._count.calificaciones;
    await prisma.calificacion.deleteMany({ where: { actividadId: id } });
    await audit({ usuarioId: req.usuario!.sub, accion: 'ELIMINAR', entidad: 'calificaciones', entidadId: id, datosAntes: { total }, ip: req.ip });
    res.json({ ok: true, mensaje: `${total} nota(s) eliminada(s)` });
  } catch (err) {
    logger.error('Error al eliminar calificaciones', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}