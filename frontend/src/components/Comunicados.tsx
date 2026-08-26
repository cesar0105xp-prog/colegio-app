import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Send, Mail, Users, GraduationCap, Clock, CheckCircle, AlertCircle, X, Plus, Archive, ArchiveRestore } from 'lucide-react';
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

type FormComunicado = { titulo: string; mensaje: string; destinatario: string; gradoId?: string };
type ComunicadoRow = { id: string; titulo: string; mensaje: string; destinatario: string; totalEnviados: number; createdAt: string; creadoPor: { email: string }; grado?: { nombre: string; grupo: string } };

export default function Comunicados() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [verArchivados, setVerArchivados] = useState(false);

  const { data: grados = [] } = useQuery({ queryKey: ['grados'], queryFn: async () => (await api.get('/grados')).data.datos ?? [] });
  const { data, isLoading } = useQuery({
    queryKey: ['comunicados'],
    queryFn: async () => (await api.get('/comunicados')).data,
    staleTime: 0,
  });

  const archivarMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/comunicados/${id}/archivar`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['comunicados'] });
      setToast({ msg: res.data.mensaje, tipo: 'ok' });
    },
    onError: () => setToast({ msg: 'Error al archivar', tipo: 'error' }),
  });

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormComunicado>();
  const destinatario = watch('destinatario');
  const watchMensaje = watch('mensaje');

  const enviarMutation = useMutation({
    mutationFn: (d: FormComunicado) => api.post('/comunicados', d),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['comunicados'] });
      setModal(false);
      reset();
      setToast({ msg: res.data.mensaje, tipo: 'ok' });
    },
    onError: (e: unknown) => {
      const d = (e as { response?: { data?: { mensaje?: string; errores?: string[] } } })?.response?.data;
      setToast({ msg: d?.errores?.[0] ?? d?.mensaje ?? 'Error al enviar', tipo: 'error' });
    },
  });

  const inputCls = (err?: string) =>
    `w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white ${err ? 'border-red-400' : 'border-slate-200'}`;

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-slate-500">Envía avisos y comunicados a los padres de familia</p>
          <p className="text-xs text-slate-400 mt-0.5">Los padres reciben el comunicado por correo electrónico</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setVerArchivados(!verArchivados)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-colors ${verArchivados ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
            <Archive className="w-3.5 h-3.5" /> {verArchivados ? 'Ver activos' : 'Ver archivados'}
          </button>
          <button onClick={() => setModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" /> Nuevo comunicado
          </button>
        </div>
      </div>

      {/* Lista de comunicados */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
      ) : (data?.datos ?? []).filter((c: ComunicadoRow & { archivado: boolean }) => c.archivado === verArchivados).length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center py-12 text-slate-400">
          <Mail className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{verArchivados ? 'No hay comunicados archivados' : 'No hay comunicados activos'}</p>
          {!verArchivados && <button onClick={() => setModal(true)} className="mt-2 text-blue-600 text-sm font-medium hover:underline">Crear el primero</button>}
        </div>
      ) : (
        <div className="space-y-3">
          {(data.datos as (ComunicadoRow & { archivado: boolean })[])
            .filter(c => c.archivado === verArchivados)
            .map(c => (
            <div key={c.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${c.archivado ? 'border-slate-200 opacity-70' : 'border-slate-100'}`}>
              <div className="px-5 py-4 cursor-pointer" onClick={() => setExpandido(expandido === c.id ? null : c.id)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-slate-800 truncate">{c.titulo}</h3>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium flex-shrink-0 ${c.destinatario === 'TODOS' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>
                        {c.destinatario === 'TODOS' ? '👥 Todos los padres' : `🎓 Grado ${c.grado?.nombre}${c.grado?.grupo}`}
                      </span>
                      {c.archivado && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Archivado</span>}
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-1">{c.mensaje}</p>
                  </div>
                  <div className="text-right flex-shrink-0 flex items-center gap-2">
                    <button onClick={e => { e.stopPropagation(); archivarMutation.mutate(c.id); }}
                      className={`p-1.5 rounded-lg transition-colors ${c.archivado ? 'text-slate-400 hover:text-blue-600 hover:bg-blue-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                      title={c.archivado ? 'Restaurar' : 'Archivar'}>
                      {c.archivado ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                    </button>
                    <div>
                      <div className="flex items-center gap-1 text-emerald-600 text-xs font-medium justify-end">
                        <Send className="w-3 h-3" /> {c.totalEnviados} enviado(s)
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" />
                        {new Date(c.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              {expandido === c.id && (
                <div className="px-5 pb-4 pt-0 border-t border-slate-50">
                  <p className="text-sm text-slate-600 leading-relaxed break-words whitespace-pre-wrap mt-3">{c.mensaje}</p>
                  <p className="text-xs text-slate-400 mt-3">Enviado por {c.creadoPor.email}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal nuevo comunicado */}
      {modal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-blue-600" />
                <h2 className="font-bold text-slate-800">Nuevo comunicado</h2>
              </div>
              <button onClick={() => { setModal(false); reset(); }} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit(d => enviarMutation.mutate(d))} className="px-6 py-5 space-y-4">

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Destinatarios *</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${destinatario === 'TODOS' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <input type="radio" value="TODOS" {...register('destinatario', { required: 'Selecciona los destinatarios' })} className="text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-700 flex items-center gap-1"><Users className="w-4 h-4" /> Todos los padres</p>
                      <p className="text-xs text-slate-400">Envía a todos</p>
                    </div>
                  </label>
                  <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${destinatario === 'GRADO' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <input type="radio" value="GRADO" {...register('destinatario', { required: 'Selecciona los destinatarios' })} className="text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-700 flex items-center gap-1"><GraduationCap className="w-4 h-4" /> Por grado</p>
                      <p className="text-xs text-slate-400">Solo un grado</p>
                    </div>
                  </label>
                </div>
                {errors.destinatario && <p className="mt-1 text-xs text-red-500">{errors.destinatario.message}</p>}
              </div>

              {destinatario === 'GRADO' && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Grado *</label>
                  <select className={inputCls(errors.gradoId?.message)}
                    {...register('gradoId', { required: destinatario === 'GRADO' ? 'Selecciona el grado' : false })}>
                    <option value="">Seleccionar grado</option>
                    {(grados as { id: string; nombre: string; grupo: string }[]).map(g => (
                      <option key={g.id} value={g.id}>{g.nombre}{g.grupo}</option>
                    ))}
                  </select>
                  {errors.gradoId && <p className="mt-1 text-xs text-red-500">{errors.gradoId.message}</p>}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Asunto *</label>
                <input className={inputCls(errors.titulo?.message)} placeholder="Ej: Reunión de padres de familia"
                  maxLength={150}
                  {...register('titulo', { required: 'El asunto es requerido', maxLength: { value: 150, message: 'Máximo 150 caracteres' } })} />
                {errors.titulo && <p className="mt-1 text-xs text-red-500">{errors.titulo.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Mensaje *</label>
                <textarea rows={6} maxLength={2000}
                  className={`${inputCls(errors.mensaje?.message)} resize-none`}
                  placeholder="Escribe el comunicado aquí..."
                  {...register('mensaje', { required: 'El mensaje es requerido', minLength: { value: 10, message: 'Mínimo 10 caracteres' }, maxLength: { value: 2000, message: 'Máximo 2000 caracteres' } })} />
                <p className={`mt-1 text-xs text-right ${(watchMensaje?.length ?? 0) >= 2000 ? 'text-red-500' : 'text-slate-400'}`}>
                  {watchMensaje?.length ?? 0} / 2000
                </p>
                {errors.mensaje && <p className="mt-1 text-xs text-red-500">{errors.mensaje.message}</p>}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-xs text-amber-700">
                  <strong>Nota:</strong> El comunicado se enviará por correo electrónico a los padres seleccionados. Verifica el contenido antes de enviar.
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                <button type="button" onClick={() => { setModal(false); reset(); }} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
                <button type="submit" disabled={enviarMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
                  <Send className="w-4 h-4" />
                  {enviarMutation.isPending ? 'Enviando...' : 'Enviar comunicado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}