import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, CheckCircle, AlertCircle, X, Save, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import { useMisAsignaciones } from '../services/misAsignaciones';

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

type Materia = { id: string; nombre: string };
type FilaAsistencia = {
  estudianteId: string; nombres: string; apellidos: string; registroId: string | null;
  estado: string; observacion: string | null; justificada: boolean; ausenciasMes: number;
};
type EstadoLocal = { estado: string; observacion: string };

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

export default function Asistencia() {
  const qc = useQueryClient();
  const [gradoId, setGradoId] = useState('');
  const [materiaId, setMateriaId] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);
  const [local, setLocal] = useState<Record<string, EstadoLocal>>({});

  // La asistencia es de la clase del profesor: solo sus grados y materias
  const { grados, materiasDe, sinAsignaciones } = useMisAsignaciones();
  const materias: Materia[] = gradoId ? materiasDe(gradoId) : [];

  const { data: filas = [], isLoading } = useQuery({
    queryKey: ['asistencia-grado', gradoId, materiaId, fecha],
    queryFn: async () => (await api.get(`/asistencia/grado/${gradoId}`, { params: { fecha, materiaId } })).data.datos ?? [],
    enabled: !!(gradoId && materiaId && fecha),
    staleTime: 0,
  });

  useEffect(() => {
    const seed: Record<string, EstadoLocal> = {};
    for (const f of filas as FilaAsistencia[]) {
      seed[f.estudianteId] = { estado: f.estado, observacion: f.observacion ?? '' };
    }
    setLocal(seed);
  }, [filas]);

  const guardarMutation = useMutation({
    mutationFn: () => api.post('/asistencia/grado', {
      gradoId, materiaId, fecha,
      registros: (filas as FilaAsistencia[]).map(f => ({
        estudianteId: f.estudianteId,
        estado: local[f.estudianteId]?.estado ?? f.estado,
        observacion: local[f.estudianteId]?.observacion || undefined,
      })),
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['asistencia-grado', gradoId, materiaId, fecha] });
      setToast({ msg: res.data.mensaje, tipo: 'ok' });
    },
    onError: (e: unknown) => {
      const d = (e as { response?: { data?: { mensaje?: string; errores?: string[] } } })?.response?.data;
      setToast({ msg: d?.errores?.[0] ?? d?.mensaje ?? 'Error al guardar la asistencia', tipo: 'error' });
    },
  });

  const cambiarEstado = (estudianteId: string, estado: string) => {
    setLocal(prev => {
      const actual = prev[estudianteId] ?? { estado: 'PRESENTE', observacion: '' };
      return { ...prev, [estudianteId]: { ...actual, estado } };
    });
  };

  const setObservacion = (estudianteId: string, valor: string) => {
    setLocal(prev => {
      const actual = prev[estudianteId] ?? { estado: 'PRESENTE', observacion: '' };
      return { ...prev, [estudianteId]: { ...actual, observacion: valor } };
    });
  };

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <p className="text-sm font-semibold text-slate-600 mb-3">Selecciona tu clase y la fecha</p>
        <p className="text-xs text-slate-400 -mt-2 mb-3">La asistencia es de tu materia: cada profesor registra la de su propia clase. Estados: P = Presente · A = Ausente · T = Tarde · E = Excusa</p>
        {sinAsignaciones && (
          <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-700">Aún no tienes materias asignadas. Pide a administración que te asigne la materia y el grado para poder tomar asistencia.</p>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Grado</label>
            <select value={gradoId} onChange={e => { setGradoId(e.target.value); setMateriaId(''); }}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-h-[44px]">
              <option value="">Seleccionar grado</option>
              {grados.map(g => <option key={g.id} value={g.id}>{g.nombre}{g.grupo}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Materia</label>
            <select value={materiaId} onChange={e => setMateriaId(e.target.value)} disabled={!gradoId}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-h-[44px] disabled:opacity-50">
              <option value="">Seleccionar materia</option>
              {materias.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Fecha</label>
            <input type="date" value={fecha} min={haceNDias(3)} max={hoyISO()} onChange={e => setFecha(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-h-[44px]" />
          </div>
        </div>
      </div>

      {!gradoId || !materiaId ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center py-12 text-slate-400">
          <CalendarCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Selecciona el grado y la materia para tomar asistencia</p>
        </div>
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
            <table className="w-full min-w-[560px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>{['Estudiante', 'Asistencia', 'Observación'].map(h => <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(filas as FilaAsistencia[]).map(f => {
                  const est = local[f.estudianteId] ?? { estado: f.estado, observacion: f.observacion ?? '' };
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
                      <td className="px-4 py-3"><SelectorEstado estado={est.estado} onChange={e => cambiarEstado(f.estudianteId, e)} /></td>
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
