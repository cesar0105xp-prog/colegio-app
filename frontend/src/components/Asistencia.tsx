import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, CheckCircle, AlertCircle, X, Save, AlertTriangle } from 'lucide-react';
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

const CICLO: Record<string, string> = { PRESENTE: 'AUSENTE', AUSENTE: 'TARDE', TARDE: 'EXCUSA', EXCUSA: 'PRESENTE' };
const ESTADO_COLOR: Record<string, string> = {
  PRESENTE: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
  AUSENTE: 'bg-red-100 text-red-700 hover:bg-red-200',
  TARDE: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
  EXCUSA: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
};
const ESTADO_LABEL: Record<string, string> = { PRESENTE: 'Presente', AUSENTE: 'Ausente', TARDE: 'Tarde', EXCUSA: 'Excusa' };

const hoyISO = () => new Date().toISOString().split('T')[0];
const haceNDias = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; };

type Grado = { id: string; nombre: string; grupo: string };
type FilaAsistencia = {
  estudianteId: string; nombres: string; apellidos: string; registroId: string | null;
  estadoManana: string; estadoTarde: string; observacion: string | null; justificada: boolean; ausenciasMes: number;
};
type EstadoLocal = { estadoManana: string; estadoTarde: string; observacion: string };

function EstadoBadge({ estado, onClick }: { estado: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-w-[80px] min-h-[36px] ${ESTADO_COLOR[estado]}`}>
      {ESTADO_LABEL[estado]}
    </button>
  );
}

export default function Asistencia() {
  const qc = useQueryClient();
  const [gradoId, setGradoId] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);
  const [local, setLocal] = useState<Record<string, EstadoLocal>>({});

  const { data: grados = [] } = useQuery({ queryKey: ['grados'], queryFn: async () => (await api.get('/grados')).data.datos ?? [] });

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
      setToast({ msg: res.data.mensaje, tipo: 'ok' });
    },
    onError: (e: unknown) => {
      const d = (e as { response?: { data?: { mensaje?: string; errores?: string[] } } })?.response?.data;
      setToast({ msg: d?.errores?.[0] ?? d?.mensaje ?? 'Error al guardar la asistencia', tipo: 'error' });
    },
  });

  const toggle = (estudianteId: string, mitad: 'estadoManana' | 'estadoTarde') => {
    setLocal(prev => {
      const actual = prev[estudianteId] ?? { estadoManana: 'PRESENTE', estadoTarde: 'PRESENTE', observacion: '' };
      return { ...prev, [estudianteId]: { ...actual, [mitad]: CICLO[actual[mitad]] } };
    });
  };

  const setObservacion = (estudianteId: string, valor: string) => {
    setLocal(prev => {
      const actual = prev[estudianteId] ?? { estadoManana: 'PRESENTE', estadoTarde: 'PRESENTE', observacion: '' };
      return { ...prev, [estudianteId]: { ...actual, observacion: valor } };
    });
  };

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <p className="text-sm font-semibold text-slate-600 mb-3">Selecciona el grado y la fecha</p>
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
            <input type="date" value={fecha} min={haceNDias(3)} max={hoyISO()} onChange={e => setFecha(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-h-[44px]" />
          </div>
        </div>
      </div>

      {!gradoId ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center py-12 text-slate-400">
          <CalendarCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Selecciona un grado para tomar asistencia</p>
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
                      <td className="px-4 py-3"><EstadoBadge estado={est.estadoManana} onClick={() => toggle(f.estudianteId, 'estadoManana')} /></td>
                      <td className="px-4 py-3"><EstadoBadge estado={est.estadoTarde} onClick={() => toggle(f.estudianteId, 'estadoTarde')} /></td>
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
