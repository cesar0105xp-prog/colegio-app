import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/auth.store';
import { Rol } from './types';
import LoginPage from './pages/LoginPage';
// Cada panel se descarga solo cuando alguien entra a él: así el ingreso carga
// rápido en el celular en vez de bajar todo el portal de una vez.
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const ProfesorDashboard = lazy(() => import('./pages/profesor/ProfesorDashboard'));
const PadreDashboard = lazy(() => import('./pages/padre/PadreDashboard'));
const SecretarioDashboard = lazy(() => import('./pages/secretario/SecretarioDashboard'));
const AccesoMatricula = lazy(() => import('./pages/AccesoMatricula'));

function Cargando() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
}


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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<Cargando />}>
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
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}