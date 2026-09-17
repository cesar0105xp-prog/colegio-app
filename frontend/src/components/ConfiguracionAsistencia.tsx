import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Trash2, Plus, AlertTriangle, UserCheck, Clock } from 'lucide-react';
import api from '../services/api';

// Configuración de quién llama a lista en cada grado:
//  - DIRECTOR_FIJO: siempre el director de curso (preescolar a 4°).
//  - ROTATIVO_HORARIO: el profesor de la primera clase del día (5° en adelante).

export const DIAS = [
  { numero: 1, nombre: 'Lunes', corto: 'Lun' },
  { numero: 2, nombre: 'Martes', corto: 'Mar' },
  { numero: 3, nombre: 'Miércoles', corto: 'Mié' },
  { numero: 4, nombre: 'Jueves', corto: 'Jue' },
  { numero: 5, nombre: 'Viernes', corto: 'Vie' },
];

export type GradoAsistencia = {
  id: string; nombre: string; grupo: string; nivel: string; anio: number;
  tipoAsistencia: 'DIRECTOR_FIJO' | 'ROTATIVO_HORARIO';
  directorCursoId?: string | null;
  materiaGrados: { id: string; materia: { id: string; nombre: string }; profesor: { id: string; nombres: string; apellidos: string } }[];
};

type Horario = {
  id: string; diaSemana: number; horaInicio: string; horaFin: string; esPrimeraClase: boolean;
  materia: { id: string; nombre: string };
  profesor: { id: string; nombres: string; apellidos: string };
};

const inputCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-h-[44px]';

