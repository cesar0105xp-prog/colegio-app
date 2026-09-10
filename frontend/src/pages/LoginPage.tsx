import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, GraduationCap, Lock, Mail, AlertCircle, X, CheckCircle, UserPlus } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/auth.store';
import { Rol } from '../types';

const GRADOS_DISPONIBLES = [
  'Prejardín', 'Jardín', 'Transición',
  'Primero', 'Segundo', 'Tercero', 'Cuarto', 'Quinto',
  'Sexto', 'Séptimo', 'Octavo', 'Noveno', 'Décimo', 'Once',
];

interface SolicitudCupoForm {
  nombreEstudiante: string;
  gradoInteres: string;
  nombreAcudiente: string;
  telefonoAcudiente: string;
  emailAcudiente: string;
}

function ModalSolicitarCupo({ onClose }: { onClose: () => void }) {
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<SolicitudCupoForm>();

  const inputCls = (err?: string) =>
    `w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${err ? 'border-red-400' : 'border-slate-200'}`;

  const onSubmit = async (data: SolicitudCupoForm) => {
    setError(null);
    setEnviando(true);
    try {
      await api.post('/solicitudes-cupo', data);
      setEnviado(true);
    } catch (err: unknown) {
      const d = (err as { response?: { data?: { mensaje?: string; errores?: string[] } } })?.response?.data;
      setError(d?.errores?.[0] ?? d?.mensaje ?? 'No se pudo enviar la solicitud. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-slate-800">Solicitar cupo</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>

        {enviado ? (
          <div className="px-6 py-10 text-center">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="font-bold text-slate-800">¡Solicitud enviada!</h3>
            <p className="text-sm text-slate-500 mt-2">Nos pondremos en contacto contigo pronto para continuar con el proceso de matrícula.</p>
            <button onClick={onClose} className="mt-6 w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition">
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Nombre del estudiante *</label>
              <input className={inputCls(errors.nombreEstudiante?.message)} placeholder="Nombre completo del niño/a"
                {...register('nombreEstudiante', { required: 'Requerido', minLength: { value: 2, message: 'Mínimo 2 caracteres' }, maxLength: { value: 100, message: 'Máximo 100 caracteres' } })} />
              {errors.nombreEstudiante && <p className="mt-1 text-xs text-red-500">{errors.nombreEstudiante.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Grado de interés *</label>
              <select className={inputCls(errors.gradoInteres?.message)} defaultValue=""
                {...register('gradoInteres', { required: 'Requerido' })}>
                <option value="" disabled>Selecciona un grado</option>
                {GRADOS_DISPONIBLES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              {errors.gradoInteres && <p className="mt-1 text-xs text-red-500">{errors.gradoInteres.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Nombre del acudiente *</label>
              <input className={inputCls(errors.nombreAcudiente?.message)} placeholder="Tu nombre completo"
                {...register('nombreAcudiente', { required: 'Requerido', minLength: { value: 2, message: 'Mínimo 2 caracteres' }, maxLength: { value: 100, message: 'Máximo 100 caracteres' } })} />
              {errors.nombreAcudiente && <p className="mt-1 text-xs text-red-500">{errors.nombreAcudiente.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Teléfono *</label>
              <input className={inputCls(errors.telefonoAcudiente?.message)} placeholder="Ej: 3001234567" maxLength={10}
                {...register('telefonoAcudiente', { required: 'Requerido', pattern: { value: /^[0-9]{7,10}$/, message: '7 a 10 dígitos' } })} />
              {errors.telefonoAcudiente && <p className="mt-1 text-xs text-red-500">{errors.telefonoAcudiente.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Correo electrónico *</label>
              <input type="email" className={inputCls(errors.emailAcudiente?.message)} placeholder="correo@ejemplo.com"
                {...register('emailAcudiente', { required: 'Requerido', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Correo inválido' } })} />
              {errors.emailAcudiente && <p className="mt-1 text-xs text-red-500">{errors.emailAcudiente.message}</p>}
            </div>
            <button type="submit" disabled={enviando}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
              <UserPlus className="w-4 h-4" /> {enviando ? 'Enviando...' : 'Enviar solicitud'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

interface LoginForm {
  email: string;
    password: string;
    }
    
const RUTA_POR_ROL: Record<Rol, string> = {
  ADMINISTRADOR: '/admin',
  SECRETARIO: '/secretario',
  PROFESOR: '/profesor',
  PADRE: '/padre',
  ESTUDIANTE: '/estudiante',
};

export default function LoginPage() {
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalCupo, setModalCupo] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setError(null);
    setCargando(true);

    try {
      const res = await api.post('/auth/login', data);
      const { accessToken, usuario } = res.data.datos;
      setAuth(usuario, accessToken);
      navigate(RUTA_POR_ROL[usuario.rol as Rol], { replace: true });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ??
        'Error al iniciar sesión';
      setError(msg);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      {/* Fondo decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl">
          {/* Logo / Icono */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-600/30">
              <GraduationCap className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Portal Escolar</h1>
            <p className="text-slate-400 text-sm mt-1">Ingresa con tus credenciales</p>
          </div>

          {/* Error global */}
          {error && (
            <div className="mb-5 flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="correo@ejemplo.com"
                  className={`w-full pl-10 pr-4 py-3 bg-white/5 border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                    errors.email ? 'border-red-500/60' : 'border-white/10 focus:border-blue-500'
                  }`}
                  {...register('email', {
                    required: 'El correo es requerido',
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Ingresa un correo electrónico válido',
                    },
                  })}
                />
              </div>
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={mostrarPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Tu contraseña"
                  className={`w-full pl-10 pr-12 py-3 bg-white/5 border rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                    errors.password ? 'border-red-500/60' : 'border-white/10 focus:border-blue-500'
                  }`}
                  {...register('password', {
                    required: 'La contraseña es requerida',
                    minLength: { value: 8, message: 'Mínimo 8 caracteres' },
                  })}
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                >
                  {mostrarPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-red-400">{errors.password.message}</p>
              )}
            </div>

            {/* Botón */}
            <button
              type="submit"
              disabled={cargando}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors shadow-lg shadow-blue-600/20 mt-2"
            >
              {cargando ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Iniciando sesión...
                </span>
              ) : (
                'Iniciar sesión'
              )}
            </button>
          </form>

          {/* Info de roles */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-slate-500 text-xs text-center">
              Acceso disponible para administradores, secretarios, profesores, padres y estudiantes
            </p>
          </div>

          {/* Solicitar cupo */}
          <div className="mt-4 text-center">
            <button type="button" onClick={() => setModalCupo(true)}
              className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors">
              ¿Quieres matricular a tu hijo/a? Solicita un cupo
            </button>
          </div>
        </div>
      </div>

      {modalCupo && <ModalSolicitarCupo onClose={() => setModalCupo(false)} />}
    </div>
  );
}
