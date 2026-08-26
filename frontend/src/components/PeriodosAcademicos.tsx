import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Calendar, CheckCircle, AlertCircle, X, Sparkles, ChevronDown, ChevronUp, Edit2,
} from 'lucide-react';
import api from '../services/api';

// ─── HELPERS LOCALES (mismo patrón que el resto del panel) ────────────────────

function Toast({ mensaje, tipo, onClose }: { mensaje: string; tipo: 'ok' | 'error'; onClose: () => void }) {
  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${tipo === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
      {tipo === 'ok' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {mensaje}
      <button onClick={onClose}><X className="w-4 h-4" /></button>
    </div>
  );
}

function Modal({ titulo, onClose, children, ancho = 'max-w-lg' }: { titulo: string; onClose: () => void; children: React.ReactNode; ancho?: string }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
      <div className={`bg-white rounded-t-2xl sm:rounded-2xl w-full ${ancho} shadow-2xl max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-slate-800">{titulo}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function Campo({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1.5">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

const inputCls = (err?: string) =>
  `w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white min-h-[44px] ${err ? 'border-red-400' : 'border-slate-200'}`;

function Badge({ texto, color }: { texto: string; color: string }) {
  return <span className={`text-xs px-2.5 py-1 rounded-lg font-medium whitespace-nowrap ${color}`}>{texto}</span>;
}

function BotonesForm({ onCancel, cargando, labelGuardar = 'Guardar' }: { onCancel: () => void; cargando: boolean; labelGuardar?: string }) {
  return (
    <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
      <button type="button" onClick={onCancel} className="px-4 py-2.5 text-sm text-slate-600 hover:text-slate-800 transition min-h-[44px]">Cancelar</button>
      <button type="submit" disabled={cargando} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50 min-h-[44px]">
        {cargando ? 'Guardando...' : labelGuardar}
      </button>
    </div>
  );
}

function mensajeError(e: unknown, fallback: string): string {
  const d = (e as { response?: { data?: { mensaje?: string; errores?: string[] } } })?.response?.data;
  return d?.errores?.[0] ?? d?.mensaje ?? fallback;
}

const fmtFecha = (iso: string) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtFechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });

type PeriodoPreview = { numero: number; nombre: string; fechaInicio: string; fechaFin: string; peso: number; diasHabiles: number };
type PreviewResult = { anio: number; fechaInicio: string; fechaFin: string; periodos: PeriodoPreview[] };
type PeriodoRow = { id: string; nombre: string; numero: number; anio: number; fechaInicio: string; fechaFin: string; activo: boolean; peso: string };
type ConfiguracionRow = { id: string; anio: number; fechaInicio: string; fechaFin: string; periodos: PeriodoRow[] };

type FormGenerar = { anio: number; fechaInicio: string; fechaFin: string };

export default function PeriodosAcademicos() {
  const qc = useQueryClient();
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [editando, setEditando] = useState<PeriodoRow | null>(null);

  const anioActual = new Date().getFullYear();
  const { register, handleSubmit, getValues, formState: { errors } } = useForm<FormGenerar>({
    defaultValues: { anio: anioActual, fechaInicio: `${anioActual}-01-20`, fechaFin: `${anioActual}-11-28` },
  });

  const { data: configuraciones = [], isLoading } = useQuery({
    queryKey: ['configuraciones-academicas'],
    queryFn: async () => (await api.get('/configuraciones-academicas')).data.datos ?? [],
    staleTime: 0,
  });

  const previewMutation = useMutation({
    mutationFn: (d: FormGenerar) => api.get('/periodos/preview', { params: { anio: d.anio, inicio: d.fechaInicio, fin: d.fechaFin } }),
    onSuccess: (res) => setPreview(res.data.datos),
    onError: (e: unknown) => { setPreview(null); setToast({ msg: mensajeError(e, 'Error al calcular los períodos'), tipo: 'error' }); },
  });

  const confirmarMutation = useMutation({
    mutationFn: () => {
      const d = getValues();
      return api.post('/periodos/confirmar', { anio: d.anio, fechaInicio: d.fechaInicio, fechaFin: d.fechaFin });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['configuraciones-academicas'] });
      qc.invalidateQueries({ queryKey: ['periodos'] });
      setPreview(null);
      setToast({ msg: res.data.mensaje, tipo: 'ok' });
    },
    onError: (e: unknown) => setToast({ msg: mensajeError(e, 'Error al guardar los períodos'), tipo: 'error' }),
  });

  const { register: regEdit, handleSubmit: hEdit, reset: resetEdit, formState: { errors: eEdit } } = useForm<{ fechaInicio: string; fechaFin: string }>();

  React.useEffect(() => {
    if (editando) resetEdit({ fechaInicio: editando.fechaInicio.split('T')[0], fechaFin: editando.fechaFin.split('T')[0] });
  }, [editando]);

  const editarMutation = useMutation({
    mutationFn: (d: { fechaInicio: string; fechaFin: string }) =>
      api.put(`/periodos/${editando!.id}`, { nombre: editando!.nombre, numero: editando!.numero, anio: editando!.anio, ...d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['configuraciones-academicas'] });
      qc.invalidateQueries({ queryKey: ['periodos'] });
      setEditando(null);
      setToast({ msg: 'Período actualizado', tipo: 'ok' });
    },
    onError: (e: unknown) => setToast({ msg: mensajeError(e, 'Error al actualizar el período'), tipo: 'error' }),
  });

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      {/* Generador automático */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-slate-700">Generación automática de períodos</h3>
        </div>
        <p className="text-sm text-slate-500 mb-4">Calcula 4 períodos equitativos en días hábiles, excluyendo fines de semana y festivos colombianos.</p>

        <form onSubmit={handleSubmit(d => { setPreview(null); previewMutation.mutate(d); })} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Campo label="Año *" error={errors.anio?.message}>
              <input type="number" min={2020} max={2099} className={inputCls(errors.anio?.message)}
                {...register('anio', { required: 'Requerido', valueAsNumber: true, min: { value: 2020, message: 'Mínimo 2020' }, max: { value: 2099, message: 'Máximo 2099' } })} />
            </Campo>
            <Campo label="Fecha de inicio *" error={errors.fechaInicio?.message}>
              <input type="date" className={inputCls(errors.fechaInicio?.message)} {...register('fechaInicio', { required: 'Requerido' })} />
            </Campo>
            <Campo label="Fecha de fin *" error={errors.fechaFin?.message}>
              <input type="date" className={inputCls(errors.fechaFin?.message)} {...register('fechaFin', { required: 'Requerido' })} />
            </Campo>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={previewMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50 min-h-[44px]">
              {previewMutation.isPending ? 'Calculando...' : 'Calcular períodos'}
            </button>
          </div>
        </form>

        {preview && (
          <div className="mt-5 pt-5 border-t border-slate-100 space-y-3">
            <p className="text-sm font-semibold text-slate-600">Vista previa — {preview.anio}</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>{['Período', 'Fecha inicio', 'Fecha fin', 'Días hábiles', 'Peso'].map(h => <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {preview.periodos.map(p => (
                    <tr key={p.numero}>
                      <td className="px-4 py-2.5 text-sm font-medium text-slate-800">{p.nombre}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-600">{fmtFecha(p.fechaInicio)}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-600">{fmtFecha(p.fechaFin)}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-500">{p.diasHabiles}</td>
                      <td className="px-4 py-2.5"><Badge texto={`${p.peso}%`} color="bg-blue-50 text-blue-700" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <button onClick={() => confirmarMutation.mutate()} disabled={confirmarMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition disabled:opacity-50 min-h-[44px]">
                <CheckCircle className="w-4 h-4" /> {confirmarMutation.isPending ? 'Guardando...' : 'Confirmar y guardar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Configuraciones guardadas */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-600">Configuraciones académicas guardadas</p>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-24"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
        ) : (configuraciones as ConfiguracionRow[]).length === 0 ? (
          <div className="text-center py-10 text-slate-400"><Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No hay configuraciones generadas aún</p></div>
        ) : (
          <div className="divide-y divide-slate-50">
            {(configuraciones as ConfiguracionRow[]).map(c => (
              <div key={c.id}>
                <button onClick={() => setExpandido(expandido === c.id ? null : c.id)} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors">
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-800">Año {c.anio}</p>
                    <p className="text-xs text-slate-400">{fmtFechaCorta(c.fechaInicio)} — {fmtFechaCorta(c.fechaFin)} · {c.periodos.length} período(s)</p>
                  </div>
                  {expandido === c.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {expandido === c.id && (
                  <div className="px-5 pb-4 space-y-2">
                    {c.periodos.map(p => (
                      <div key={p.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-700">{p.nombre}</span>
                            {p.activo && <Badge texto="Activo" color="bg-blue-100 text-blue-700" />}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{fmtFecha(p.fechaInicio)} — {fmtFecha(p.fechaFin)} · Peso {Number(p.peso)}%</p>
                        </div>
                        <button onClick={() => setEditando(p)} title="Editar fechas" className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors flex-shrink-0"><Edit2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {editando && (
        <Modal titulo={`Editar ${editando.nombre} — ${editando.anio}`} onClose={() => setEditando(null)} ancho="max-w-sm">
          <form onSubmit={hEdit(d => editarMutation.mutate(d))} className="space-y-4">
            <Campo label="Fecha de inicio *" error={eEdit.fechaInicio?.message}>
              <input type="date" className={inputCls(eEdit.fechaInicio?.message)} {...regEdit('fechaInicio', { required: 'Requerido' })} />
            </Campo>
            <Campo label="Fecha de fin *" error={eEdit.fechaFin?.message}>
              <input type="date" className={inputCls(eEdit.fechaFin?.message)} {...regEdit('fechaFin', { required: 'Requerido' })} />
            </Campo>
            <BotonesForm onCancel={() => setEditando(null)} cargando={editarMutation.isPending} labelGuardar="Guardar cambios" />
          </form>
        </Modal>
      )}
    </div>
  );
}