/** Tabla resumen: por grado, quién toma asistencia cada día de la semana. */
export function ResponsablesAsistencia() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['responsables-asistencia'],
    queryFn: async () => (await api.get('/asistencia/responsables')).data.datos ?? [],
  });

  type Fila = {
    gradoId: string; grado: string; nivel: string;
    tipoAsistencia: 'DIRECTOR_FIJO' | 'ROTATIVO_HORARIO';
    directorCurso: string | null;
    porDia: { diaSemana: number; profesor: string | null; materia: string | null }[];
    diasSinResponsable: number[];
  };
  const filas = data as Fila[];
  const incompletos = filas.filter(f => f.diasSinResponsable.length > 0);

  if (isLoading) return <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {incompletos.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            Hay {incompletos.length} grado(s) sin responsable de asistencia en algún día:{' '}
            {incompletos.map(f => `${f.grado} (${f.diasSinResponsable.map(d => DIAS.find(x => x.numero === d)?.corto).join(', ')})`).join(' · ')}.
            Asigna el director de curso o marca la primera clase en el horario.
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Grado</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Modelo</th>
                {DIAS.map(d => <th key={d.numero} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">{d.corto}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filas.map(f => (
                <tr key={f.gradoId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-800 whitespace-nowrap">{f.grado}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium ${f.tipoAsistencia === 'DIRECTOR_FIJO' ? 'bg-sky-50 text-sky-700' : 'bg-violet-50 text-violet-700'}`}>
                      {f.tipoAsistencia === 'DIRECTOR_FIJO' ? <UserCheck className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {f.tipoAsistencia === 'DIRECTOR_FIJO' ? 'Director fijo' : 'Rotativo'}
                    </span>
                  </td>
                  {f.porDia.map(d => (
                    <td key={d.diaSemana} className="px-4 py-3 text-xs text-slate-600">
                      {d.profesor ? (
                        <>
                          <span className="block whitespace-nowrap">{d.profesor}</span>
                          {d.materia && <span className="block text-slate-400">{d.materia}</span>}
                        </>
                      ) : <span className="text-red-500">Sin asignar</span>}
                    </td>
                  ))}
                </tr>
              ))}
              {filas.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400"><CalendarCheck className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No hay grados registrados</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Configuración de asistencia de un grado: modelo, director de curso y horario. */
export function ConfiguracionAsistenciaGrado({ grado, onToast }: { grado: GradoAsistencia; onToast: (msg: string, tipo: 'ok' | 'error') => void }) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState(grado.tipoAsistencia);
  const [directorCursoId, setDirectorCursoId] = useState(grado.directorCursoId ?? '');
  const [nuevo, setNuevo] = useState<{ diaSemana: string; materiaGradoId: string; horaInicio: string; horaFin: string }>({ diaSemana: '1', materiaGradoId: '', horaInicio: '07:00', horaFin: '08:00' });

  const { data: horarios = [] } = useQuery({
    queryKey: ['horarios', grado.id],
    queryFn: async () => (await api.get('/horarios', { params: { gradoId: grado.id } })).data.datos ?? [],
  });
  const primeras = (horarios as Horario[]).filter(h => h.esPrimeraClase);

  const mensajeError = (e: unknown) => {
    const d = (e as { response?: { data?: { mensaje?: string; errores?: string[] } } })?.response?.data;
    return d?.errores?.[0] ?? d?.mensaje ?? 'Error';
  };

  const guardarMutation = useMutation({
    mutationFn: () => api.put(`/grados/${grado.id}`, {
      nombre: grado.nombre, grupo: grado.grupo, nivel: grado.nivel, anio: grado.anio,
      tipoAsistencia: tipo,
      directorCursoId: tipo === 'DIRECTOR_FIJO' ? directorCursoId : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grados'] });
      qc.invalidateQueries({ queryKey: ['responsables-asistencia'] });
      onToast('Configuración de asistencia guardada', 'ok');
    },
    onError: (e: unknown) => onToast(mensajeError(e), 'error'),
  });

  const agregarMutation = useMutation({
    mutationFn: () => {
      const mg = grado.materiaGrados.find(m => m.id === nuevo.materiaGradoId);
      return api.post('/horarios', {
        gradoId: grado.id,
        materiaId: mg?.materia.id,
        profesorId: mg?.profesor.id,
        diaSemana: Number(nuevo.diaSemana),
        horaInicio: nuevo.horaInicio,
        horaFin: nuevo.horaFin,
        esPrimeraClase: true,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['horarios', grado.id] });
      qc.invalidateQueries({ queryKey: ['responsables-asistencia'] });
      onToast('Primera clase del día guardada', 'ok');
    },
    onError: (e: unknown) => onToast(mensajeError(e), 'error'),
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/horarios/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['horarios', grado.id] });
      qc.invalidateQueries({ queryKey: ['responsables-asistencia'] });
      onToast('Franja eliminada', 'ok');
    },
    onError: (e: unknown) => onToast(mensajeError(e), 'error'),
  });

  const diasLibres = DIAS.filter(d => !primeras.some(h => h.diaSemana === d.numero));

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-slate-600 mb-2">¿Quién llama a lista en este grado?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { valor: 'DIRECTOR_FIJO' as const, titulo: 'Director de curso fijo', detalle: 'Siempre el mismo profesor (preescolar a 4°)' },
            { valor: 'ROTATIVO_HORARIO' as const, titulo: 'Rotativo por horario', detalle: 'El profesor de la primera clase del día (5° en adelante)' },
          ].map(o => (
            <button key={o.valor} type="button" onClick={() => setTipo(o.valor)}
              className={`text-left p-3 rounded-xl border transition min-h-[44px] ${tipo === o.valor ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <p className="text-sm font-semibold text-slate-800">{o.titulo}</p>
              <p className="text-xs text-slate-500">{o.detalle}</p>
            </button>
          ))}
        </div>
      </div>

      {tipo === 'DIRECTOR_FIJO' ? (
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Director de curso *</label>
          <select value={directorCursoId} onChange={e => setDirectorCursoId(e.target.value)} className={inputCls}>
            <option value="">Seleccionar profesor</option>
            {[...new Map(grado.materiaGrados.map(mg => [mg.profesor.id, mg.profesor])).values()].map(p => (
              <option key={p.id} value={p.id}>{p.nombres} {p.apellidos}</option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">Aparecen los profesores con materias asignadas en este grado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-600">Primera clase de cada día</p>
          <p className="text-xs text-slate-400 -mt-2">Quien dicte la primera clase del día es quien llama a lista ese día.</p>

          <div className="space-y-2">
            {DIAS.map(d => {
              const franja = primeras.find(h => h.diaSemana === d.numero);
              return (
                <div key={d.numero} className="flex items-center justify-between gap-3 bg-slate-50 rounded-xl px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700">{d.nombre}</p>
                    {franja ? (
                      <p className="text-xs text-slate-500 truncate">
                        {franja.materia.nombre} · {franja.profesor.nombres} {franja.profesor.apellidos} · {franja.horaInicio}–{franja.horaFin}
                      </p>
                    ) : <p className="text-xs text-red-500">Sin asignar</p>}
                  </div>
                  {franja && (
                    <button onClick={() => eliminarMutation.mutate(franja.id)} aria-label={`Quitar primera clase de ${d.nombre}`}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors min-h-[36px]">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {grado.materiaGrados.length === 0 ? (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
              Este grado todavía no tiene materias asignadas. Asigna materias y profesores antes de armar el horario.
            </p>
          ) : diasLibres.length > 0 && (
            <div className="border-t border-slate-100 pt-3 space-y-3">
              <p className="text-sm font-medium text-slate-600">Agregar primera clase</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Día</label>
                  <select value={nuevo.diaSemana} onChange={e => setNuevo({ ...nuevo, diaSemana: e.target.value })} className={inputCls}>
                    {diasLibres.map(d => <option key={d.numero} value={d.numero}>{d.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Materia y profesor</label>
                  <select value={nuevo.materiaGradoId} onChange={e => setNuevo({ ...nuevo, materiaGradoId: e.target.value })} className={inputCls}>
                    <option value="">Seleccionar</option>
                    {grado.materiaGrados.map(mg => (
                      <option key={mg.id} value={mg.id}>{mg.materia.nombre} — {mg.profesor.nombres} {mg.profesor.apellidos}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Hora de inicio</label>
                  <input type="time" value={nuevo.horaInicio} onChange={e => setNuevo({ ...nuevo, horaInicio: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Hora de fin</label>
                  <input type="time" value={nuevo.horaFin} onChange={e => setNuevo({ ...nuevo, horaFin: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={() => agregarMutation.mutate()}
                  disabled={!nuevo.materiaGradoId || agregarMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50 min-h-[44px]">
                  <Plus className="w-4 h-4" /> {agregarMutation.isPending ? 'Guardando...' : 'Agregar'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
        <button onClick={() => guardarMutation.mutate()}
          disabled={guardarMutation.isPending || (tipo === 'DIRECTOR_FIJO' && !directorCursoId)}
          className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50 min-h-[44px]">
          {guardarMutation.isPending ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  );
}
