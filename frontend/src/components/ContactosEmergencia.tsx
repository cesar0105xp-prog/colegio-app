import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Phone, Plus, Edit2, Trash2, AlertCircle, CheckCircle, X, Shield } from 'lucide-react';
import api from '../services/api';

// helpers de teclado
const soloLetrasKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (['Backspace','Delete','Tab','ArrowLeft','ArrowRight',' ','-',"'"].includes(e.key)) return;
  if (/^\d$/.test(e.key)) e.preventDefault();
};
const soloNumerosKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (['Backspace','Delete','Tab','ArrowLeft','ArrowRight'].includes(e.key)) return;
  if (!/^\d$/.test(e.key)) e.preventDefault();
};

const PARENTESCOS = ['padre','madre','acudiente','abuelo','abuela','tio','tia','hermano','hermana','otro'];
const LABEL_PARENTESCO: Record<string, string> = {
  padre:'Padre', madre:'Madre', acudiente:'Acudiente', abuelo:'Abuelo',
  abuela:'Abuela', tio:'Tío', tia:'Tía', hermano:'Hermano', hermana:'Hermana', otro:'Otro'
};
const COLOR_ORDEN = ['bg-blue-600','bg-violet-600','bg-emerald-600'];

type Contacto = { id: string; nombres: string; apellidos: string; parentesco: string; telefono: string; telefono2?: string; orden: number };
type FormContacto = { nombres: string; apellidos: string; parentesco: string; telefono: string; telefono2?: string; orden: number };

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
  `w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${err ? 'border-red-400' : 'border-slate-200'}`;

