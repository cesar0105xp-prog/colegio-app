import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { FileText, CheckCircle, AlertCircle, X, Check, Ban, ChevronLeft, ChevronRight } from 'lucide-react';
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

function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-slate-800">{titulo}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

const inputCls = (err?: string) =>
  `w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white min-h-[44px] ${err ? 'border-red-400' : 'border-slate-200'}`;

const LABEL_MOTIVO: Record<string, string> = { CITA_MEDICA: 'Cita médica', DILIGENCIA_FAMILIAR: 'Diligencia familiar', VIAJE: 'Viaje', ENFERMEDAD: 'Enfermedad', OTRO: 'Otro' };
const ESTADO_COLOR: Record<string, string> = { PENDIENTE: 'bg-amber-50 text-amber-700', APROBADO: 'bg-emerald-50 text-emerald-700', RECHAZADO: 'bg-red-50 text-red-600' };
const LABEL_ESTADO: Record<string, string> = { PENDIENTE: 'Pendiente', APROBADO: 'Aprobado', RECHAZADO: 'Rechazado' };

type Grado = { id: string; nombre: string; grupo: string };
type Solicitud = {
  id: string; fechaPermiso: string; motivoCodigo: string; descripcion: string; estado: string; observacionResp: string | null;
  estudiante: { id: string; nombres: string; apellidos: string; grado: { nombre: string; grupo: string } };
  padre: { email: string; perfilPadre: { nombres: string; apellidos: string; telefono: string } | null };
};

function mensajeError(e: unknown, fallback: string): string {
  const d = (e as { response?: { data?: { mensaje?: string; errores?: string[] } } })?.response?.data;
  return d?.errores?.[0] ?? d?.mensaje ?? fallback;
}

