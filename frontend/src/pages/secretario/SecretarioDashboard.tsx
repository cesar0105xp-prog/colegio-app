import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  LayoutDashboard, Users, GraduationCap, FileText,
  LogOut, Menu, Search, UserPlus,
  CheckCircle, AlertCircle, X, Edit2,
  Eye, KeyRound, BarChart2, CreditCard, ClipboardList, Calendar, Award
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { CambiarPassword } from '../../components/CambiarPassword';
import ReportesAdmin from '../../components/ReportesAdmin';
import Matriculas from '../../components/Matriculas';
import Pagos from '../../components/Pagos';
import GestionPermisos from '../../components/GestionPermisos';
import AgendaCalendario from '../../components/AgendaCalendario';
import GestionCertificados from '../../components/GestionCertificados';

type Seccion = 'resumen' | 'estudiantes' | 'padres' | 'reportes' | 'matriculas' | 'pagos' | 'permisos' | 'agenda' | 'certificados';

// ─── LÍMITES COLOMBIANOS ──────────────────────────────────────────────────────
const DOC_REGLAS: Record<string, { min: number; max: number; soloNumeros: boolean; placeholder: string }> = {
  RC:        { min: 8,  max: 11, soloNumeros: true,  placeholder: '8 a 11 dígitos' },
  TI:        { min: 10, max: 11, soloNumeros: true,  placeholder: '10 u 11 dígitos' },
  CC:        { min: 6,  max: 10, soloNumeros: true,  placeholder: '6 a 10 dígitos' },
  CE:        { min: 6,  max: 12, soloNumeros: true,  placeholder: '6 a 12 dígitos' },
  PASAPORTE: { min: 5,  max: 12, soloNumeros: false, placeholder: '5 a 12 caracteres' },
};

const soloNumerosKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (['Backspace','Delete','Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return;
  if (!/^\d$/.test(e.key)) e.preventDefault();
};
const soloLetrasKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (['Backspace','Delete','Tab','ArrowLeft','ArrowRight',' ','-',"'"].includes(e.key)) return;
  if (/^\d$/.test(e.key)) e.preventDefault();
};