export default function ContactosEmergencia({ estudianteId, soloLectura = false }: { estudianteId: string; soloLectura?: boolean }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Contacto | null>(null);
  const [eliminando, setEliminando] = useState<Contacto | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);

  const { data: contactos = [], isLoading } = useQuery({
    queryKey: ['contactos', estudianteId],
    queryFn: async () => (await api.get(`/estudiantes/${estudianteId}/contactos`)).data.datos ?? [],
    enabled: !!estudianteId,
    staleTime: 0,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormContacto>();
  const { register: regE, handleSubmit: hE, reset: resetE, formState: { errors: eE } } = useForm<FormContacto>();

  React.useEffect(() => {
    if (editando) {
      resetE({
        nombres: editando.nombres,
        apellidos: editando.apellidos,
        parentesco: editando.parentesco,
        telefono: editando.telefono,
        telefono2: editando.telefono2 ?? '',
        orden: editando.orden,
      });
    }
  }, [editando]);

  const crearMutation = useMutation({
    mutationFn: (d: FormContacto) => api.post(`/estudiantes/${estudianteId}/contactos`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contactos', estudianteId] }); setModal(false); reset(); setToast({ msg: 'Contacto agregado', tipo: 'ok' }); },
    onError: (e: unknown) => { const d = (e as { response?: { data?: { mensaje?: string; errores?: string[] } } })?.response?.data; setToast({ msg: d?.errores?.[0] ?? d?.mensaje ?? 'Error', tipo: 'error' }); },
  });

  const editarMutation = useMutation({
    mutationFn: ({ id, ...d }: FormContacto & { id: string }) => api.put(`/contactos/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contactos', estudianteId] }); setEditando(null); setToast({ msg: 'Contacto actualizado', tipo: 'ok' }); },
    onError: (e: unknown) => { const d = (e as { response?: { data?: { mensaje?: string } } })?.response?.data; setToast({ msg: d?.mensaje ?? 'Error', tipo: 'error' }); },
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/contactos/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contactos', estudianteId] }); setEliminando(null); setToast({ msg: 'Contacto eliminado', tipo: 'ok' }); },
    onError: () => setToast({ msg: 'Error al eliminar', tipo: 'error' }),
  });

  const formularioContacto = (reg: typeof register, errs: typeof errors, onSubmit: () => void, cargando: boolean, onCancel: () => void, titulo: string) => (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">{titulo}</h3>
          <button onClick={onCancel} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={onSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Nombres * <span className="text-slate-300">(solo letras)</span></label>
              <input className={inputCls(errs.nombres?.message)} placeholder="Ej: Carlos Alberto" maxLength={50} onKeyDown={soloLetrasKeyDown}
                {...reg('nombres', { required: 'Requerido', minLength: { value: 2, message: 'Mínimo 2' }, maxLength: { value: 50, message: 'Máximo 50' }, pattern: { value: /^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s\-']+$/, message: 'Solo letras' } })} />
              {errs.nombres && <p className="mt-1 text-xs text-red-500">{errs.nombres.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Apellidos * <span className="text-slate-300">(solo letras)</span></label>
              <input className={inputCls(errs.apellidos?.message)} placeholder="Ej: García López" maxLength={50} onKeyDown={soloLetrasKeyDown}
                {...reg('apellidos', { required: 'Requerido', minLength: { value: 2, message: 'Mínimo 2' }, maxLength: { value: 50, message: 'Máximo 50' }, pattern: { value: /^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s\-']+$/, message: 'Solo letras' } })} />
              {errs.apellidos && <p className="mt-1 text-xs text-red-500">{errs.apellidos.message}</p>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Parentesco *</label>
            <select className={inputCls(errs.parentesco?.message)} {...reg('parentesco', { required: 'Selecciona el parentesco' })}>
              <option value="">Seleccionar</option>
              {PARENTESCOS.map(p => <option key={p} value={p}>{LABEL_PARENTESCO[p]}</option>)}
            </select>
            {errs.parentesco && <p className="mt-1 text-xs text-red-500">{errs.parentesco.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Teléfono principal * <span className="text-slate-300">(7-10 dígitos)</span></label>
              <input className={inputCls(errs.telefono?.message)} placeholder="Ej: 3001234567" maxLength={10} onKeyDown={soloNumerosKeyDown}
                {...reg('telefono', { required: 'Requerido', pattern: { value: /^[0-9]{7,10}$/, message: '7 a 10 dígitos' } })} />
              {errs.telefono && <p className="mt-1 text-xs text-red-500">{errs.telefono.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Teléfono alternativo <span className="text-slate-300">(opcional)</span></label>
              <input className={inputCls(errs.telefono2?.message)} placeholder="Ej: 6011234567" maxLength={10} onKeyDown={soloNumerosKeyDown}
                {...reg('telefono2', { pattern: { value: /^[0-9]{7,10}$/, message: '7 a 10 dígitos' } })} />
              {errs.telefono2 && <p className="mt-1 text-xs text-red-500">{errs.telefono2.message}</p>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Prioridad de contacto *</label>
            <select className={inputCls(errs.orden?.message)} {...reg('orden', { required: 'Selecciona la prioridad', valueAsNumber: true })}>
              <option value="">Seleccionar</option>
              <option value={1}>1° — Contacto principal</option>
              <option value={2}>2° — Segundo contacto</option>
              <option value={3}>3° — Tercer contacto</option>
            </select>
            {errs.orden && <p className="mt-1 text-xs text-red-500">{errs.orden.message}</p>}
          </div>
          <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
            <button type="submit" disabled={cargando} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
              {cargando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-600" />
          <p className="text-sm font-semibold text-slate-700">Contactos de emergencia ({(contactos as Contacto[]).length}/3)</p>
        </div>
        {!soloLectura && (contactos as Contacto[]).length < 3 && (
          <button onClick={() => setModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-xl hover:bg-blue-700 transition">
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-16"><div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
      ) : (contactos as Contacto[]).length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-700">No hay contactos de emergencia registrados. Por favor agrega al menos uno.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(contactos as Contacto[]).map(c => (
            <div key={c.id} className="bg-white border border-slate-100 rounded-xl p-4 flex items-center gap-3 shadow-sm">
              <div className={`w-8 h-8 ${COLOR_ORDEN[c.orden - 1]} rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                {c.orden}°
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{c.nombres} {c.apellidos}</p>
                <p className="text-xs text-slate-500">{LABEL_PARENTESCO[c.parentesco]}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-blue-600 flex items-center gap-1"><Phone className="w-3 h-3" /> {c.telefono}</span>
                  {c.telefono2 && <span className="text-xs text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" /> {c.telefono2}</span>}
                </div>
              </div>
              {!soloLectura && (
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => setEditando(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setEliminando(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && formularioContacto(register, errors, handleSubmit(d => crearMutation.mutate(d)), crearMutation.isPending, () => { setModal(false); reset(); }, 'Nuevo contacto de emergencia')}
      {editando && formularioContacto(regE, eE, hE(d => editarMutation.mutate({ ...d, id: editando.id })), editarMutation.isPending, () => setEditando(null), 'Editar contacto de emergencia')}

      {eliminando && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <p className="text-sm text-red-700">¿Eliminar el contacto <strong>{eliminando.nombres} {eliminando.apellidos}</strong>?</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEliminando(null)} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
              <button onClick={() => eliminarMutation.mutate(eliminando.id)} disabled={eliminarMutation.isPending}
                className="px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition disabled:opacity-50">
                {eliminarMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}