import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UsuarioAuth } from '../types';

interface AuthStore {
  usuario: UsuarioAuth | null;
  accessToken: string | null;
  setAuth: (usuario: UsuarioAuth, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      usuario: null,
      accessToken: null,
      setAuth: (usuario, accessToken) => set({ usuario, accessToken }),
      clearAuth: () => set({ usuario: null, accessToken: null }),
    }),
    {
      name: 'auth-colegio',
      // Solo persistir el usuario, no el token (el token viene del refresh)
      partialize: (state) => ({ usuario: state.usuario }),
    }
  )
);
