import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, GraduationCap } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/auth.store';

export default function AccesoMatricula() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [estado, setEstado] = useState<'cargando' | 'error'>('cargando');
  const [mensaje, setMensaje] = useState('');
  const tokenSolicitado = useRef<string | null>(null);

  useEffect(() => {
    // El enlace es de un solo uso: evita que el doble-efecto de
    // React.StrictMode lo consuma dos veces para el mismo token, sin
    // bloquear una ejecución legítima si el token cambia. Se usa el propio
    // ref (en vez de una bandera de closure) para descartar resultados
    // obsoletos, porque el cleanup síncrono de StrictMode se dispara antes
    // de que la petición en curso resuelva.
    if (tokenSolicitado.current === token) return;
    tokenSolicitado.current = token ?? null;
    setEstado('cargando');

    (async () => {
      try {
        const res = await api.get(`/matriculas/acceso/${token}`);
        if (tokenSolicitado.current !== token) return;
        const { accessToken, usuario } = res.data.datos;
        setAuth(usuario, accessToken);
        navigate('/padre?seccion=matricula', { replace: true });
      } catch (e: unknown) {
        if (tokenSolicitado.current !== token) return;
        const err = e as { response?: { data?: { mensaje?: string } } };
        setMensaje(err.response?.data?.mensaje ?? 'No se pudo validar el enlace de acceso');
        setEstado('error');
      }
    })();
  }, [token, navigate, setAuth]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 w-full max-w-sm p-8 text-center">
        <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <GraduationCap className="w-7 h-7 text-blue-600" />
        </div>

        {estado === 'cargando' && (
          <>
            <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
            <h1 className="font-bold text-slate-800">Validando tu acceso...</h1>
            <p className="text-sm text-slate-500 mt-1">Espera un momento mientras verificamos el enlace</p>
          </>
        )}

        {estado === 'error' && (
          <>
            <XCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <h1 className="font-bold text-slate-800">No pudimos validar el enlace</h1>
            <p className="text-sm text-slate-500 mt-2">{mensaje}</p>
            <button
              onClick={() => navigate('/login')}
              className="mt-6 w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" /> Ir a inicio de sesión
            </button>
          </>
        )}
      </div>
    </div>
  );
}
