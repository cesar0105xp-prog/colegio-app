import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, CheckCircle, AlertCircle, X, Save, AlertTriangle, ChevronLeft, Clock, UserCheck } from 'lucide-react';
import api from '../services/api';

function Toast({ mensaje, tipo, onClose }: { mensaje: string; tipo: 'ok' | 'error'; onClose: () => void }) {
  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${tipo === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
      {tipo === 'ok' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {mensaje}
      <button onClick={onClose}><X className="w-4 h-4" /></button>
    </div>
  );
}

const ESTADOS = ['PRESENTE', 'AUSENTE', 'TARDE', 'EXCUSA'] as const;
// Color del botón seleccionado
const ESTADO_ACTIVO: Record<string, string> = {
  PRESENTE: 'bg-emerald-600 text-white border-emerald-600',
  AUSENTE: 'bg-red-600 text-white border-red-600',
  TARDE: 'bg-amber-500 text-white border-amber-500',
  EXCUSA: 'bg-blue-600 text-white border-blue-600',
};
const ESTADO_LABEL: Record<string, string> = { PRESENTE: 'Presente', AUSENTE: 'Ausente', TARDE: 'Tarde', EXCUSA: 'Excusa' };
const ESTADO_CORTO: Record<string, string> = { PRESENTE: 'P', AUSENTE: 'A', TARDE: 'T', EXCUSA: 'E' };

const hoyISO = () => new Date().toISOString().split('T')[0];
const haceNDias = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; };

type Grado = { id: string; nombre: string; grupo: string };
type GradoDeHoy = {
  gradoId: string; grado: string; nivel: string;
  motivo: 'DIRECTOR_FIJO' | 'PRIMERA_CLASE';
  materia: string | null; horaInicio: string | null;
  estudiantes: number; yaTomada: boolean;
};
type FilaAsistencia = {
  estudianteId: string; nombres: string; apellidos: string; registroId: string | null;
  estadoManana: string; estadoTarde: string; observacion: string | null; justificada: boolean; ausenciasMes: number;
};
type EstadoLocal = { estadoManana: string; estadoTarde: string; observacion: string };

