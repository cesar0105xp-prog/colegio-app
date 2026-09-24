import { Request, Response } from 'express';
import { logger } from '../utils/logger';

import { prisma } from '../utils/prisma';

// Orden escolar de los grados: Pre-jardín primero y Once al final. Alfabéticamente
// "Cuarto" quedaría antes que "Primero", que no es lo que espera un docente.
const ORDEN_GRADOS = [
  'prejardin', 'pre-jardin', 'jardin', 'transicion',
  'primero', 'segundo', 'tercero', 'cuarto', 'quinto',
  'sexto', 'septimo', 'octavo', 'noveno', 'decimo', 'once',
];

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function ordenDeGrado(nombre: string): number {
  const clave = sinTildes(nombre);
  const i = ORDEN_GRADOS.indexOf(clave);
  return i === -1 ? ORDEN_GRADOS.length : i; // los desconocidos van al final
}

/**
 * Materias y grados que dicta el profesor autenticado, agrupados por materia.
 * Si no tiene asignaciones devuelve una lista vacía, no un error.
 */
export async function misAsignaciones(req: Request, res: Response): Promise<void> {
  try {
    const profesor = await prisma.profesor.findUnique({ where: { usuarioId: req.usuario!.sub }, select: { id: true } });
    if (!profesor) { res.json({ ok: true, datos: [] }); return; }

    const asignaciones = await prisma.materiaGradoProfesor.findMany({
      where: { profesorId: profesor.id },
      include: {
        materia: { select: { id: true, nombre: true } },
        grado: {
          select: {
            id: true, nombre: true, grupo: true,
            _count: { select: { estudiantes: true } },
          },
        },
      },
    });

    const porMateria = new Map<string, { materia: { id: string; nombre: string }; grados: { id: string; nombre: string; grupo: string; totalEstudiantes: number }[] }>();
    for (const a of asignaciones) {
      if (!porMateria.has(a.materiaId)) porMateria.set(a.materiaId, { materia: a.materia, grados: [] });
      porMateria.get(a.materiaId)!.grados.push({
        id: a.grado.id,
        nombre: a.grado.nombre,
        grupo: a.grado.grupo,
        totalEstudiantes: a.grado._count.estudiantes,
      });
    }

    const datos = [...porMateria.values()]
      .map(m => ({
        ...m,
        grados: m.grados.sort((a, b) => ordenDeGrado(a.nombre) - ordenDeGrado(b.nombre) || a.grupo.localeCompare(b.grupo, 'es')),
      }))
      .sort((a, b) => a.materia.nombre.localeCompare(b.materia.nombre, 'es'));

    res.json({ ok: true, datos });
  } catch (err) {
    logger.error('Error al listar las asignaciones del profesor', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}
