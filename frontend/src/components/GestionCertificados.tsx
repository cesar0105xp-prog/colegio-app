import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, CheckCircle, AlertCircle, X, Settings, Sparkles, Upload, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
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

const LABEL_TIPO: Record<string, string> = { ESTUDIO: 'Certificado de estudio', NOTAS: 'Certificado de notas', CONDUCTA: 'Certificado de conducta', PAZ_Y_SALVO: 'Paz y salvo', DIPLOMA: 'Diploma' };
const ESTADO_COLOR: Record<string, string> = { PENDIENTE: 'bg-amber-50 text-amber-700', EN_PROCESO: 'bg-blue-50 text-blue-700', LISTO: 'bg-emerald-50 text-emerald-700', ENTREGADO: 'bg-slate-100 text-slate-500' };
const LABEL_ESTADO: Record<string, string> = { PENDIENTE: 'Pendiente', EN_PROCESO: 'En proceso', LISTO: 'Listo', ENTREGADO: 'Descargado' };
const TIPOS_AUTO = ['ESTUDIO', 'NOTAS'];

type Solicitud = {
  id: string; tipoCertificado: string; estado: string; observaciones: string | null; createdAt: string;
  estudiante: { id: string; nombres: string; apellidos: string; grado: { nombre: string; grupo: string } };
  padre: { email: string; perfilPadre: { nombres: string; apellidos: string } | null };
};

function mensajeError(e: unknown, fallback: string): string {
  const d = (e as { response?: { data?: { mensaje?: string; errores?: string[] } } })?.response?.data;
  return d?.errores?.[0] ?? d?.mensaje ?? fallback;
}

