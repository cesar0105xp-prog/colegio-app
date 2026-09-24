import { useQuery } from '@tanstack/react-query';
import api from './api';

// Materias y grados que dicta el profesor autenticado. Toda la interfaz del
// docente se arma con esto: solo ve lo suyo, nunca el colegio completo.
export type GradoAsignado = { id: string; nombre: string; grupo: string; totalEstudiantes: number };
export type AsignacionMateria = { materia: { id: string; nombre: string }; grados: GradoAsignado[] };

export function useMisAsignaciones() {
  const { data, isLoading } = useQuery({
    queryKey: ['mis-asignaciones'],
    queryFn: async () => (await api.get('/profesor/mis-asignaciones')).data.datos as AsignacionMateria[],
  });
  const asignaciones = data ?? [];

  const materias = asignaciones.map(a => a.materia);
  const gradosDe = (materiaId: string) => asignaciones.find(a => a.materia.id === materiaId)?.grados ?? [];

  // Grados (sin repetir) y materias por grado: la asistencia se toma por curso
  const grados = [...new Map(asignaciones.flatMap(a => a.grados).map(g => [g.id, g])).values()];
  const materiasDe = (gradoId: string) =>
    asignaciones.filter(a => a.grados.some(g => g.id === gradoId)).map(a => a.materia);

  return {
    cargando: isLoading,
    asignaciones,
    materias,
    gradosDe,
    grados,
    materiasDe,
    sinAsignaciones: !isLoading && asignaciones.length === 0,
  };
}

export const nombreGrado = (g: { nombre: string; grupo: string }) => `${g.nombre}${g.grupo ? ' ' + g.grupo : ''}`;
