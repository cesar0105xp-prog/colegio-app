import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { FileText, CheckCircle, AlertCircle, X, Send, Clock, XCircle } from 'lucide-react';
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

const inputCls = (err?: string) =>
  `w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white min-h-[44px] ${err ? 'border-red-400' : 'border-slate-200'}`;

const MOTIVOS = ['CITA_MEDICA', 'DILIGENCIA_FAMILIAR', 'VIAJE', 'ENFERMEDAD', 'OTRO'];
const LABEL_MOTIVO: Record<string, string> = { CITA_MEDICA: 'Cita médica', DILIGENCIA_FAMILIAR: 'Diligencia familiar', VIAJE: 'Viaje', ENFERMEDAD: 'Enfermedad', OTRO: 'Otro' };
const ESTADO_COLOR: Record<string, string> = { PENDIENTE: 'bg-amber-50 text-amber-700', APROBADO: 'bg-emerald-50 text-emerald-700', RECHAZADO: 'bg-red-50 text-red-600' };
const ESTADO_ICONO: Record<string, typeof Clock> = { PENDIENTE: Clock, APROBADO: CheckCircle, RECHAZADO: XCircle };
const LABEL_ESTADO: Record<string, string> = { PENDIENTE: 'Pendiente', APROBADO: 'Aprobado', RECHAZADO: 'Rechazado' };

const hoyISO = () => new Date().toISOString().split('T')[0];
const masMenosNDias = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]; };

type Hijo = { id: string; nombres: string; apellidos: string; grado: { nombre: string; grupo: string } };
type Solicitud = {
  id: string; fechaPermiso: string; motivoCodigo: string; descripcion: string; estado: string;
  observacionResp: string | null; estudiante: { id: string; nombres: string; apellidos: string };
};
type FormPermiso = { estudianteId: string; fechaPermiso: string; motivoCodigo: string; descripcion: string };

export default function SolicitudPermiso() {
  const qc = useQueryClient();
  const [toast, setToast] = React.useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);

  const { data: hijos = [] } = useQuery({ queryKey: ['mis-hijos'], queryFn: async () => (await api.get('/estudiantes/mis-hijos')).data.datos ?? [] });
  const { data: solicitudes = [], isLoading } = useQuery({
    queryKey: ['mis-permisos'],
    queryFn: async () => (await api.get('/permisos/mis')).data.datos ?? [],
    staleTime: 0,
  });

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormPermiso>({ defaultValues: { fechaPermiso: hoyISO() } });
  const watchDescripcion = watch('descripcion');

  useEffect(() => {
    if ((hijos as Hijo[]).length === 1) reset(prev => ({ ...prev, estudianteId: (hijos as Hijo[])[0].id }));
  }, [hijos]);

  const crearMutation = useMutation({
    mutationFn: (d: FormPermiso) => api.post('/permisos', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mis-permisos'] });
      reset({ fechaPermiso: hoyISO(), estudianteId: (hijos as Hijo[]).length === 1 ? (hijos as Hijo[])[0].id : '', motivoCodigo: '', descripcion: '' });
      setToast({ msg: 'Solicitud de permiso enviada', tipo: 'ok' });
    },
    onError: (e: unknown) => {
      const d = (e as { response?: { data?: { mensaje?: string; errores?: string[] } } })?.response?.data;
      setToast({ msg: d?.errores?.[0] ?? d?.mensaje ?? 'Error al enviar la solicitud', tipo: 'error' });
    },
  });

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-slate-700">Solicitar permiso o ausencia</h3>
        </div>
        <p className="text-sm text-slate-500 mb-4">La solicitud debe estar dentro de los 30 días antes o después de hoy.</p>

        <form onSubmit={handleSubmit(d => crearMutation.mutate(d))} className="space-y-4">
          {(hijos as Hijo[]).length > 1 && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Estudiante *</label>
              <select className={inputCls(errors.estudianteId?.message)} {...register('estudianteId', { required: 'Selecciona el estudiante' })}>
                <option value="">Seleccionar hijo</option>
                {(hijos as Hijo[]).map(h => <option key={h.id} value={h.id}>{h.nombres} {h.apellidos} — {h.grado.nombre}{h.grado.grupo}</option>)}
              </select>
              {errors.estudianteId && <p className="mt-1 text-xs text-red-500">{errors.estudianteId.message}</p>}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Fecha *</label>
              <input type="date" min={masMenosNDias(-30)} max={masMenosNDias(30)} className={inputCls(errors.fechaPermiso?.message)}
                {...register('fechaPermiso', { required: 'Requerido' })} />
              {errors.fechaPermiso && <p className="mt-1 text-xs text-red-500">{errors.fechaPermiso.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Motivo *</label>
              <select className={inputCls(errors.motivoCodigo?.message)} {...register('motivoCodigo', { required: 'Selecciona el motivo' })}>
                <option value="">Seleccionar</option>
                {MOTIVOS.map(m => <option key={m} value={m}>{LABEL_MOTIVO[m]}</option>)}
              </select>
              {errors.motivoCodigo && <p className="mt-1 text-xs text-red-500">{errors.motivoCodigo.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Descripción *</label>
            <textarea rows={4} maxLength={500} className={`${inputCls(errors.descripcion?.message)} resize-none`}
              placeholder="Describe el motivo de la solicitud (mínimo 10 caracteres)..."
              {...register('descripcion', { required: 'La descripción es requerida', minLength: { value: 10, message: 'Mínimo 10 caracteres' }, maxLength: { value: 500, message: 'Máximo 500 caracteres' } })} />
            <p className={`mt-1 text-xs text-right ${(watchDescripcion?.length ?? 0) >= 500 ? 'text-red-500' : 'text-slate-400'}`}>{watchDescripcion?.length ?? 0} / 500 caracteres</p>
            {errors.descripcion && <p className="mt-1 text-xs text-red-500">{errors.descripcion.message}</p>}
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button type="submit" disabled={crearMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50 min-h-[44px]">
              <Send className="w-4 h-4" /> {crearMutation.isPending ? 'Enviando...' : 'Enviar solicitud'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-600">Mis solicitudes</p>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-24"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
        ) : (solicitudes as Solicitud[]).length === 0 ? (
          <div className="text-center py-10 text-slate-400"><FileText className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No has enviado solicitudes de permiso</p></div>
        ) : (
          <div className="divide-y divide-slate-50">
            {(solicitudes as Solicitud[]).map(s => {
              const Icono = ESTADO_ICONO[s.estado];
              return (
                <div key={s.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{s.estudiante.nombres} {s.estudiante.apellidos} · {LABEL_MOTIVO[s.motivoCodigo]}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{new Date(s.fechaPermiso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</p>
                    </div>
                    <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${ESTADO_COLOR[s.estado]}`}>
                      <Icono className="w-3 h-3" /> {LABEL_ESTADO[s.estado]}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-2 break-words whitespace-pre-wrap">{s.descripcion}</p>
                  {s.estado === 'RECHAZADO' && s.observacionResp && (
                    <div className="mt-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      <p className="text-xs text-red-600"><strong>Motivo del rechazo:</strong> {s.observacionResp}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
