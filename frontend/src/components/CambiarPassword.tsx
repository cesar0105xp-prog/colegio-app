// ─── COMPONENTE REUTILIZABLE: Cambiar contraseña ─────────────────────────────
// Usar en todos los dashboards (profesor, padre, estudiante, admin)
// Importar y colocar en el sidebar debajo del botón de cerrar sesión

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { KeyRound, X, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import api from '../services/api';

type FormPass = { passwordActual: string; passwordNuevo: string; confirmar: string };

function Toast({ mensaje, tipo, onClose }: { mensaje: string; tipo: 'ok' | 'error'; onClose: () => void }) {
  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${tipo === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
      {tipo === 'ok' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {mensaje}
      <button onClick={onClose}><X className="w-4 h-4" /></button>
    </div>
  );
}

export function CambiarPassword({ onClose }: { onClose: () => void }) {
  const [mostrarActual, setMostrarActual] = useState(false);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormPass>();
  const passwordNuevo = watch('passwordNuevo');

  const mutation = useMutation({
    mutationFn: (d: { passwordActual: string; passwordNuevo: string }) => api.put('/auth/password', d),
    onSuccess: () => {
      setToast({ msg: 'Contraseña actualizada correctamente', tipo: 'ok' });
      reset();
      setTimeout(onClose, 1500);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? 'Error al cambiar la contraseña';
      setToast({ msg, tipo: 'error' });
    },
  });

  const inputCls = (err?: string) =>
    `w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white ${err ? 'border-red-400' : 'border-slate-200'}`;

  return (
    <>
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-blue-600" />
              <h2 className="font-bold text-slate-800">Cambiar contraseña</h2>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit(d => mutation.mutate({ passwordActual: d.passwordActual, passwordNuevo: d.passwordNuevo }))} className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Contraseña actual *</label>
              <div className="relative">
                <input type={mostrarActual ? 'text' : 'password'} className={inputCls(errors.passwordActual?.message)} placeholder="Tu contraseña actual"
                  {...register('passwordActual', { required: 'Requerida' })} />
                <button type="button" onClick={() => setMostrarActual(!mostrarActual)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {mostrarActual ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.passwordActual && <p className="mt-1 text-xs text-red-500">{errors.passwordActual.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Nueva contraseña *</label>
              <div className="relative">
                <input type={mostrarNuevo ? 'text' : 'password'} className={inputCls(errors.passwordNuevo?.message)} placeholder="Mín. 8 caracteres"
                  {...register('passwordNuevo', {
                    required: 'Requerida',
                    minLength: { value: 8, message: 'Mínimo 8 caracteres' },
                    pattern: { value: /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*\-_])/, message: 'Debe tener mayúscula, número y carácter especial' },
                  })} />
                <button type="button" onClick={() => setMostrarNuevo(!mostrarNuevo)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {mostrarNuevo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.passwordNuevo && <p className="mt-1 text-xs text-red-500">{errors.passwordNuevo.message}</p>}
              <p className="mt-1 text-xs text-slate-400">Debe tener mayúscula, número y símbolo (!@#$%...)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Confirmar nueva contraseña *</label>
              <input type="password" className={inputCls(errors.confirmar?.message)} placeholder="Repite la nueva contraseña"
                {...register('confirmar', {
                  required: 'Requerida',
                  validate: v => v === passwordNuevo || 'Las contraseñas no coinciden',
                })} />
              {errors.confirmar && <p className="mt-1 text-xs text-red-500">{errors.confirmar.message}</p>}
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancelar</button>
              <button type="submit" disabled={mutation.isPending} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
                {mutation.isPending ? 'Guardando...' : 'Actualizar contraseña'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}