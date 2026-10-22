import { prisma } from './prisma';

export type MateriaDelGrado = {
  materia: { id: string; nombre: string; codigo: string | null };
  /** Nombre del docente, o null si la materia aún no tiene docente asignado */
  profesor: string | null;
};

/**
 * Materias que se ven en un grado: las del plan de estudios más cualquier
 * materia que tenga docente asignado aunque no esté en el plan. Así el boletín,
 * el resumen anual, los certificados y los reportes muestran también las
 * materias sin docente y los grados de preescolar.
 */
export async function materiasDelGrado(gradoId: string): Promise<MateriaDelGrado[]> {
  const [plan, asignaciones] = await Promise.all([
    prisma.planEstudio.findMany({ where: { gradoId }, include: { materia: true } }),
    prisma.materiaGradoProfesor.findMany({ where: { gradoId }, include: { materia: true, profesor: true } }),
  ]);

  const porMateria = new Map<string, MateriaDelGrado>();
  for (const p of plan) {
    porMateria.set(p.materiaId, { materia: { id: p.materia.id, nombre: p.materia.nombre, codigo: p.materia.codigo }, profesor: null });
  }
  for (const a of asignaciones) {
    porMateria.set(a.materiaId, {
      materia: { id: a.materia.id, nombre: a.materia.nombre, codigo: a.materia.codigo },
      profesor: `${a.profesor.nombres} ${a.profesor.apellidos}`,
    });
  }

  return [...porMateria.values()].sort((a, b) => a.materia.nombre.localeCompare(b.materia.nombre, 'es'));
}