// ─── UI HELPERS ───────────────────────────────────────────────────────────────
function Toast({ mensaje, tipo, onClose }: { mensaje: string; tipo: 'ok' | 'error'; onClose: () => void }) {
  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${tipo === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
      {tipo === 'ok' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {mensaje}
      <button onClick={onClose}><X className="w-4 h-4" /></button>
    </div>
  );
}

function Modal({ titulo, onClose, children, ancho = 'max-w-lg' }: { titulo: string; onClose: () => void; children: React.ReactNode; ancho?: string }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50">
      <div className={`bg-white rounded-2xl w-full ${ancho} shadow-2xl max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-slate-800">{titulo}</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function Campo({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1.5">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

const inputCls = (err?: string) =>
  `w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white ${err ? 'border-red-400' : 'border-slate-200'}`;

function Badge({ texto, color }: { texto: string; color: string }) {
  return <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${color}`}>{texto}</span>;
}

// ─── RESUMEN SECRETARIO ───────────────────────────────────────────────────────
function ResumenSecretario({ setSeccion }: { setSeccion: (s: Seccion) => void }) {
  const { data } = useQuery({ queryKey: ['stats'], queryFn: async () => (await api.get('/stats')).data.datos });

  const stats = [
    { label: 'Estudiantes activos', valor: data?.totalEstudiantes ?? '--', icono: GraduationCap, color: 'bg-blue-500', seccion: 'estudiantes' as Seccion },
    { label: 'Padres registrados',  valor: data?.totalPadres      ?? '--', icono: Users,          color: 'bg-violet-500', seccion: 'padres' as Seccion },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        {stats.map(s => (
          <button key={s.label} onClick={() => setSeccion(s.seccion)}
            className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow text-left">
            <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center mb-3`}><s.icono className="w-5 h-5 text-white" /></div>
            <p className="text-3xl font-bold text-slate-800">{s.valor}</p>
            <p className="text-sm text-slate-500 mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>
      {data?.periodoActivo ? (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
          <p className="text-blue-200 text-sm mb-1">Período académico activo</p>
          <h2 className="text-2xl font-bold">{data.periodoActivo.nombre} — {data.periodoActivo.anio}</h2>
          <p className="text-blue-200 text-sm mt-1">
            {new Date(data.periodoActivo.fechaInicio).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', timeZone: 'UTC' })} —{' '}
            {new Date(data.periodoActivo.fechaFin).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
          </p>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700">No hay ningún período activo.</p>
        </div>
      )}
    </div>
  );
}

// ─── ESTUDIANTES (secretario: crear y editar, no eliminar) ────────────────────
type EstRow = { id: string; nombres: string; apellidos: string; tipoDocumento: string; numeroDocumento: string; fechaNacimiento: string; genero: string; grado: { id: string; nombre: string; grupo: string; nivel: string }; estado: string; direccion?: string; telefono?: string; gradoId: string };
type EstForm = { nombres: string; apellidos: string; tipoDocumento: string; numeroDocumento: string; fechaNacimiento: string; genero: string; gradoId: string; direccion?: string; telefono?: string; estado?: string };

function EstudiantesSecretario() {
  const qc = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [filtroGrado, setFiltroGrado] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState<EstRow | null>(null);
  const [modalVer, setModalVer] = useState<EstRow | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);

  const { data: gradosData } = useQuery({ queryKey: ['grados'], queryFn: async () => (await api.get('/grados')).data.datos ?? [] });
  const { data, isLoading } = useQuery({
    queryKey: ['estudiantes', busqueda, filtroGrado, filtroEstado],
    queryFn: async () => (await api.get('/estudiantes', { params: { busqueda: busqueda || undefined, gradoId: filtroGrado || undefined, estado: filtroEstado || undefined } })).data,
    staleTime: 0,
  });

  const { register: regC, handleSubmit: hC, watch: wC, formState: { errors: eC } } = useForm<EstForm>();
  const { register: regE, handleSubmit: hE, watch: wE, formState: { errors: eE } } = useForm<EstForm>();


  const crearMutation = useMutation({
    mutationFn: (d: unknown) => api.post('/estudiantes', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['estudiantes'] }); qc.invalidateQueries({ queryKey: ['stats'] }); setModalCrear(false); setToast({ msg: 'Estudiante registrado', tipo: 'ok' }); },
    onError: (e: unknown) => { const d = (e as { response?: { data?: { mensaje?: string; errores?: string[] } } })?.response?.data; setToast({ msg: d?.errores?.[0] ?? d?.mensaje ?? 'Error', tipo: 'error' }); },
  });

  const editarMutation = useMutation({
    mutationFn: ({ id, ...d }: EstForm & { id: string }) => api.put(`/estudiantes/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['estudiantes'] }); setModalEditar(null); setToast({ msg: 'Estudiante actualizado', tipo: 'ok' }); },
    onError: (e: unknown) => { const d = (e as { response?: { data?: { mensaje?: string; errores?: string[] } } })?.response?.data; setToast({ msg: d?.errores?.[0] ?? d?.mensaje ?? 'Error', tipo: 'error' }); },
  });

  const ESTADO_COLOR: Record<string, string> = { ACTIVO: 'bg-emerald-50 text-emerald-700', INACTIVO: 'bg-slate-100 text-slate-500', RETIRADO: 'bg-red-50 text-red-600', GRADUADO: 'bg-blue-50 text-blue-700' };

  const FormEst = ({ reg, errors: errs, watch: w, gradosData: grados, onSubmit, cargando, onCancel, modoEditar = false }: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reg: any; errors: Record<string, { message?: string }>; watch: any; gradosData: { id: string; nombre: string; grupo: string; nivel: string }[];
    onSubmit: () => void; cargando: boolean; onCancel: () => void; modoEditar?: boolean;
  }) => {
    const tipoDoc = w('tipoDocumento');
    const regla = DOC_REGLAS[tipoDoc] ?? { min: 5, max: 12, soloNumeros: false, placeholder: 'Número de documento' };
    return (
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Nombres *" error={errs.nombres?.message} hint="Solo letras">
            <input className={inputCls(errs.nombres?.message)} placeholder="Ej: María Fernanda" maxLength={50} onKeyDown={soloLetrasKeyDown}
              {...reg('nombres', { required: 'Requerido', minLength: { value: 2, message: 'Mínimo 2' }, maxLength: { value: 50, message: 'Máximo 50' }, pattern: { value: /^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s\-']+$/, message: 'Solo letras' } })} />
          </Campo>
          <Campo label="Apellidos *" error={errs.apellidos?.message} hint="Solo letras">
            <input className={inputCls(errs.apellidos?.message)} placeholder="Ej: García Rodríguez" maxLength={50} onKeyDown={soloLetrasKeyDown}
              {...reg('apellidos', { required: 'Requerido', minLength: { value: 2, message: 'Mínimo 2' }, maxLength: { value: 50, message: 'Máximo 50' }, pattern: { value: /^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s\-']+$/, message: 'Solo letras' } })} />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Tipo de documento *" error={errs.tipoDocumento?.message}>
            <select className={inputCls(errs.tipoDocumento?.message)} {...reg('tipoDocumento', { required: 'Requerido' })}>
              <option value="">Seleccionar</option>
              <option value="RC">RC — Registro Civil</option>
              <option value="TI">TI — Tarjeta de Identidad</option>
              <option value="CC">CC — Cédula de Ciudadanía</option>
              <option value="CE">CE — Cédula de Extranjería</option>
              <option value="PASAPORTE">Pasaporte</option>
            </select>
          </Campo>
          <Campo label="Número de documento *" error={errs.numeroDocumento?.message} hint={tipoDoc ? regla.placeholder : 'Selecciona el tipo'}>
            <input className={inputCls(errs.numeroDocumento?.message)} placeholder={tipoDoc ? regla.placeholder : '—'}
              maxLength={regla.max} disabled={!tipoDoc} onKeyDown={regla.soloNumeros ? soloNumerosKeyDown : undefined}
              {...reg('numeroDocumento', { required: 'Requerido', minLength: { value: regla.min, message: `Mínimo ${regla.min}` }, maxLength: { value: regla.max, message: `Máximo ${regla.max}` }, pattern: regla.soloNumeros ? { value: /^\d+$/, message: 'Solo dígitos' } : undefined })} />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Fecha de nacimiento *" error={errs.fechaNacimiento?.message}>
            <input type="date" className={inputCls(errs.fechaNacimiento?.message)} max={new Date().toISOString().split('T')[0]}
              {...reg('fechaNacimiento', { required: 'Requerido' })} />
          </Campo>
          <Campo label="Género *" error={errs.genero?.message}>
            <select className={inputCls(errs.genero?.message)} {...reg('genero', { required: 'Requerido' })}>
              <option value="">Seleccionar</option>
              <option value="MASCULINO">Masculino</option>
              <option value="FEMENINO">Femenino</option>
              <option value="OTRO">Otro</option>
            </select>
          </Campo>
        </div>
        <Campo label="Grado *" error={errs.gradoId?.message}>
          <select className={inputCls(errs.gradoId?.message)} {...reg('gradoId', { required: 'Requerido' })}>
            <option value="">Seleccionar grado</option>
            {grados.map((g: { id: string; nombre: string; grupo: string; nivel: string }) => <option key={g.id} value={g.id}>{g.nombre}{g.grupo} — {g.nivel}</option>)}
          </select>
        </Campo>
        {modoEditar && (
          <Campo label="Estado">
            <select className={inputCls()} {...reg('estado')}>
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
              <option value="RETIRADO">Retirado</option>
              <option value="GRADUADO">Graduado</option>
            </select>
          </Campo>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Dirección (opcional)" error={errs.direccion?.message}>
            <input className={inputCls(errs.direccion?.message)} placeholder="Ej: Calle 45 # 23-10" maxLength={150}
              {...reg('direccion', { minLength: { value: 5, message: 'Mínimo 5' }, maxLength: { value: 150, message: 'Máximo 150' } })} />
          </Campo>
          <Campo label="Teléfono (opcional)" error={errs.telefono?.message} hint="7 a 10 dígitos">
            <input className={inputCls(errs.telefono?.message)} placeholder="Ej: 3001234567" maxLength={10} onKeyDown={soloNumerosKeyDown}
              {...reg('telefono', { pattern: { value: /^[0-9]{7,10}$/, message: 'Entre 7 y 10 dígitos' } })} />
          </Campo>
        </div>
        <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
          <button type="submit" disabled={cargando} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
            {cargando ? 'Guardando...' : modoEditar ? 'Guardar cambios' : 'Registrar estudiante'}
          </button>
        </div>
      </form>
    );
  };

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre o documento..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filtroGrado} onChange={e => setFiltroGrado(e.target.value)} className="py-2.5 px-3 border border-slate-200 rounded-xl text-sm bg-white">
          <option value="">Todos los grados</option>
          {(gradosData ?? []).map((g: { id: string; nombre: string; grupo: string }) => <option key={g.id} value={g.id}>{g.nombre}{g.grupo}</option>)}
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} className="py-2.5 px-3 border border-slate-200 rounded-xl text-sm bg-white">
          <option value="">Todos los estados</option>
          <option value="ACTIVO">Activo</option>
          <option value="INACTIVO">Inactivo</option>
        </select>
        <button onClick={() => setModalCrear(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
          <UserPlus className="w-4 h-4" /> Nuevo estudiante
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
        : (data?.datos ?? []).length === 0 ? (
          <div className="text-center py-12 text-slate-400"><GraduationCap className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No hay estudiantes</p></div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{['Estudiante','Documento','Grado','Estado',''].map(h => <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(data?.datos ?? []).map((e: EstRow) => (
                <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-700 text-xs font-bold">{e.nombres[0]}{e.apellidos[0]}</div>
                      <span className="text-sm font-medium text-slate-800">{e.nombres} {e.apellidos}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-500">{e.tipoDocumento} {e.numeroDocumento}</td>
                  <td className="px-5 py-3"><Badge texto={`${e.grado.nombre}${e.grado.grupo}`} color="bg-blue-50 text-blue-700" /></td>
                  <td className="px-5 py-3"><Badge texto={e.estado} color={ESTADO_COLOR[e.estado] ?? 'bg-slate-100'} /></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setModalVer(e)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => setModalEditar(e)} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"><Edit2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data?.meta && <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">{data.meta.total} estudiante(s)</div>}
      </div>

      {modalCrear && (
        <Modal titulo="Registrar estudiante" onClose={() => setModalCrear(false)}>
          <FormEst reg={regC} errors={eC} watch={wC} gradosData={gradosData ?? []} onSubmit={hC(d => crearMutation.mutate(d))} cargando={crearMutation.isPending} onCancel={() => setModalCrear(false)} />
        </Modal>
      )}

      {modalEditar && (
        <Modal titulo="Editar estudiante" onClose={() => setModalEditar(null)}>
          <FormEst reg={regE} errors={eE} watch={wE} gradosData={gradosData ?? []} modoEditar
            onSubmit={hE(d => editarMutation.mutate({ ...d, id: modalEditar.id }))}
            cargando={editarMutation.isPending} onCancel={() => setModalEditar(null)} />
        </Modal>
      )}

      {modalVer && (
        <Modal titulo="Detalle del estudiante" onClose={() => setModalVer(null)}>
          <div className="space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-700 text-xl font-bold">{modalVer.nombres[0]}{modalVer.apellidos[0]}</div>
              <div>
                <h3 className="font-bold text-slate-800 text-lg">{modalVer.nombres} {modalVer.apellidos}</h3>
                <Badge texto={modalVer.estado} color={ESTADO_COLOR[modalVer.estado] ?? ''} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Documento', `${modalVer.tipoDocumento} ${modalVer.numeroDocumento}`],
                ['Grado', `${modalVer.grado.nombre}${modalVer.grado.grupo}`],
                ['Fecha de nacimiento', new Date(modalVer.fechaNacimiento).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })],
                ['Género', modalVer.genero],
                ['Teléfono', modalVer.telefono ?? '—'],
                ['Dirección', modalVer.direccion ?? '—'],
              ].map(([k, v]) => (
                <div key={k} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-0.5">{k}</p>
                  <p className="font-medium text-slate-700">{v}</p>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setModalVer(null); setModalEditar(modalVer); }} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition"><Edit2 className="w-4 h-4" /> Editar</button>
              <button onClick={() => setModalVer(null)} className="px-4 py-2 text-sm text-slate-600">Cerrar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── PADRES/ACUDIENTES ────────────────────────────────────────────────────────
function PadresSecretario() {
  const [filtro, setFiltro] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['usuarios-padres', filtro],
    queryFn: async () => (await api.get('/usuarios', { params: { rol: 'PADRE' } })).data.datos ?? [],
  });

  type PadreRow = { id: string; email: string; estado: string; perfil: { nombres: string; apellidos: string; numeroDocumento: string; telefono?: string } | null };

  const filtrados = (data ?? []).filter((p: PadreRow) =>
    !filtro || `${p.perfil?.nombres} ${p.perfil?.apellidos} ${p.perfil?.numeroDocumento} ${p.email}`.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Buscar padre o acudiente..."
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
        : filtrados.length === 0 ? (
          <div className="text-center py-12 text-slate-400"><Users className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No hay padres registrados</p></div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{['Padre/Acudiente','Documento','Teléfono','Estado'].map(h => <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtrados.map((p: PadreRow) => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-slate-800">{p.perfil ? `${p.perfil.nombres} ${p.perfil.apellidos}` : '—'}</p>
                    <p className="text-xs text-slate-400">{p.email}</p>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-500">{p.perfil?.numeroDocumento ?? '—'}</td>
                  <td className="px-5 py-3 text-sm text-slate-500">{p.perfil?.telefono ?? '—'}</td>
                  <td className="px-5 py-3"><Badge texto={p.estado} color={p.estado === 'ACTIVO' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── NAV Y DASHBOARD PRINCIPAL ────────────────────────────────────────────────
const NAV = [
  { id: 'resumen',      label: 'Resumen',      icono: LayoutDashboard },
  { id: 'matriculas',   label: 'Matrículas',   icono: FileText },
  { id: 'estudiantes',  label: 'Estudiantes',  icono: GraduationCap },
  { id: 'padres',       label: 'Padres',        icono: Users },
  { id: 'pagos',        label: 'Pagos y cartera', icono: CreditCard },
  { id: 'permisos',     label: 'Permisos',       icono: ClipboardList },
  { id: 'agenda',       label: 'Agenda escolar', icono: Calendar },
  { id: 'certificados', label: 'Certificados',   icono: Award },
  { id: 'reportes',     label: 'Reportes',      icono: BarChart2 },
] as const;

const TITULOS: Record<Seccion, string> = {
  resumen: 'Resumen', estudiantes: 'Gestión de estudiantes',
  padres: 'Padres y acudientes', reportes: 'Reportes',
  matriculas: 'Matrículas', pagos: 'Pagos y cartera',
  permisos: 'Permisos y ausencias', agenda: 'Agenda escolar digital',
  certificados: 'Certificados desde el portal',
};

export default function SecretarioDashboard() {
  const [seccion, setSeccion] = useState<Seccion>('resumen');
  const [sidebar, setSidebar] = useState(false);
  const [modalPassword, setModalPassword] = useState(false);
  const { usuario, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const handleLogout = async () => { try { await api.post('/auth/logout'); } catch {} clearAuth(); navigate('/login'); };

  const renderSeccion = () => {
    switch (seccion) {
      case 'resumen':     return <ResumenSecretario setSeccion={setSeccion} />;
      case 'matriculas':  return <Matriculas />;
      case 'estudiantes': return <EstudiantesSecretario />;
      case 'padres':      return <PadresSecretario />;
      case 'pagos':       return <Pagos />;
      case 'permisos':    return <GestionPermisos />;
      case 'agenda':      return <AgendaCalendario />;
      case 'certificados': return <GestionCertificados />;
      case 'reportes':    return <ReportesAdmin />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {sidebar && <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebar(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 flex flex-col overflow-hidden transition-transform duration-200 ${sidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center"><GraduationCap className="w-5 h-5 text-white" /></div>
            <div><p className="text-white font-bold text-sm">Portal Escolar</p><p className="text-slate-400 text-xs">Secretario/a</p></div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-none">
          {NAV.map(item => (
            <button key={item.id} onClick={() => { setSeccion(item.id); setSidebar(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${seccion === item.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              <item.icono className="w-4 h-4 flex-shrink-0" />{item.label}
            </button>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">{usuario?.email[0].toUpperCase()}</div>
            <div className="flex-1 min-w-0"><p className="text-white text-xs font-medium truncate">{usuario?.email}</p><p className="text-slate-400 text-xs">Secretario/a</p></div>
          </div>
          <button onClick={() => setModalPassword(true)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <KeyRound className="w-4 h-4" /> Cambiar contraseña
          </button>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
          <button onClick={() => setSidebar(true)} className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100"><Menu className="w-5 h-5" /></button>
          <h1 className="font-bold text-slate-800 flex-1">{TITULOS[seccion]}</h1>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto">{renderSeccion()}</main>
      </div>
      {modalPassword && <CambiarPassword onClose={() => setModalPassword(false)} />}
    </div>
  );
}