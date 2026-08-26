import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  GraduationCap, BarChart2, ShieldCheck, FileCheck, Award, CheckCircle, AlertCircle, X,
  Download, Clock, XCircle, FileText,
} from 'lucide-react';
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

const TIPOS: { tipo: string; titulo: string; desc: string; icono: typeof GraduationCap; color: string }[] = [
  { tipo: 'ESTUDIO', titulo: 'Certificado de estudio', desc: 'Constancia de matrícula vigente', icono: GraduationCap, color: 'bg-blue-500' },
  { tipo: 'NOTAS', titulo: 'Certificado de notas', desc: 'Calificaciones del período académico activo', icono: BarChart2, color: 'bg-violet-500' },
  { tipo: 'CONDUCTA', titulo: 'Certificado de conducta', desc: 'Comportamiento y convivencia escolar', icono: ShieldCheck, color: 'bg-emerald-500' },
  { tipo: 'PAZ_Y_SALVO', titulo: 'Paz y salvo', desc: 'Constancia de no tener deudas pendientes', icono: FileCheck, color: 'bg-amber-500' },
  { tipo: 'DIPLOMA', titulo: 'Diploma', desc: 'Certificado de grado o promoción', icono: Award, color: 'bg-red-500' },
];
const LABEL_TIPO: Record<string, string> = Object.fromEntries(TIPOS.map(t => [t.tipo, t.titulo]));
const ESTADO_COLOR: Record<string, string> = { PENDIENTE: 'bg-amber-50 text-amber-700', EN_PROCESO: 'bg-blue-50 text-blue-700', LISTO: 'bg-emerald-50 text-emerald-700', ENTREGADO: 'bg-slate-100 text-slate-500' };
const ESTADO_ICONO: Record<string, typeof Clock> = { PENDIENTE: Clock, EN_PROCESO: Clock, LISTO: CheckCircle, ENTREGADO: CheckCircle };
const LABEL_ESTADO: Record<string, string> = { PENDIENTE: 'Pendiente', EN_PROCESO: 'En proceso', LISTO: 'Listo para descargar', ENTREGADO: 'Descargado' };

type Hijo = { id: string; nombres: string; apellidos: string; grado: { nombre: string; grupo: string } };
type Solicitud = {
  id: string; tipoCertificado: string; estado: string; observaciones: string | null; createdAt: string;
  estudiante: { id: string; nombres: string; apellidos: string; grado: { nombre: string; grupo: string } };
};
type FormSolicitud = { estudianteId: string; observaciones?: string };

function mensajeError(e: unknown, fallback: string): string {
  const d = (e as { response?: { data?: { mensaje?: string; errores?: string[] } } })?.response?.data;
  return d?.errores?.[0] ?? d?.mensaje ?? fallback;
}

export default function SolicitudCertificados() {
  const qc = useQueryClient();
  const [tipoSeleccionado, setTipoSeleccionado] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);
  const [descargando, setDescargando] = useState<string | null>(null);

  const { data: hijos = [] } = useQuery({ queryKey: ['mis-hijos'], queryFn: async () => (await api.get('/estudiantes/mis-hijos')).data.datos ?? [] });
  const { data: solicitudes = [], isLoading } = useQuery({
    queryKey: ['mis-certificados'],
    queryFn: async () => (await api.get('/certificados/mis')).data.datos ?? [],
    staleTime: 0,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormSolicitud>();

  const crearMutation = useMutation({
    mutationFn: (d: FormSolicitud) => api.post('/certificados', { ...d, tipoCertificado: tipoSeleccionado }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mis-certificados'] });
      setTipoSeleccionado(null); reset();
      setToast({ msg: 'Solicitud enviada correctamente', tipo: 'ok' });
    },
    onError: (e: unknown) => setToast({ msg: mensajeError(e, 'Error al enviar la solicitud'), tipo: 'error' }),
  });

  const descargar = async (id: string) => {
    setDescargando(id);
    try {
      const res = await api.get(`/certificados/${id}/descargar`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
      qc.invalidateQueries({ queryKey: ['mis-certificados'] });
    } catch {
      setToast({ msg: 'Error al descargar el certificado', tipo: 'error' });
    } finally {
      setDescargando(null);
    }
  };

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      <div>
        <p className="text-sm font-semibold text-slate-600 mb-3">Solicitar un certificado</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TIPOS.map(t => (
            <button key={t.tipo} onClick={() => { setTipoSeleccionado(t.tipo); reset(); }}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-left hover:shadow-md hover:border-blue-200 transition-all">
              <div className={`w-10 h-10 ${t.color} rounded-xl flex items-center justify-center mb-3`}><t.icono className="w-5 h-5 text-white" /></div>
              <h3 className="font-semibold text-slate-800">{t.titulo}</h3>
              <p className="text-xs text-slate-500 mt-1">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-600">Mis solicitudes</p>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-24"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
        ) : (solicitudes as Solicitud[]).length === 0 ? (
          <div className="text-center py-10 text-slate-400"><FileText className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No has solicitado certificados aún</p></div>
        ) : (
          <div className="divide-y divide-slate-50">
            {(solicitudes as Solicitud[]).map(s => {
              const Icono = ESTADO_ICONO[s.estado];
              const puedeDescargar = s.estado === 'LISTO' || s.estado === 'ENTREGADO';
              return (
                <div key={s.id} className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{LABEL_TIPO[s.tipoCertificado]} · {s.estudiante.nombres} {s.estudiante.apellidos}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Solicitado el {new Date(s.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${ESTADO_COLOR[s.estado]}`}>
                      <Icono className="w-3 h-3" /> {LABEL_ESTADO[s.estado]}
                    </span>
                    {puedeDescargar && (
                      <button onClick={() => descargar(s.id)} disabled={descargando === s.id}
                        className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 min-h-[36px]">
                        <Download className="w-3.5 h-3.5" /> {descargando === s.id ? 'Abriendo...' : 'Descargar'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {tipoSeleccionado && (
        <Modal titulo={`Solicitar ${LABEL_TIPO[tipoSeleccionado].toLowerCase()}`} onClose={() => setTipoSeleccionado(null)}>
          <form onSubmit={handleSubmit(d => crearMutation.mutate(d))} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Estudiante *</label>
              <select className={inputCls(errors.estudianteId?.message)} {...register('estudianteId', { required: 'Selecciona el estudiante' })}>
                <option value="">Seleccionar hijo</option>
                {(hijos as Hijo[]).map(h => <option key={h.id} value={h.id}>{h.nombres} {h.apellidos} — {h.grado.nombre}{h.grado.grupo}</option>)}
              </select>
              {errors.estudianteId && <p className="mt-1 text-xs text-red-500">{errors.estudianteId.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Observaciones (opcional)</label>
              <textarea rows={3} maxLength={300} className={`${inputCls()} resize-none`} placeholder="Ej: Lo necesito para un trámite de EPS..."
                {...register('observaciones', { maxLength: { value: 300, message: 'Máximo 300 caracteres' } })} />
              {errors.observaciones && <p className="mt-1 text-xs text-red-500">{errors.observaciones.message}</p>}
            </div>
            <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
              <button type="button" onClick={() => setTipoSeleccionado(null)} className="px-4 py-2.5 text-sm text-slate-600 min-h-[44px]">Cancelar</button>
              <button type="submit" disabled={crearMutation.isPending} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50 min-h-[44px]">
                {crearMutation.isPending ? 'Enviando...' : 'Enviar solicitud'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
