import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { ItemNota, notaPonderada, promedio as promediar } from '../utils/notas';

import { prisma } from '../utils/prisma';

// ─── REPORTE: BOLETINES POR GRADO ────────────────────────────────────────────
export async function reporteBoletinesPorGrado(req: Request, res: Response): Promise<void> {
  const { gradoId, periodoId } = req.query;
  if (!gradoId || !periodoId) { res.status(400).json({ ok: false, mensaje: 'gradoId y periodoId son requeridos' }); return; }

  try {
    const estudiantes = await prisma.estudiante.findMany({
      where: { gradoId: gradoId as string, estado: 'ACTIVO' },
      include: { grado: true },
      orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
    });

    const materiasGrado = await prisma.materiaGradoProfesor.findMany({
      where: { gradoId: gradoId as string },
      include: { materia: true },
    });

    const reporte = await Promise.all(estudiantes.map(async (est) => {
      const materias = await Promise.all(materiasGrado.map(async (mg) => {
        const calificaciones = await prisma.calificacion.findMany({
          where: { estudianteId: est.id, actividad: { materiaId: mg.materiaId, periodoId: periodoId as string } },
          include: { actividad: { select: { porcentaje: true } } },
        });
        const nota = notaPonderada(calificaciones.map(c => ({ valor: c.valor, porcentaje: c.actividad.porcentaje })))?.nota ?? null;
        return { materia: mg.materia.nombre, nota };
      }));

      const promedio = promediar(materias.filter(m => m.nota !== null).map(m => m.nota as number));

      return {
        estudiante: `${est.nombres} ${est.apellidos}`,
        documento: est.numeroDocumento,
        materias,
        promedio,
      };
    }));

    res.json({ ok: true, datos: reporte });
  } catch (err) {
    logger.error('Error al generar reporte de boletines', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── REPORTE: RENDIMIENTO POR MATERIA ────────────────────────────────────────
export async function reporteRendimientoMateria(req: Request, res: Response): Promise<void> {
  const { periodoId } = req.query;
  if (!periodoId) { res.status(400).json({ ok: false, mensaje: 'periodoId es requerido' }); return; }

  try {
    const materias = await prisma.materia.findMany();

    const reporte = await Promise.all(materias.map(async (mat) => {
      const calificaciones = await prisma.calificacion.findMany({
        where: { actividad: { materiaId: mat.id, periodoId: periodoId as string } },
        include: { actividad: { select: { porcentaje: true } }, estudiante: { select: { id: true } } },
      });

      if (calificaciones.length === 0) return { materia: mat.nombre, promedioGeneral: null, totalCalificaciones: 0 };

      // Agrupar por estudiante para calcular nota ponderada de cada uno
      const porEstudiante: Record<string, ItemNota[]> = {};
      calificaciones.forEach(c => {
        (porEstudiante[c.estudiante.id] ??= []).push({ valor: c.valor, porcentaje: c.actividad.porcentaje });
      });

      const notas = Object.values(porEstudiante).map(items => notaPonderada(items)!.nota);
      const promedioGeneral = promediar(notas)!;

      return { materia: mat.nombre, promedioGeneral, totalCalificaciones: calificaciones.length, totalEstudiantes: notas.length };
    }));

    res.json({ ok: true, datos: reporte.filter(r => r.promedioGeneral !== null) });
  } catch (err) {
    logger.error('Error al generar reporte de rendimiento', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── REPORTE: ESTUDIANTES DESTACADOS ─────────────────────────────────────────
export async function reporteEstudiantesDestacados(req: Request, res: Response): Promise<void> {
  // Escala 0–100: destacado = Excelente (≥ 90)
  const { periodoId, umbral = '90' } = req.query;
  if (!periodoId) { res.status(400).json({ ok: false, mensaje: 'periodoId es requerido' }); return; }

  try {
    const estudiantes = await prisma.estudiante.findMany({ where: { estado: 'ACTIVO' }, include: { grado: true } });

    const resultado = await Promise.all(estudiantes.map(async (est) => {
      const calificaciones = await prisma.calificacion.findMany({
        where: { estudianteId: est.id, actividad: { periodoId: periodoId as string } },
        include: { actividad: { select: { materiaId: true, porcentaje: true } } },
      });
      if (calificaciones.length === 0) return null;

      const porMateria: Record<string, ItemNota[]> = {};
      calificaciones.forEach(c => {
        (porMateria[c.actividad.materiaId] ??= []).push({ valor: c.valor, porcentaje: c.actividad.porcentaje });
      });

      const notas = Object.values(porMateria).map(items => notaPonderada(items)!.nota);
      const promedio = promediar(notas)!;

      if (promedio < parseFloat(umbral as string)) return null;

      return {
        estudiante: `${est.nombres} ${est.apellidos}`,
        grado: `${est.grado.nombre}${est.grado.grupo}`,
        promedio,
      };
    }));

    const destacados = resultado.filter(r => r !== null).sort((a, b) => (b!.promedio - a!.promedio));
    res.json({ ok: true, datos: destacados });
  } catch (err) {
    logger.error('Error al generar reporte de destacados', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── REPORTE: OBSERVACIONES PENDIENTES ───────────────────────────────────────
export async function reporteObservacionesPendientes(_req: Request, res: Response): Promise<void> {
  try {
    const observaciones = await prisma.observacion.findMany({
      include: {
        estudiante: { select: { nombres: true, apellidos: true, grado: true } },
        profesor: { select: { nombres: true, apellidos: true } },
        vistas: true,
      },
      orderBy: { fecha: 'desc' },
    });

    const pendientes = observaciones
      .filter(o => o.vistas.length === 0)
      .map(o => ({
        estudiante: `${o.estudiante.nombres} ${o.estudiante.apellidos}`,
        tipo: o.tipo,
        descripcion: o.descripcion.slice(0, 100),
        profesor: o.profesor ? `${o.profesor.nombres} ${o.profesor.apellidos}` : 'Profesor retirado',
        fecha: o.fecha,
        diasSinVer: Math.floor((Date.now() - o.fecha.getTime()) / (1000 * 60 * 60 * 24)),
      }));

    res.json({ ok: true, datos: pendientes });
  } catch (err) {
    logger.error('Error al generar reporte de observaciones pendientes', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}