export default function GestionPermisos() {
  const qc = useQueryClient();
  const [estado, setEstado] = useState('PENDIENTE');
  const [fecha, setFecha] = useState('');
  const [gradoId, setGradoId] = useState('');
  const [pagina, setPagina] = useState(1);
  const [rechazando, setRechazando] = useState<Solicitud | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);

  const { data: grados = [] } = useQuery({ queryKey: ['grados'], queryFn: async () => (await api.get('/grados')).data.datos ?? [] });

  const { data, isLoading } = useQuery({
    queryKey: ['permisos', estado, fecha, gradoId, pagina],
    queryFn: async () => (await api.get('/permisos', { params: { estado: estado || undefined, fecha: fecha || undefined, grado: gradoId || undefined, pagina, limite: 20 } })).data,
    staleTime: 0,
  });
  const solicitudes = data?.datos ?? [];
  const meta = data?.meta as { pagina: number; totalPaginas: number; total: number } | undefined;

  useEffect(() => { setPagina(1); }, [estado, fecha, gradoId]);

  const aprobarMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/permisos/${id}/aprobar`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['permisos'] }); setToast({ msg: 'Solicitud aprobada', tipo: 'ok' }); },
    onError: (e: unknown) => setToast({ msg: mensajeError(e, 'Error al aprobar'), tipo: 'error' }),
  });

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<{ observacionResp: string }>();
  const watchMotivo = watch('observacionResp');

  const rechazarMutation = useMutation({
    mutationFn: (d: { id: string; observacionResp: string }) => api.patch(`/permisos/${d.id}/rechazar`, { observacionResp: d.observacionResp }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['permisos'] }); setRechazando(null); reset(); setToast({ msg: 'Solicitud rechazada', tipo: 'ok' }); },
    onError: (e: unknown) => setToast({ msg: mensajeError(e, 'Error al rechazar'), tipo: 'error' }),
  });

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      <div className="flex flex-wrap items-center gap-3">
        <select value={estado} onChange={e => setEstado(e.target.value)} className="py-2.5 px-3 border border-slate-200 rounded-xl text-sm bg-white min-h-[44px]">
          <option value="PENDIENTE">Pendientes</option>
          <option value="APROBADO">Aprobados</option>
          <option value="RECHAZADO">Rechazados</option>
          <option value="">Todos los estados</option>
        </select>
        <select value={gradoId} onChange={e => setGradoId(e.target.value)} className="py-2.5 px-3 border border-slate-200 rounded-xl text-sm bg-white min-h-[44px]">
          <option value="">Todos los grados</option>
          {(grados as Grado[]).map(g => <option key={g.id} value={g.id}>{g.nombre}{g.grupo}</option>)}
        </select>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
          className="py-2.5 px-3 border border-slate-200 rounded-xl text-sm bg-white min-h-[44px]" />
        {fecha && <button onClick={() => setFecha('')} className="text-xs text-slate-400 hover:text-slate-600">Limpiar fecha</button>}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
        ) : (solicitudes as Solicitud[]).length === 0 ? (
          <div className="text-center py-12 text-slate-400"><FileText className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No hay solicitudes que coincidan con los filtros</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>{['Estudiante', 'Grado', 'Padre/Acudiente', 'Motivo', 'Fecha', 'Descripción', 'Estado', 'Acciones'].map(h => <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(solicitudes as Solicitud[]).map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 whitespace-nowrap">{s.estudiante.nombres} {s.estudiante.apellidos}</td>
                    <td className="px-4 py-3"><span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg font-medium">{s.estudiante.grado.nombre}{s.estudiante.grado.grupo}</span></td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      <p>{s.padre.perfilPadre ? `${s.padre.perfilPadre.nombres} ${s.padre.perfilPadre.apellidos}` : '—'}</p>
                      <p className="text-xs text-slate-400">{s.padre.email}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{LABEL_MOTIVO[s.motivoCodigo]}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{new Date(s.fechaPermiso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 max-w-xs"><p className="line-clamp-2 break-words">{s.descripcion}</p></td>
                    <td className="px-4 py-3"><span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ESTADO_COLOR[s.estado]}`}>{LABEL_ESTADO[s.estado]}</span></td>
                    <td className="px-4 py-3">
                      {s.estado === 'PENDIENTE' ? (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => aprobarMutation.mutate(s.id)} title="Aprobar" className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"><Check className="w-4 h-4" /></button>
                          <button onClick={() => { setRechazando(s); reset(); }} title="Rechazar" className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Ban className="w-4 h-4" /></button>
                        </div>
                      ) : s.estado === 'RECHAZADO' && s.observacionResp ? (
                        <span className="text-xs text-slate-400" title={s.observacionResp}>Ver motivo</span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta && meta.total > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
            <span>{meta.total} solicitud(es) en total</span>
            {meta.totalPaginas > 1 && (
              <div className="flex items-center gap-2">
                <button disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50 min-h-[32px] min-w-[32px]"><ChevronLeft className="w-3.5 h-3.5" /></button>
                <span>Página {meta.pagina} de {meta.totalPaginas}</span>
                <button disabled={pagina >= meta.totalPaginas} onClick={() => setPagina(p => p + 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50 min-h-[32px] min-w-[32px]"><ChevronRight className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>
        )}
      </div>

      {rechazando && (
        <Modal titulo="Rechazar solicitud de permiso" onClose={() => setRechazando(null)}>
          <div className="mb-4 bg-slate-50 rounded-xl p-3">
            <p className="text-sm font-medium text-slate-700">{rechazando.estudiante.nombres} {rechazando.estudiante.apellidos}</p>
            <p className="text-xs text-slate-400">{LABEL_MOTIVO[rechazando.motivoCodigo]} · {new Date(rechazando.fechaPermiso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</p>
          </div>
          <form onSubmit={handleSubmit(d => rechazarMutation.mutate({ id: rechazando.id, ...d }))} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Motivo del rechazo *</label>
              <textarea rows={4} maxLength={300} className={`${inputCls(errors.observacionResp?.message)} resize-none`}
                placeholder="Explica por qué se rechaza esta solicitud..."
                {...register('observacionResp', { required: 'El motivo es requerido', maxLength: { value: 300, message: 'Máximo 300 caracteres' } })} />
              <p className="mt-1 text-xs text-right text-slate-400">{watchMotivo?.length ?? 0} / 300 caracteres</p>
              {errors.observacionResp && <p className="mt-1 text-xs text-red-500">{errors.observacionResp.message}</p>}
            </div>
            <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
              <button type="button" onClick={() => setRechazando(null)} className="px-4 py-2.5 text-sm text-slate-600 min-h-[44px]">Cancelar</button>
              <button type="submit" disabled={rechazarMutation.isPending} className="px-5 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition disabled:opacity-50 min-h-[44px]">
                {rechazarMutation.isPending ? 'Rechazando...' : 'Rechazar solicitud'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