// Un botón por estado: se marca directamente el que corresponde (sin ir rotando)
function SelectorEstado({ estado, onChange }: { estado: string; onChange: (estado: string) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup">
      {ESTADOS.map(e => (
        <button key={e} type="button" role="radio" aria-checked={estado === e} title={ESTADO_LABEL[e]} onClick={() => onChange(e)}
          className={`min-w-[36px] min-h-[36px] px-2 rounded-lg border text-xs font-semibold transition-colors ${estado === e ? ESTADO_ACTIVO[e] : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
          <span className="xl:hidden">{ESTADO_CORTO[e]}</span>
          <span className="hidden xl:inline">{ESTADO_LABEL[e]}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Toma de asistencia.
 *  - Profesor: solo los grados que le corresponden hoy (director de curso, o la
 *    primera clase del día en los grados con horario rotativo).
 *  - Administración y secretaría (modoLibre): cualquier grado, para cubrir la
 *    ausencia del docente.
 */
export default function Asistencia({ modoLibre = false }: { modoLibre?: boolean }) {
  const qc = useQueryClient();
  const [gradoId, setGradoId] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);
  const [local, setLocal] = useState<Record<string, EstadoLocal>>({});

  // Modo libre: todos los grados del colegio (se leen de la base)
  const { data: grados = [] } = useQuery({
    queryKey: ['grados'],
    queryFn: async () => (await api.get('/grados')).data.datos ?? [],
    enabled: modoLibre,
  });

  // Profesor: los grados que le tocan en la fecha seleccionada
  const { data: gradosHoy = [], isLoading: cargandoHoy } = useQuery({
    queryKey: ['mis-grados-hoy', fecha],
    queryFn: async () => (await api.get('/asistencia/mis-grados-hoy', { params: { fecha } })).data.datos ?? [],
    enabled: !modoLibre,
    staleTime: 0,
  });

  const { data: filas = [], isLoading } = useQuery({
    queryKey: ['asistencia-grado', gradoId, fecha],
    queryFn: async () => (await api.get(`/asistencia/grado/${gradoId}`, { params: { fecha } })).data.datos ?? [],
    enabled: !!(gradoId && fecha),
    staleTime: 0,
  });

  useEffect(() => {
    const seed: Record<string, EstadoLocal> = {};
    for (const f of filas as FilaAsistencia[]) {
      seed[f.estudianteId] = { estadoManana: f.estadoManana, estadoTarde: f.estadoTarde, observacion: f.observacion ?? '' };
    }
    setLocal(seed);
  }, [filas]);

  const guardarMutation = useMutation({
    mutationFn: () => api.post('/asistencia/grado', {
      gradoId, fecha,
      registros: (filas as FilaAsistencia[]).map(f => ({
        estudianteId: f.estudianteId,
        estadoManana: local[f.estudianteId]?.estadoManana ?? f.estadoManana,
        estadoTarde: local[f.estudianteId]?.estadoTarde ?? f.estadoTarde,
        observacion: local[f.estudianteId]?.observacion || undefined,
      })),
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['asistencia-grado', gradoId, fecha] });
      qc.invalidateQueries({ queryKey: ['mis-grados-hoy'] });
      setToast({ msg: res.data.mensaje, tipo: 'ok' });
    },
    onError: (e: unknown) => {
      const d = (e as { response?: { data?: { mensaje?: string; errores?: string[] } } })?.response?.data;
      setToast({ msg: d?.errores?.[0] ?? d?.mensaje ?? 'Error al guardar la asistencia', tipo: 'error' });
    },
  });

  const cambiarEstado = (estudianteId: string, mitad: 'estadoManana' | 'estadoTarde', estado: string) => {
    setLocal(prev => {
      const actual = prev[estudianteId] ?? { estadoManana: 'PRESENTE', estadoTarde: 'PRESENTE', observacion: '' };
      return { ...prev, [estudianteId]: { ...actual, [mitad]: estado } };
    });
  };

  const setObservacion = (estudianteId: string, valor: string) => {
    setLocal(prev => {
      const actual = prev[estudianteId] ?? { estadoManana: 'PRESENTE', estadoTarde: 'PRESENTE', observacion: '' };
      return { ...prev, [estudianteId]: { ...actual, observacion: valor } };
    });
  };

  const gradoSeleccionado = (gradosHoy as GradoDeHoy[]).find(g => g.gradoId === gradoId);

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      {modoLibre ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-start gap-2 mb-3">
            <UserCheck className="w-4 h-4 text-violet-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-600">Tomar asistencia por ausencia del docente</p>
              <p className="text-xs text-slate-400">Puedes registrar o corregir la asistencia de cualquier grado.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Grado</label>
              <select value={gradoId} onChange={e => setGradoId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-h-[44px]">
                <option value="">Seleccionar grado</option>
                {(grados as Grado[]).map(g => <option key={g.id} value={g.id}>{g.nombre}{g.grupo}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Fecha</label>
              <input type="date" value={fecha} max={hoyISO()} onChange={e => setFecha(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-h-[44px]" />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">Estados: P = Presente · A = Ausente · T = Tarde · E = Excusa</p>
        </div>
      ) : !gradoId ? (
        // Profesor: tarjetas con los grados que le tocan hoy
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-sm font-semibold text-slate-600 mb-1">Asistencia de hoy</p>
            <p className="text-xs text-slate-400 mb-3">Aquí aparecen solo los grados donde te toca llamar a lista.</p>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Fecha</label>
            <input type="date" value={fecha} min={haceNDias(3)} max={hoyISO()} onChange={e => setFecha(e.target.value)}
              className="w-full sm:w-52 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-h-[44px]" />
          </div>

          {cargandoHoy ? (
            <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
          ) : (gradosHoy as GradoDeHoy[]).length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center py-12 px-5 text-slate-400">
              <CalendarCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium text-slate-500">Hoy no tienes asistencia asignada</p>
              <p className="text-xs mt-1">La toma el director de curso o el profesor de la primera clase del día.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(gradosHoy as GradoDeHoy[]).map(g => (
                <button key={g.gradoId} onClick={() => setGradoId(g.gradoId)}
                  className="text-left bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:border-blue-300 hover:shadow transition min-h-[44px]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-bold text-slate-800">{g.grado}</p>
                      <p className="text-xs text-slate-500">
                        {g.motivo === 'DIRECTOR_FIJO'
                          ? 'Eres el director de curso'
                          : `Primera clase: ${g.materia}${g.horaInicio ? ` · ${g.horaInicio}` : ''}`}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">{g.estudiantes} estudiante(s)</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${g.yaTomada ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {g.yaTomada ? 'Tomada' : 'Pendiente'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
          <button onClick={() => setGradoId('')} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 min-h-[36px]" aria-label="Volver">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800">{gradoSeleccionado?.grado ?? 'Asistencia'}</p>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              {gradoSeleccionado?.motivo === 'PRIMERA_CLASE' && <Clock className="w-3 h-3" />}
              {gradoSeleccionado?.motivo === 'PRIMERA_CLASE'
                ? `Primera clase: ${gradoSeleccionado.materia}`
                : 'Director de curso'} · {fecha.split('-').reverse().join('/')}
            </p>
          </div>
        </div>
      )}

      {!gradoId ? (
        modoLibre ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center py-12 text-slate-400">
            <CalendarCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Selecciona un grado para tomar asistencia</p>
          </div>
        ) : null
      ) : isLoading ? (
        <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
      ) : (filas as FilaAsistencia[]).length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center py-12 text-slate-400">
          <CalendarCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay estudiantes activos en este grado</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>{['Estudiante', 'Mañana', 'Tarde', 'Observación'].map(h => <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(filas as FilaAsistencia[]).map(f => {
                  const est = local[f.estudianteId] ?? { estadoManana: f.estadoManana, estadoTarde: f.estadoTarde, observacion: f.observacion ?? '' };
                  return (
                    <tr key={f.estudianteId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">{f.nombres[0]}{f.apellidos[0]}</div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 whitespace-nowrap">{f.nombres} {f.apellidos}</p>
                            {f.ausenciasMes >= 2 && (
                              <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                                <AlertTriangle className="w-3 h-3" /> {f.ausenciasMes} ausencias este mes
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><SelectorEstado estado={est.estadoManana} onChange={e => cambiarEstado(f.estudianteId, 'estadoManana', e)} /></td>
                      <td className="px-4 py-3"><SelectorEstado estado={est.estadoTarde} onChange={e => cambiarEstado(f.estudianteId, 'estadoTarde', e)} /></td>
                      <td className="px-4 py-3">
                        <input value={est.observacion} onChange={e => setObservacion(f.estudianteId, e.target.value)} maxLength={300}
                          placeholder="Opcional"
                          className="w-full min-w-[160px] px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-4 border-t border-slate-100 flex justify-end">
            <button onClick={() => guardarMutation.mutate()} disabled={guardarMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50 min-h-[44px]">
              <Save className="w-4 h-4" /> {guardarMutation.isPending ? 'Guardando...' : 'Guardar todo'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