export default function GestionCertificados() {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('PENDIENTE');
  const [fecha, setFecha] = useState('');
  const [pagina, setPagina] = useState(1);
  const [procesando, setProcesando] = useState<Solicitud | null>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['certificados', tipo, estado, fecha, pagina],
    queryFn: async () => (await api.get('/certificados', { params: { tipo: tipo || undefined, estado: estado || undefined, fecha: fecha || undefined, pagina, limite: 20 } })).data,
    staleTime: 0,
  });
  const solicitudes = data?.datos ?? [];
  const meta = data?.meta as { pagina: number; totalPaginas: number; total: number } | undefined;

  useEffect(() => { setPagina(1); }, [tipo, estado, fecha]);

  const cerrarModal = () => { setProcesando(null); setArchivo(null); };

  const procesarMutation = useMutation({
    mutationFn: (d: { id: string; generarAutomatico?: boolean; estado?: string; archivo?: File }) => {
      if (d.archivo) {
        const fd = new FormData();
        fd.append('archivo', d.archivo);
        return api.patch(`/certificados/${d.id}/procesar`, fd);
      }
      return api.patch(`/certificados/${d.id}/procesar`, { generarAutomatico: d.generarAutomatico, estado: d.estado });
    },
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['certificados'] }); cerrarModal(); setToast({ msg: res.data.mensaje, tipo: 'ok' }); },
    onError: (e: unknown) => setToast({ msg: mensajeError(e, 'Error al procesar la solicitud'), tipo: 'error' }),
  });

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      <div className="flex flex-wrap items-center gap-3">
        <select value={estado} onChange={e => setEstado(e.target.value)} className="py-2.5 px-3 border border-slate-200 rounded-xl text-sm bg-white min-h-[44px]">
          <option value="PENDIENTE">Pendientes</option>
          <option value="EN_PROCESO">En proceso</option>
          <option value="LISTO">Listos</option>
          <option value="ENTREGADO">Descargados</option>
          <option value="">Todos los estados</option>
        </select>
        <select value={tipo} onChange={e => setTipo(e.target.value)} className="py-2.5 px-3 border border-slate-200 rounded-xl text-sm bg-white min-h-[44px]">
          <option value="">Todos los tipos</option>
          {Object.entries(LABEL_TIPO).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="py-2.5 px-3 border border-slate-200 rounded-xl text-sm bg-white min-h-[44px]" />
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
                <tr>{['Estudiante', 'Grado', 'Tipo', 'Padre/Acudiente', 'Fecha', 'Observaciones', 'Estado', 'Acciones'].map(h => <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(solicitudes as Solicitud[]).map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 whitespace-nowrap">{s.estudiante.nombres} {s.estudiante.apellidos}</td>
                    <td className="px-4 py-3"><span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg font-medium">{s.estudiante.grado.nombre}{s.estudiante.grado.grupo}</span></td>
                    <td className="px-4 py-3 text-sm text-slate-600">{LABEL_TIPO[s.tipoCertificado]}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      <p>{s.padre.perfilPadre ? `${s.padre.perfilPadre.nombres} ${s.padre.perfilPadre.apellidos}` : '—'}</p>
                      <p className="text-xs text-slate-400">{s.padre.email}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{new Date(s.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 max-w-xs"><p className="line-clamp-2 break-words">{s.observaciones ?? '—'}</p></td>
                    <td className="px-4 py-3"><span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ESTADO_COLOR[s.estado]}`}>{LABEL_ESTADO[s.estado]}</span></td>
                    <td className="px-4 py-3">
                      {s.estado === 'PENDIENTE' || s.estado === 'EN_PROCESO' ? (
                        <button onClick={() => setProcesando(s)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition">
                          <Settings className="w-3.5 h-3.5" /> Procesar
                        </button>
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

      {procesando && (
        <Modal titulo="Procesar solicitud" onClose={cerrarModal}>
          <div className="mb-4 bg-slate-50 rounded-xl p-3">
            <p className="text-sm font-medium text-slate-700">{procesando.estudiante.nombres} {procesando.estudiante.apellidos}</p>
            <p className="text-xs text-slate-400">{LABEL_TIPO[procesando.tipoCertificado]} · {procesando.estudiante.grado.nombre}{procesando.estudiante.grado.grupo}</p>
            {procesando.observaciones && <p className="text-xs text-slate-500 mt-1 italic">"{procesando.observaciones}"</p>}
          </div>

          <div className="space-y-4">
            {TIPOS_AUTO.includes(procesando.tipoCertificado) ? (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <p className="text-sm font-semibold text-blue-800">Generación automática</p>
                </div>
                <p className="text-xs text-blue-700 mb-3">Este tipo de certificado se genera automáticamente con los datos del sistema.</p>
                <button onClick={() => procesarMutation.mutate({ id: procesando.id, generarAutomatico: true })} disabled={procesarMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50 min-h-[44px]">
                  <Sparkles className="w-4 h-4" /> {procesarMutation.isPending ? 'Generando...' : 'Generar y marcar como listo'}
                </button>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Upload className="w-4 h-4 text-slate-600" />
                  <p className="text-sm font-semibold text-slate-700">Subir PDF generado</p>
                </div>
                <input type="file" accept="application/pdf" onChange={e => setArchivo(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:text-sm file:font-medium hover:file:bg-blue-700 file:cursor-pointer cursor-pointer" />
                <button onClick={() => archivo && procesarMutation.mutate({ id: procesando.id, archivo })} disabled={!archivo || procesarMutation.isPending}
                  className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50 min-h-[44px]">
                  <Upload className="w-4 h-4" /> {procesarMutation.isPending ? 'Subiendo...' : 'Subir y marcar como listo'}
                </button>
              </div>
            )}

            {procesando.estado === 'PENDIENTE' && (
              <button onClick={() => procesarMutation.mutate({ id: procesando.id, estado: 'EN_PROCESO' })} disabled={procesarMutation.isPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition disabled:opacity-50 min-h-[44px]">
                <Clock className="w-4 h-4" /> Solo marcar en proceso (sin archivo aún)
              </button>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button type="button" onClick={cerrarModal} className="px-4 py-2.5 text-sm text-slate-600 min-h-[44px]">Cerrar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
