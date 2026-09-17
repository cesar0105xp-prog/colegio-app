import { useQuery } from '@tanstack/react-query';
import api from './api';

// Materias y grados asignados al profesor que inició sesión. Notas y asistencia
// solo muestran estos grados/materias (el backend también lo exige).
type Asignacion = {
  materia: { id: string; nombre: string };
  grado: { id: string; nombre: string; grupo: string };
};

export function useMisAsignaciones() {
  const { data, isLoading } = useQuery({
    // Misma consulta y clave que "Mi perfil": se comparte la caché
    queryKey: ['mi-perfil-profesor'],
    queryFn: async () => (await api.get('/usuarios/mi-perfil')).data.datos,
  });
  const asignaciones: Asignacion[] = data?.perfilProfesor?.materiaGrados ?? [];

  const grados = [...new Map(asignaciones.map(a => [a.grado.id, a.grado])).values()]
    .sort((a, b) => `${a.nombre}${a.grupo}`.localeCompare(`${b.nombre}${b.grupo}`, 'es', { numeric: true }));
  const materiasDe = (gradoId: string) => asignaciones.filter(a => a.grado.id === gradoId).map(a => a.materia);

  return { cargando: isLoading, grados, materiasDe, sinAsignaciones: !isLoading && asignaciones.length === 0 };
}
