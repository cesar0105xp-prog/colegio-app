import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api',
  withCredentials: true, // necesario para enviar la cookie del refresh token
  // NO ponemos Content-Type aquí: Axios lo detecta automáticamente
  // (application/json para objetos, multipart/form-data para FormData)
});

// ─── INTERCEPTOR REQUEST: adjuntar access token ───────────────────────────────
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── INTERCEPTOR RESPONSE: renovar token automáticamente ─────────────────────
let refrescando = false;
let colaEspera: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      if (refrescando) {
        return new Promise((resolve) => {
          colaEspera.push((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }

      original._retry = true;
      refrescando = true;

      try {
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api'}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const nuevoToken = data.datos.accessToken;
        useAuthStore.getState().setAuth(useAuthStore.getState().usuario!, nuevoToken);

        colaEspera.forEach((cb) => cb(nuevoToken));
        colaEspera = [];

        original.headers.Authorization = `Bearer ${nuevoToken}`;
        return api(original);
      } catch {
        useAuthStore.getState().clearAuth();
        window.location.href = '/login';
        return Promise.reject(error);
      } finally {
        refrescando = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;