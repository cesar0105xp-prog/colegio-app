import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/auth.store';
import { Rol } from './types';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import ProfesorDashboard from './pages/profesor/ProfesorDashboard';
import PadreDashboard from './pages/padre/PadreDashboard';
import AccesoMatricula from './pages/AccesoMatricula';


const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 1000 * 60 * 5 } },
});

function RutaProtegida({ children, rolesPermitidos }: { children: React.ReactNode; rolesPermitidos: Rol[] }) {
  const { usuario } = useAuthStore();
  if (!usuario) return <Navigate to="/login" replace />;
  if (!rolesPermitidos.includes(usuario.rol)) return <Navigate to="/sin-acceso" replace />;
  return <>{children}</>;
}

function SinAcceso() {
  const { clearAuth } = useAuthStore();
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-4xl mb-4">🚫</p>
        <h1 className="text-xl font-bold text-slate-800">Sin acceso</h1>
        <p className="text-slate-500 mt-2">No tienes permisos para ver esta página</p>
        <button onClick={clearAuth} className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition">
          Volver al login
        </button>
      </div>
    </div>
  );
}

import SecretarioDashboard from './pages/secretario/SecretarioDashboard';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/sin-acceso" element={<SinAcceso />} />
          <Route path="/acceso-matricula/:token" element={<AccesoMatricula />} />

          <Route path="/admin" element={
            <RutaProtegida rolesPermitidos={['ADMINISTRADOR']}>
              <AdminDashboard />
            </RutaProtegida>
          } />

          <Route path="/secretario" element={
            <RutaProtegida rolesPermitidos={['SECRETARIO', 'ADMINISTRADOR']}>
              <SecretarioDashboard />
            </RutaProtegida>
          } />

          <Route path="/profesor" element={
            <RutaProtegida rolesPermitidos={['PROFESOR', 'ADMINISTRADOR']}>
              <ProfesorDashboard />
            </RutaProtegida>
          } />

          <Route path="/padre" element={
            <RutaProtegida rolesPermitidos={['PADRE']}>
              <PadreDashboard />
            </RutaProtegida>
          } />

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}