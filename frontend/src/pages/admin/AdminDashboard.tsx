import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, Calendar,
  FileText, Shield, LogOut, Menu, Search, UserPlus, Plus,
  CheckCircle, AlertCircle, AlertTriangle, X, Layers, RefreshCw, Edit2,
  Eye, Trash2, BookMarked, BarChart2, MessageSquare, UserCheck, Clock, FileSpreadsheet,
  Mail, Phone, CreditCard, BookOpen as Book, KeyRound
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import ReportesAdmin from '../../components/ReportesAdmin';
import Comunicados from '../../components/Comunicados';
import { CambiarPassword } from '../../components/CambiarPassword';
import ContactosEmergencia from '../../components/ContactosEmergencia';
import Pagos from '../../components/Pagos';
import PeriodosAcademicos from '../../components/PeriodosAcademicos';

type Seccion = 'resumen' | 'estudiantes' | 'usuarios' | 'vinculos' | 'grados' | 'materias' | 'periodos' | 'reportes' | 'auditoria' | 'directorio' | 'comunicados' | 'documentos' | 'pagos';

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

async function descargarExcel(
  endpoint: string,
  params: Record<string, string>,
  setToast: (t: { msg: string; tipo: 'ok' | 'error' } | null) => void,
) {
  try {
    const res = await api.get(endpoint, { params, responseType: 'blob' });
    const nombreArchivo = res.headers['content-disposition']?.match(/filename="(.+)"/)?.[1] ?? 'notas.xlsx';
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = nombreArchivo;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch {
    setToast({ msg: 'Error al exportar el archivo. Verifica que haya notas registradas.', tipo: 'error' });
  }
}

function BotonesForm({ onCancel, cargando, labelGuardar = 'Guardar cambios' }: { onCancel: () => void; cargando: boolean; labelGuardar?: string }) {
  return (
    <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
      <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition">Cancelar</button>
      <button type="submit" disabled={cargando} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
        {cargando ? 'Guardando...' : labelGuardar}
      </button>
    </div>
  );
}

function Badge({ texto, color }: { texto: string; color: string }) {
  return <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${color}`}>{texto}</span>;
}

type AlertaAsistencia = { estudianteId: string; nombres: string; apellidos: string; grado: string; ausenciasSinJustificar: number };

function Resumen({ setSeccion }: { setSeccion: (s: Seccion) => void }) {
  const { data } = useQuery({ queryKey: ['stats'], queryFn: async () => (await api.get('/stats')).data.datos });
  const { data: alertasAsistencia = [] } = useQuery({
    queryKey: ['asistencia-alertas'],
    queryFn: async () => (await api.get('/asistencia/alertas')).data.datos ?? [],
  });
  const stats = [
    { label: 'Estudiantes activos', valor: data?.totalEstudiantes ?? '--', icono: GraduationCap, color: 'bg-blue-500', seccion: 'estudiantes' as Seccion },
    { label: 'Profesores',          valor: data?.totalProfesores  ?? '--', icono: Users,          color: 'bg-emerald-500', seccion: 'usuarios' as Seccion },
    { label: 'Padres registrados',  valor: data?.totalPadres      ?? '--', icono: Users,          color: 'bg-violet-500', seccion: 'usuarios' as Seccion },
    { label: 'Grados activos',      valor: data?.totalGrados      ?? '--', icono: Layers,         color: 'bg-amber-500', seccion: 'grados' as Seccion },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
          <p className="text-sm text-amber-700">No hay ningún período activo. Ve a <strong>Períodos</strong> para activar uno.</p>
        </div>
      )}

      {(alertasAsistencia as AlertaAsistencia[]).length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-red-700">Estudiantes con 3 o más ausencias sin justificar este mes</p>
          </div>
          <div className="space-y-1.5">
            {(alertasAsistencia as AlertaAsistencia[]).map(a => (
              <div key={a.estudianteId} className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5">
                <span className="text-sm text-slate-700">{a.nombres} {a.apellidos} <span className="text-slate-400">· {a.grado}</span></span>
                <span className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-lg font-medium">{a.ausenciasSinJustificar} ausencias</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type EstForm = { nombres: string; apellidos: string; tipoDocumento: string; numeroDocumento: string; fechaNacimiento: string; genero: string; gradoId: string; direccion?: string; telefono?: string; estado?: string };

function FormEstudiante({ inicial, gradosData, onSubmit, cargando, onCancel, modoEditar = false }: {
  inicial?: Partial<EstForm>; gradosData: { id: string; nombre: string; grupo: string; nivel: string }[];
  onSubmit: (d: EstForm) => void; cargando: boolean; onCancel: () => void; modoEditar?: boolean;
}) {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<EstForm>({ defaultValues: inicial });
  const tipoDoc = watch('tipoDocumento');
  const reglaDoc = DOC_REGLAS[tipoDoc] ?? { min: 5, max: 12, soloNumeros: false, placeholder: 'Número de documento' };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Nombres *" error={errors.nombres?.message} hint="Solo letras y espacios">
          <input className={inputCls(errors.nombres?.message)} placeholder="Ej: María Fernanda"
            maxLength={50} onKeyDown={soloLetrasKeyDown}
            {...register('nombres', { required: 'Requerido', minLength: { value: 2, message: 'Mínimo 2 caracteres' }, maxLength: { value: 50, message: 'Máximo 50 caracteres' }, pattern: { value: /^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s\-']+$/, message: 'Solo letras y espacios' } })} />
        </Campo>
        <Campo label="Apellidos *" error={errors.apellidos?.message} hint="Solo letras y espacios">
          <input className={inputCls(errors.apellidos?.message)} placeholder="Ej: García Rodríguez"
            maxLength={50} onKeyDown={soloLetrasKeyDown}
            {...register('apellidos', { required: 'Requerido', minLength: { value: 2, message: 'Mínimo 2 caracteres' }, maxLength: { value: 50, message: 'Máximo 50 caracteres' }, pattern: { value: /^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s\-']+$/, message: 'Solo letras y espacios' } })} />
        </Campo>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Tipo de documento *" error={errors.tipoDocumento?.message}>
          <select className={inputCls(errors.tipoDocumento?.message)} {...register('tipoDocumento', { required: 'Requerido' })}>
            <option value="">Seleccionar</option>
            <option value="RC">RC — Registro Civil</option>
            <option value="TI">TI — Tarjeta de Identidad</option>
            <option value="CC">CC — Cédula de Ciudadanía</option>
            <option value="CE">CE — Cédula de Extranjería</option>
            <option value="PASAPORTE">Pasaporte</option>
          </select>
        </Campo>
        <Campo label="Número de documento *" error={errors.numeroDocumento?.message} hint={tipoDoc ? reglaDoc.placeholder : 'Selecciona el tipo primero'}>
          <input className={inputCls(errors.numeroDocumento?.message)}
            placeholder={tipoDoc ? reglaDoc.placeholder : '—'}
            maxLength={reglaDoc.max} disabled={!tipoDoc}
            onKeyDown={reglaDoc.soloNumeros ? soloNumerosKeyDown : undefined}
            {...register('numeroDocumento', { required: 'Requerido', minLength: { value: reglaDoc.min, message: `Mínimo ${reglaDoc.min} ${reglaDoc.soloNumeros ? 'dígitos' : 'caracteres'}` }, maxLength: { value: reglaDoc.max, message: `Máximo ${reglaDoc.max}` }, pattern: reglaDoc.soloNumeros ? { value: /^\d+$/, message: 'Solo dígitos' } : undefined })} />
        </Campo>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Fecha de nacimiento *" error={errors.fechaNacimiento?.message}>
          <input type="date" className={inputCls(errors.fechaNacimiento?.message)} max={new Date().toISOString().split('T')[0]}
            {...register('fechaNacimiento', { required: 'Requerido' })} />
        </Campo>
        <Campo label="Género *" error={errors.genero?.message}>
          <select className={inputCls(errors.genero?.message)} {...register('genero', { required: 'Requerido' })}>
            <option value="">Seleccionar</option>
            <option value="MASCULINO">Masculino</option>
            <option value="FEMENINO">Femenino</option>
            <option value="OTRO">Otro</option>
          </select>
        </Campo>
      </div>
      <Campo label="Grado *" error={errors.gradoId?.message}>
        <select className={inputCls(errors.gradoId?.message)} {...register('gradoId', { required: 'Requerido' })}>
          <option value="">Seleccionar grado</option>
          {gradosData.map(g => <option key={g.id} value={g.id}>{g.nombre}{g.grupo} — {g.nivel}</option>)}
        </select>
      </Campo>
      {modoEditar && (
        <Campo label="Estado" error={errors.estado?.message}>
          <select className={inputCls(errors.estado?.message)} {...register('estado')}>
            <option value="ACTIVO">Activo</option>
            <option value="INACTIVO">Inactivo</option>
            <option value="RETIRADO">Retirado</option>
            <option value="GRADUADO">Graduado</option>
          </select>
        </Campo>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Dirección (opcional)" error={errors.direccion?.message} hint="Máx. 150 caracteres">
          <input className={inputCls(errors.direccion?.message)} placeholder="Ej: Calle 45 # 23-10" maxLength={150}
            {...register('direccion', { minLength: { value: 5, message: 'Mínimo 5 caracteres' }, maxLength: { value: 150, message: 'Máximo 150' } })} />
        </Campo>
        <Campo label="Teléfono (opcional)" error={errors.telefono?.message} hint="7 a 10 dígitos">
          <input className={inputCls(errors.telefono?.message)} placeholder="Ej: 3001234567"
            maxLength={10} onKeyDown={soloNumerosKeyDown}
            {...register('telefono', { pattern: { value: /^[0-9]{7,10}$/, message: 'Entre 7 y 10 dígitos' } })} />
        </Campo>
      </div>
      <BotonesForm onCancel={onCancel} cargando={cargando} labelGuardar={modoEditar ? 'Guardar cambios' : 'Registrar estudiante'} />
    </form>
  );
}

type EstRow = { id: string; nombres: string; apellidos: string; tipoDocumento: string; numeroDocumento: string; fechaNacimiento: string; genero: string; grado: { id: string; nombre: string; grupo: string; nivel: string }; estado: string; direccion?: string; telefono?: string; gradoId: string };

function Estudiantes() {
  const qc = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroGrado, setFiltroGrado] = useState('');
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState<EstRow | null>(null);
  const [modalVer, setModalVer] = useState<EstRow | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);

  const { data: gradosData } = useQuery({ queryKey: ['grados'], queryFn: async () => (await api.get('/grados')).data.datos ?? [] });
  const { data, isLoading } = useQuery({
    queryKey: ['estudiantes', busqueda, filtroEstado, filtroGrado],
    queryFn: async () => (await api.get('/estudiantes', { params: { busqueda: busqueda || undefined, estado: filtroEstado || undefined, gradoId: filtroGrado || undefined } })).data,
    staleTime: 0,
  });

  const showToast = (msg: string, tipo: 'ok' | 'error') => setToast({ msg, tipo });

  const crearMutation = useMutation({
    mutationFn: (d: unknown) => api.post('/estudiantes', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['estudiantes'] }); qc.invalidateQueries({ queryKey: ['stats'] }); setModalCrear(false); showToast('Estudiante registrado correctamente', 'ok'); },
    onError: (e: unknown) => { const d = (e as { response?: { data?: { mensaje?: string; errores?: string[] } } })?.response?.data; showToast(d?.errores?.[0] ?? d?.mensaje ?? 'Error', 'error'); },
  });

  const editarMutation = useMutation({
    mutationFn: ({ id, ...d }: EstForm & { id: string }) => api.put(`/estudiantes/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['estudiantes'] }); setModalEditar(null); showToast('Estudiante actualizado correctamente', 'ok'); },
    onError: (e: unknown) => { const d = (e as { response?: { data?: { mensaje?: string; errores?: string[] } } })?.response?.data; showToast(d?.errores?.[0] ?? d?.mensaje ?? 'Error', 'error'); },
  });

  const ESTADO_COLOR: Record<string, string> = { ACTIVO: 'bg-emerald-50 text-emerald-700', INACTIVO: 'bg-slate-100 text-slate-500', RETIRADO: 'bg-red-50 text-red-600', GRADUADO: 'bg-blue-50 text-blue-700' };

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre o documento..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filtroGrado} onChange={e => setFiltroGrado(e.target.value)}
          className="py-2.5 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">Todos los grados</option>
          {(gradosData ?? []).map((g: { id: string; nombre: string; grupo: string }) => <option key={g.id} value={g.id}>{g.nombre}{g.grupo}</option>)}
        </select>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="py-2.5 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">Todos los estados</option>
          <option value="ACTIVO">Activo</option>
          <option value="INACTIVO">Inactivo</option>
          <option value="RETIRADO">Retirado</option>
          <option value="GRADUADO">Graduado</option>
        </select>
        <button onClick={() => setModalCrear(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
          <UserPlus className="w-4 h-4" /> Nuevo
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
        ) : (data?.datos ?? []).length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <GraduationCap className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay estudiantes que coincidan</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{['Estudiante','Documento','Grado','Estado','Acciones'].map(h => <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">{h}</th>)}</tr>
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
                  <td className="px-5 py-3"><Badge texto={e.estado} color={ESTADO_COLOR[e.estado] ?? 'bg-slate-100 text-slate-500'} /></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setModalVer(e)} title="Ver detalle" className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => setModalEditar(e)} title="Editar" className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"><Edit2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data?.meta && <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">{data.meta.total} estudiante(s) en total</div>}
      </div>

      {modalCrear && (
        <Modal titulo="Registrar nuevo estudiante" onClose={() => setModalCrear(false)}>
          <FormEstudiante gradosData={gradosData ?? []} onSubmit={d => crearMutation.mutate(d)} cargando={crearMutation.isPending} onCancel={() => setModalCrear(false)} />
        </Modal>
      )}

      {modalEditar && (
        <Modal titulo="Editar estudiante" onClose={() => setModalEditar(null)}>
          <FormEstudiante
            modoEditar
            gradosData={gradosData ?? []}
            inicial={{ ...modalEditar, fechaNacimiento: modalEditar.fechaNacimiento?.split('T')[0] ?? '' }}
            onSubmit={d => editarMutation.mutate({ ...d, id: modalEditar.id })}
            cargando={editarMutation.isPending}
            onCancel={() => setModalEditar(null)}
          />
        </Modal>
      )}

      {modalVer && (
        <FichaEstudiante
          estudiante={modalVer}
          onClose={() => setModalVer(null)}
          onEditar={() => { setModalVer(null); setModalEditar(modalVer); }}
        />
      )}
    </div>
  );
}

// ─── FICHA COMPLETA DEL ESTUDIANTE (pestañas: datos, boletín, observaciones, padres) ──
type TabFicha = 'datos' | 'boletin' | 'observaciones' | 'padres' | 'contactos';

function FichaEstudiante({ estudiante, onClose, onEditar }: { estudiante: EstRow; onClose: () => void; onEditar: () => void }) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabFicha>('datos');
  const [modalVincular, setModalVincular] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);

  const { data: ficha, isLoading } = useQuery({
    queryKey: ['ficha-completa', estudiante.id],
    queryFn: async () => (await api.get(`/estudiantes/${estudiante.id}/ficha-completa`)).data.datos,
  });

  const { data: periodos = [] } = useQuery({ queryKey: ['periodos'], queryFn: async () => (await api.get('/periodos')).data.datos ?? [] });
  const [periodoId, setPeriodoId] = useState('');

  React.useEffect(() => {
    if (ficha?.periodoActivo && !periodoId) setPeriodoId(ficha.periodoActivo.id);
  }, [ficha]);

  const { data: boletinData, isLoading: loadingBoletin } = useQuery({
    queryKey: ['boletin-admin', estudiante.id, periodoId],
    queryFn: async () => (await api.get(`/boletin/${estudiante.id}`, { params: { periodoId } })).data.datos,
    enabled: !!periodoId,
  });

  const { data: padresDisponibles = [] } = useQuery({
    queryKey: ['usuarios', 'PADRE'],
    queryFn: async () => (await api.get('/usuarios', { params: { rol: 'PADRE' } })).data.datos ?? [],
    enabled: modalVincular,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ padreId: string; parentesco: string; esPrincipal: boolean }>();

  const vincularMutation = useMutation({
    mutationFn: (d: unknown) => api.post('/vinculos', { ...(d as object), estudianteId: estudiante.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ficha-completa', estudiante.id] });
      qc.invalidateQueries({ queryKey: ['vinculos'] });
      setModalVincular(false); reset();
      setToast({ msg: 'Padre/acudiente vinculado correctamente', tipo: 'ok' });
    },
    onError: (e: unknown) => setToast({ msg: (e as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? 'Error', tipo: 'error' }),
  });

  const ESTADO_COLOR: Record<string, string> = { ACTIVO: 'bg-emerald-50 text-emerald-700', INACTIVO: 'bg-slate-100 text-slate-500', RETIRADO: 'bg-red-50 text-red-600', GRADUADO: 'bg-blue-50 text-blue-700' };
  const COLOR_OBS: Record<string, string> = { POSITIVA:'bg-emerald-100 text-emerald-800', NEGATIVA:'bg-red-100 text-red-800', NEUTRA:'bg-slate-100 text-slate-700', DISCIPLINARIA:'bg-orange-100 text-orange-800', ACADEMICA:'bg-blue-100 text-blue-800', CONVIVENCIA:'bg-purple-100 text-purple-800' };
  const LABEL_OBS: Record<string, string> = { POSITIVA:'Positiva', NEGATIVA:'Negativa', NEUTRA:'Neutra', DISCIPLINARIA:'Disciplinaria', ACADEMICA:'Académica', CONVIVENCIA:'Convivencia' };
  const COLOR_NOTA = (n: number | null) => { if (n === null) return 'text-slate-400'; if (n >= 90) return 'text-emerald-600 font-bold'; if (n >= 70) return 'text-blue-600 font-semibold'; return 'text-red-600 font-bold'; };

  const TABS: { id: TabFicha; label: string; icono: typeof Eye }[] = [
    { id: 'datos', label: 'Datos', icono: Eye },
    { id: 'boletin', label: 'Boletín', icono: GraduationCap },
    { id: 'observaciones', label: 'Observaciones', icono: MessageSquare },
    { id: 'padres', label: 'Padres', icono: UserCheck },
    { id: 'contactos', label: 'Contactos', icono: Phone },
  ];

  const materiasConNota = (boletinData?.boletin ?? []).filter((m: { notaPeriodo: number | null }) => m.notaPeriodo != null);
  const promedio = materiasConNota.length > 0
    ? (materiasConNota.reduce((acc: number, m: { notaPeriodo: number | null }) => acc + (m.notaPeriodo ?? 0), 0) / materiasConNota.length).toFixed(1)
    : '--';

  return (
    <Modal titulo={`${estudiante.nombres} ${estudiante.apellidos}`} onClose={onClose} ancho="max-w-2xl">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
        <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-700 text-xl font-bold flex-shrink-0">{estudiante.nombres[0]}{estudiante.apellidos[0]}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Badge texto={estudiante.estado} color={ESTADO_COLOR[estudiante.estado] ?? ''} />
            <Badge texto={`${estudiante.grado.nombre}${estudiante.grado.grupo}`} color="bg-blue-50 text-blue-700" />
          </div>
          <p className="text-xs text-slate-400 mt-1">{estudiante.tipoDocumento} {estudiante.numeroDocumento}</p>
        </div>
        <button onClick={onEditar} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition"><Edit2 className="w-3.5 h-3.5" /> Editar</button>
      </div>

      <div className="flex gap-1 mt-4 mb-4 bg-slate-100 rounded-xl p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-colors ${tab === t.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <t.icono className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
      ) : (
        <>
          {tab === 'datos' && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Fecha de nacimiento', new Date(estudiante.fechaNacimiento).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })],
                ['Género', estudiante.genero],
                ['Teléfono', estudiante.telefono ?? '—'],
                ['Dirección', estudiante.direccion ?? '—'],
              ].map(([k, v]) => (
                <div key={k} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-0.5">{k}</p>
                  <p className="font-medium text-slate-700">{v}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'boletin' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <select value={periodoId} onChange={e => setPeriodoId(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white">
                  {(periodos as { id: string; nombre: string; activo: boolean }[]).map(p => <option key={p.id} value={p.id}>{p.nombre}{p.activo ? ' (Activo)' : ''}</option>)}
                </select>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Promedio general</p>
                  <p className={`text-2xl ${COLOR_NOTA(parseFloat(promedio) || null)}`}>{promedio}</p>
                </div>
              </div>
              {loadingBoletin ? (
                <div className="flex items-center justify-center h-24"><div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
              ) : (boletinData?.boletin ?? []).length === 0 ? (
                <p className="text-sm text-slate-400 italic text-center py-6">Sin notas registradas para este período</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {(boletinData.boletin as { materia: { id: string; nombre: string }; profesor: string; notaPeriodo: number | null; porcentajeTotal: number }[]).map(m => (
                    <div key={m.materia.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{m.materia.nombre}</p>
                        <p className="text-xs text-slate-400">Prof. {m.profesor} · {m.porcentajeTotal}% evaluado</p>
                      </div>
                      <span className={`text-lg ${COLOR_NOTA(m.notaPeriodo)}`}>{m.notaPeriodo != null ? m.notaPeriodo.toFixed(1) : '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'observaciones' && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {(ficha?.observaciones ?? []).length === 0 ? (
                <p className="text-sm text-slate-400 italic text-center py-6">Sin observaciones registradas</p>
              ) : (
                (ficha.observaciones as { id: string; tipo: string; descripcion: string; fecha: string; profesor: { nombres: string; apellidos: string }; materia?: { nombre: string }; yaVista: boolean }[]).map(o => (
                  <div key={o.id} className="bg-slate-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge texto={LABEL_OBS[o.tipo]} color={COLOR_OBS[o.tipo]} />
                        {o.materia && <Badge texto={o.materia.nombre} color="bg-violet-100 text-violet-700" />}
                        {o.yaVista
                          ? <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Vista por el padre</span>
                          : <span className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> No vista por el padre</span>
                        }
                      </div>
                      <button onClick={async () => {
                        if (!confirm('¿Eliminar esta observación? Esta acción no se puede deshacer.')) return;
                        try {
                          await api.delete(`/observaciones/${o.id}`);
                          qc.invalidateQueries({ queryKey: ['ficha-completa', estudiante.id] });
                          setToast({ msg: 'Observación eliminada', tipo: 'ok' });
                        } catch { setToast({ msg: 'Error al eliminar', tipo: 'error' }); }
                      }} className="p-1 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-sm text-slate-700 break-words whitespace-pre-wrap">{o.descripcion}</p>
                    <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1"><Clock className="w-3 h-3" /> Prof. {o.profesor.nombres} {o.profesor.apellidos} · {new Date(o.fecha).toLocaleDateString('es-CO')}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'padres' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-600">Padres/acudientes vinculados</p>
                <button onClick={() => setModalVincular(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition">
                  <Plus className="w-3.5 h-3.5" /> Vincular padre
                </button>
              </div>
              {(ficha?.padres ?? []).length === 0 ? (
                <p className="text-sm text-slate-400 italic text-center py-6">Este estudiante no tiene padres vinculados aún</p>
              ) : (
                (ficha.padres as { nombres: string; apellidos: string; numeroDocumento: string; telefono?: string; parentesco: string; esPrincipal: boolean; usuario: { email: string } }[]).map((p, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{p.nombres} {p.apellidos}</p>
                      <p className="text-xs text-slate-400">{p.usuario.email} · {p.numeroDocumento}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge texto={p.parentesco} color="bg-blue-50 text-blue-700" />
                      {p.esPrincipal && <Badge texto="Principal" color="bg-amber-50 text-amber-700" />}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {modalVincular && (
        <Modal titulo="Vincular padre/acudiente" onClose={() => { setModalVincular(false); reset(); }}>
          <form onSubmit={handleSubmit(d => vincularMutation.mutate(d))} className="space-y-4">
            <Campo label="Padre/Acudiente *" error={errors.padreId?.message}>
              <select className={inputCls(errors.padreId?.message)} {...register('padreId', { required: 'Selecciona el padre' })}>
                <option value="">Seleccionar padre</option>
                {(padresDisponibles as (UsuRow & { perfil?: { id: string; nombres: string; apellidos: string } })[]).map(p => p.perfil && <option key={p.perfil.id} value={p.perfil.id}>{p.perfil.nombres} {p.perfil.apellidos} — {p.email}</option>)}
              </select>
            </Campo>
            <Campo label="Parentesco *" error={errors.parentesco?.message}>
              <select className={inputCls(errors.parentesco?.message)} {...register('parentesco', { required: 'Selecciona el parentesco' })}>
                <option value="">Seleccionar</option>
                {['padre','madre','acudiente','abuelo','abuela','tio','tia','hermano','hermana','otro'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </Campo>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" className="rounded" {...register('esPrincipal')} />
              Marcar como acudiente principal
            </label>
            <BotonesForm onCancel={() => { setModalVincular(false); reset(); }} cargando={vincularMutation.isPending} labelGuardar="Vincular" />
          </form>
        </Modal>
      )}

          {tab === 'contactos' && (
            <ContactosEmergencia estudianteId={estudiante.id} soloLectura={false} />
          )}
    </Modal>
  );
}

type UsuRow = { id: string; email: string; rol: string; estado: string; ultimoLogin: string | null; perfil: { nombres: string; apellidos: string; telefono?: string } | null };

function Usuarios() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [modalEditar, setModalEditar] = useState<UsuRow | null>(null);
  const [confirmEliminar, setConfirmEliminar] = useState<UsuRow | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [filtroRol, setFiltroRol] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['usuarios', filtroRol], queryFn: async () => (await api.get('/usuarios', { params: { rol: filtroRol || undefined } })).data.datos });

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<{ email: string; rol: string; nombres: string; apellidos: string; telefono?: string; tipoDocumento?: string; numeroDocumento?: string }>();
  const { register: regE, handleSubmit: hE, reset: rE, formState: { errors: eE } } = useForm<{ email: string; nombres: string; apellidos: string; telefono?: string }>();

  const rolSeleccionado = watch('rol');
  const tipoDocUsuario = watch('tipoDocumento') ?? '';
  const reglaDocUsuario = DOC_REGLAS[tipoDocUsuario] ?? { min: 5, max: 12, soloNumeros: true, placeholder: 'Número de documento' };
  const necesitaDocumento = ['PROFESOR', 'PADRE'].includes(rolSeleccionado);

  const crearMutation = useMutation({
    mutationFn: (d: unknown) => api.post('/usuarios', d),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['usuarios'] }); qc.invalidateQueries({ queryKey: ['stats'] }); setModal(false); reset(); setPasswordMsg(res.data.mensaje); },
    onError: (e: unknown) => setToast({ msg: (e as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? 'Error', tipo: 'error' }),
  });

  const editarMutation = useMutation({
    mutationFn: ({ id, ...d }: { id: string; nombres: string; apellidos: string; telefono?: string; email: string }) => api.put(`/usuarios/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); setModalEditar(null); setToast({ msg: 'Usuario actualizado', tipo: 'ok' }); },
    onError: (e: unknown) => setToast({ msg: (e as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? 'Error', tipo: 'error' }),
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/usuarios/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); qc.invalidateQueries({ queryKey: ['stats'] }); setConfirmEliminar(null); setToast({ msg: 'Usuario eliminado', tipo: 'ok' }); },
    onError: (e: unknown) => { setConfirmEliminar(null); setToast({ msg: (e as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? 'Error', tipo: 'error' }); },
  });

  const cambiarEstadoMutation = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: string }) => api.patch(`/usuarios/${id}/estado`, { estado }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); setToast({ msg: 'Estado actualizado', tipo: 'ok' }); },
    onError: (e: unknown) => setToast({ msg: (e as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? 'Error', tipo: 'error' }),
  });

  const resetMutation = useMutation({
    mutationFn: (id: string) => api.post(`/usuarios/${id}/reset-password`),
    onSuccess: (res) => setPasswordMsg(res.data.mensaje),
  });

  const ROL_COLOR: Record<string, string> = { PROFESOR: 'bg-blue-50 text-blue-700', SECRETARIO: 'bg-violet-50 text-violet-700', PADRE: 'bg-amber-50 text-amber-700', ADMINISTRADOR: 'bg-red-50 text-red-700', ESTUDIANTE: 'bg-slate-100 text-slate-600' };

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}
      {passwordMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1"><p className="text-sm font-semibold text-emerald-800">Listo</p><p className="text-sm text-emerald-700 mt-0.5">{passwordMsg}</p><p className="text-xs text-emerald-600 mt-1">Comunica esta contraseña al usuario.</p></div>
          <button onClick={() => setPasswordMsg(null)}><X className="w-4 h-4 text-emerald-500" /></button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <select value={filtroRol} onChange={e => setFiltroRol(e.target.value)} className="py-2.5 px-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">Todos los roles</option>
          <option value="ADMINISTRADOR">Administrador</option>
          <option value="SECRETARIO">Secretario/a</option>
          <option value="PROFESOR">Profesor/a</option>
          <option value="PADRE">Padre/Acudiente</option>
        </select>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors ml-auto">
          <UserPlus className="w-4 h-4" /> Nuevo usuario
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div> : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{['Usuario','Rol','Último acceso','Estado','Acciones'].map(h => <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(data ?? []).map((u: UsuRow) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3"><p className="text-sm font-medium text-slate-800">{u.perfil ? `${u.perfil.nombres} ${u.perfil.apellidos}` : '—'}</p><p className="text-xs text-slate-400">{u.email}</p></td>
                  <td className="px-5 py-3"><Badge texto={u.rol} color={ROL_COLOR[u.rol] ?? 'bg-slate-100'} /></td>
                  <td className="px-5 py-3 text-xs text-slate-400">{u.ultimoLogin ? new Date(u.ultimoLogin).toLocaleDateString('es-CO') : 'Nunca'}</td>
                  <td className="px-5 py-3"><Badge texto={u.estado} color={u.estado === 'ACTIVO' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'} /></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => { setModalEditar(u); rE({ email: u.email, nombres: u.perfil?.nombres ?? '', apellidos: u.perfil?.apellidos ?? '', telefono: u.perfil?.telefono ?? '' }); }} title="Editar" className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => resetMutation.mutate(u.id)} title="Resetear contraseña" className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><RefreshCw className="w-4 h-4" /></button>
                      <button onClick={() => cambiarEstadoMutation.mutate({ id: u.id, estado: u.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO' })} title={u.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                        className={`p-1.5 rounded-lg transition-colors ${u.estado === 'ACTIVO' ? 'text-slate-400 hover:text-orange-600 hover:bg-orange-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}>
                        {u.estado === 'ACTIVO' ? <X className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </button>
                      <button onClick={() => setConfirmEliminar(u)} title="Eliminar" className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Modal titulo="Crear nuevo usuario" onClose={() => { setModal(false); reset(); }}>
          <form onSubmit={handleSubmit(d => crearMutation.mutate(d))} className="space-y-4">
            <Campo label="Correo electrónico *" error={errors.email?.message} hint="Máx. 100 caracteres">
              <input type="email" className={inputCls(errors.email?.message)} placeholder="correo@ejemplo.com" maxLength={100}
                {...register('email', { required: 'Requerido', maxLength: { value: 100, message: 'Máximo 100 caracteres' }, pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email inválido' } })} />
            </Campo>
            <Campo label="Rol *" error={errors.rol?.message}>
              <select className={inputCls(errors.rol?.message)} {...register('rol', { required: 'Requerido' })}>
                <option value="">Seleccionar rol</option>
                <option value="ADMINISTRADOR">Administrador</option>
                <option value="SECRETARIO">Secretario/a</option>
                <option value="PROFESOR">Profesor/a</option>
                <option value="PADRE">Padre/Acudiente</option>
              </select>
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Nombres *" error={errors.nombres?.message} hint="Solo letras">
                <input className={inputCls(errors.nombres?.message)} placeholder="Nombres" maxLength={50} onKeyDown={soloLetrasKeyDown}
                  {...register('nombres', { required: 'Requerido', minLength: { value: 2, message: 'Mínimo 2' }, maxLength: { value: 50, message: 'Máximo 50' }, pattern: { value: /^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s\-']+$/, message: 'Solo letras' } })} />
              </Campo>
              <Campo label="Apellidos *" error={errors.apellidos?.message} hint="Solo letras">
                <input className={inputCls(errors.apellidos?.message)} placeholder="Apellidos" maxLength={50} onKeyDown={soloLetrasKeyDown}
                  {...register('apellidos', { required: 'Requerido', minLength: { value: 2, message: 'Mínimo 2' }, maxLength: { value: 50, message: 'Máximo 50' }, pattern: { value: /^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s\-']+$/, message: 'Solo letras' } })} />
              </Campo>
            </div>
            <Campo label="Teléfono (opcional)" error={errors.telefono?.message} hint="7 a 10 dígitos">
              <input className={inputCls(errors.telefono?.message)} placeholder="Ej: 3001234567" maxLength={10} onKeyDown={soloNumerosKeyDown}
                {...register('telefono', { pattern: { value: /^[0-9]{7,10}$/, message: 'Entre 7 y 10 dígitos' } })} />
            </Campo>
            {necesitaDocumento && (
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Tipo de documento *" error={errors.tipoDocumento?.message}>
                  <select className={inputCls(errors.tipoDocumento?.message)} {...register('tipoDocumento', { required: necesitaDocumento ? 'Requerido' : false })}>
                    <option value="">Seleccionar</option>
                    <option value="CC">CC — Cédula</option>
                    <option value="CE">CE — Cédula Extranjería</option>
                    <option value="PASAPORTE">Pasaporte</option>
                  </select>
                </Campo>
                <Campo label="Número de documento *" error={errors.numeroDocumento?.message} hint={tipoDocUsuario ? reglaDocUsuario.placeholder : 'Selecciona el tipo'}>
                  <input className={inputCls(errors.numeroDocumento?.message)} placeholder={tipoDocUsuario ? reglaDocUsuario.placeholder : '—'}
                    maxLength={reglaDocUsuario.max} disabled={!tipoDocUsuario} onKeyDown={reglaDocUsuario.soloNumeros ? soloNumerosKeyDown : undefined}
                    {...register('numeroDocumento', { required: necesitaDocumento ? 'Requerido' : false, minLength: { value: reglaDocUsuario.min, message: `Mínimo ${reglaDocUsuario.min}` }, maxLength: { value: reglaDocUsuario.max, message: `Máximo ${reglaDocUsuario.max}` }, pattern: reglaDocUsuario.soloNumeros ? { value: /^\d+$/, message: 'Solo dígitos' } : undefined })} />
                </Campo>
              </div>
            )}
            <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">Se generará una contraseña temporal automáticamente.</p>
            <BotonesForm onCancel={() => { setModal(false); reset(); }} cargando={crearMutation.isPending} labelGuardar="Crear usuario" />
          </form>
        </Modal>
      )}

      {modalEditar && (
        <Modal titulo="Editar usuario" onClose={() => setModalEditar(null)}>
          <form onSubmit={hE(d => editarMutation.mutate({ id: modalEditar.id, ...d }))} className="space-y-4">
            <Campo label="Correo electrónico" error={eE.email?.message} hint="Máx. 100 caracteres">
              <input type="email" className={inputCls(eE.email?.message)} maxLength={100}
                {...regE('email', { maxLength: { value: 100, message: 'Máximo 100 caracteres' }, pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email inválido' } })} />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Nombres" error={eE.nombres?.message}>
                <input className={inputCls(eE.nombres?.message)} maxLength={50} onKeyDown={soloLetrasKeyDown}
                  {...regE('nombres', { minLength: { value: 2, message: 'Mínimo 2' }, maxLength: { value: 50, message: 'Máximo 50' }, pattern: { value: /^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s\-']+$/, message: 'Solo letras' } })} />
              </Campo>
              <Campo label="Apellidos" error={eE.apellidos?.message}>
                <input className={inputCls(eE.apellidos?.message)} maxLength={50} onKeyDown={soloLetrasKeyDown}
                  {...regE('apellidos', { minLength: { value: 2, message: 'Mínimo 2' }, maxLength: { value: 50, message: 'Máximo 50' }, pattern: { value: /^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s\-']+$/, message: 'Solo letras' } })} />
              </Campo>
            </div>
            <Campo label="Teléfono" error={eE.telefono?.message}>
              <input className={inputCls(eE.telefono?.message)} maxLength={10} onKeyDown={soloNumerosKeyDown}
                {...regE('telefono', { pattern: { value: /^[0-9]{7,10}$/, message: 'Entre 7 y 10 dígitos' } })} />
            </Campo>
            <BotonesForm onCancel={() => setModalEditar(null)} cargando={editarMutation.isPending} />
          </form>
        </Modal>
      )}

      {confirmEliminar && (
        <Modal titulo="Confirmar eliminación" onClose={() => setConfirmEliminar(null)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">¿Seguro que quieres eliminar a <strong>{confirmEliminar.perfil?.nombres} {confirmEliminar.perfil?.apellidos}</strong> ({confirmEliminar.email})? Esta acción no se puede deshacer.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmEliminar(null)} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
              <button onClick={() => eliminarMutation.mutate(confirmEliminar.id)} disabled={eliminarMutation.isPending}
                className="px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition disabled:opacity-50">
                {eliminarMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

type VinculoRow = { id: string; parentesco: string; esPrincipal: boolean; padre: { id: string; nombres: string; apellidos: string; numeroDocumento: string }; estudiante: { id: string; nombres: string; apellidos: string; grado: { nombre: string; grupo: string } } };

function Vinculos() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [confirmEliminar, setConfirmEliminar] = useState<VinculoRow | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['vinculos'], queryFn: async () => (await api.get('/vinculos')).data.datos ?? [] });
  const { data: padres = [] } = useQuery({ queryKey: ['usuarios', 'PADRE'], queryFn: async () => (await api.get('/usuarios', { params: { rol: 'PADRE' } })).data.datos ?? [] });
  const { data: estudiantesData } = useQuery({ queryKey: ['estudiantes-todos'], queryFn: async () => (await api.get('/estudiantes', { params: { limite: 200 } })).data.datos ?? [] });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ padreId: string; estudianteId: string; parentesco: string; esPrincipal: boolean }>();

  const crearMutation = useMutation({
    mutationFn: (d: unknown) => api.post('/vinculos', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vinculos'] }); setModal(false); reset(); setToast({ msg: 'Vínculo creado correctamente', tipo: 'ok' }); },
    onError: (e: unknown) => setToast({ msg: (e as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? 'Error', tipo: 'error' }),
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/vinculos/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vinculos'] }); setConfirmEliminar(null); setToast({ msg: 'Vínculo eliminado', tipo: 'ok' }); },
  });

  const PARENTESCOS = ['padre','madre','acudiente','abuelo','abuela','tio','tia','hermano','hermana','otro'];

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">Vincula padres/acudientes con sus estudiantes para que puedan ver el boletín</p>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> Nuevo vínculo
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div> : (data ?? []).length === 0 ? (
          <div className="text-center py-12 text-slate-400"><Users className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No hay vínculos registrados aún</p></div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100"><tr>{['Padre/Acudiente','Estudiante','Parentesco','',''].map(h => <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-50">
              {(data as VinculoRow[]).map(v => (
                <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3"><p className="text-sm font-medium text-slate-800">{v.padre.nombres} {v.padre.apellidos}</p><p className="text-xs text-slate-400">{v.padre.numeroDocumento}</p></td>
                  <td className="px-5 py-3"><p className="text-sm font-medium text-slate-800">{v.estudiante.nombres} {v.estudiante.apellidos}</p><p className="text-xs text-slate-400">{v.estudiante.grado.nombre}{v.estudiante.grado.grupo}</p></td>
                  <td className="px-5 py-3"><Badge texto={v.parentesco} color="bg-blue-50 text-blue-700" /></td>
                  <td className="px-5 py-3">{v.esPrincipal && <Badge texto="Principal" color="bg-amber-50 text-amber-700" />}</td>
                  <td className="px-5 py-3"><button onClick={() => setConfirmEliminar(v)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <Modal titulo="Vincular padre con estudiante" onClose={() => { setModal(false); reset(); }}>
          <form onSubmit={handleSubmit(d => crearMutation.mutate(d))} className="space-y-4">
            <Campo label="Padre/Acudiente *" error={errors.padreId?.message}>
              <select className={inputCls(errors.padreId?.message)} {...register('padreId', { required: 'Selecciona el padre' })}>
                <option value="">Seleccionar padre</option>
                {(padres as (UsuRow & { perfil?: { id: string; nombres: string; apellidos: string } })[]).map(p => p.perfil && <option key={p.perfil.id} value={p.perfil.id}>{p.perfil.nombres} {p.perfil.apellidos} — {p.email}</option>)}
              </select>
            </Campo>
            <Campo label="Estudiante *" error={errors.estudianteId?.message}>
              <select className={inputCls(errors.estudianteId?.message)} {...register('estudianteId', { required: 'Selecciona el estudiante' })}>
                <option value="">Seleccionar estudiante</option>
                {(estudiantesData ?? []).map((e: { id: string; nombres: string; apellidos: string; grado: { nombre: string; grupo: string } }) => (
                  <option key={e.id} value={e.id}>{e.nombres} {e.apellidos} — {e.grado.nombre}{e.grado.grupo}</option>
                ))}
              </select>
            </Campo>
            <Campo label="Parentesco *" error={errors.parentesco?.message}>
              <select className={inputCls(errors.parentesco?.message)} {...register('parentesco', { required: 'Selecciona el parentesco' })}>
                <option value="">Seleccionar</option>
                {PARENTESCOS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </Campo>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" className="rounded" {...register('esPrincipal')} />
              Marcar como acudiente principal
            </label>
            <BotonesForm onCancel={() => { setModal(false); reset(); }} cargando={crearMutation.isPending} labelGuardar="Vincular" />
          </form>
        </Modal>
      )}

      {confirmEliminar && (
        <Modal titulo="Eliminar vínculo" onClose={() => setConfirmEliminar(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">¿Eliminar el vínculo entre <strong>{confirmEliminar.padre.nombres}</strong> y <strong>{confirmEliminar.estudiante.nombres}</strong>?</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmEliminar(null)} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
              <button onClick={() => eliminarMutation.mutate(confirmEliminar.id)} className="px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition">Eliminar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

type GradoRow = { id: string; nombre: string; grupo: string; nivel: string; anio: number; _count: { estudiantes: number }; materiaGrados: { id: string; materia: { nombre: string }; profesor: { nombres: string; apellidos: string } }[] };

function Grados() {
  const qc = useQueryClient();
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState<GradoRow | null>(null);
  const [modalMaterias, setModalMaterias] = useState<GradoRow | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['grados'], queryFn: async () => (await api.get('/grados')).data.datos ?? [] });
  const { data: materiasList } = useQuery({ queryKey: ['materias'], queryFn: async () => (await api.get('/materias')).data.datos ?? [] });
  const { data: profesoresList } = useQuery({ queryKey: ['usuarios', 'PROFESOR'], queryFn: async () => (await api.get('/usuarios', { params: { rol: 'PROFESOR' } })).data.datos ?? [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register: regCrear, handleSubmit: hCrear, reset: rCrear, formState: { errors: eCrear } } = useForm<{ nombre: string; grupo: string; nivel: string; anio: number }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { register: regEditar, handleSubmit: hEditar, reset: rEditar, formState: { errors: eEditar } } = useForm<{ nombre: string; grupo: string; nivel: string; anio: number }>();
  const { register: regAsig, handleSubmit: hAsig, reset: rAsig } = useForm<{ materiaId: string; profesorId: string }>();

  const crearMutation = useMutation({
    mutationFn: (d: unknown) => api.post('/grados', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['grados'] }); qc.invalidateQueries({ queryKey: ['stats'] }); setModalCrear(false); rCrear(); setToast({ msg: 'Grado creado', tipo: 'ok' }); },
    onError: (e: unknown) => setToast({ msg: (e as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? 'Error', tipo: 'error' }),
  });

  const editarMutation = useMutation({
    mutationFn: ({ id, ...d }: { id: string; nombre: string; grupo: string; nivel: string; anio: number }) => api.put(`/grados/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['grados'] }); setModalEditar(null); setToast({ msg: 'Grado actualizado', tipo: 'ok' }); },
    onError: (e: unknown) => setToast({ msg: (e as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? 'Error', tipo: 'error' }),
  });

  const asignarMutation = useMutation({
    mutationFn: (d: unknown) => api.post('/grados/asignar-materia', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['grados'] }); rAsig(); setToast({ msg: 'Materia asignada', tipo: 'ok' }); },
    onError: (e: unknown) => setToast({ msg: (e as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? 'Error', tipo: 'error' }),
  });

  const NIVEL_COLOR: Record<string, string> = { primaria: 'bg-sky-50 text-sky-700', secundaria: 'bg-indigo-50 text-indigo-700', media: 'bg-violet-50 text-violet-700' };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const FormGrado = ({ onSubmit, errors: errs, reg, cargando, onCancel, inicial }: { onSubmit: () => void; errors: Record<string, { message?: string }>; reg: any; cargando: boolean; onCancel: () => void; inicial?: GradoRow }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Nombre del grado *" error={errs.nombre?.message} hint='Ej: 1°, 5°, 11°'>
          <input className={inputCls(errs.nombre?.message)} placeholder="Ej: 5°" maxLength={5} defaultValue={inicial?.nombre}
            {...reg('nombre', { required: 'Requerido', maxLength: { value: 5, message: 'Máximo 5 caracteres' } })} />
        </Campo>
        <Campo label="Grupo *" error={errs.grupo?.message} hint="Una sola letra">
          <input className={inputCls(errs.grupo?.message)} placeholder="A" maxLength={1} onKeyDown={soloLetrasKeyDown} defaultValue={inicial?.grupo}
            {...reg('grupo', { required: 'Requerido', pattern: { value: /^[A-Za-z]$/, message: 'Solo una letra' } })} />
        </Campo>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Nivel *" error={errs.nivel?.message}>
          <select className={inputCls(errs.nivel?.message)} defaultValue={inicial?.nivel} {...reg('nivel', { required: 'Requerido' })}>
            <option value="">Seleccionar</option>
            <option value="primaria">Primaria (1° a 5°)</option>
            <option value="secundaria">Secundaria (6° a 9°)</option>
            <option value="media">Media (10° y 11°)</option>
          </select>
        </Campo>
        <Campo label="Año *" error={errs.anio?.message}>
          <input type="number" className={inputCls(errs.anio?.message)} min={2020} max={2099} defaultValue={inicial?.anio ?? 2026} onKeyDown={soloNumerosKeyDown}
            {...reg('anio', { required: 'Requerido', valueAsNumber: true, min: { value: 2020, message: 'Mínimo 2020' }, max: { value: 2099, message: 'Máximo 2099' } })} />
        </Campo>
      </div>
      <BotonesForm onCancel={onCancel} cargando={cargando} labelGuardar={inicial ? 'Guardar cambios' : 'Crear grado'} />
    </form>
  );

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{(data ?? []).length} grado(s) registrado(s)</p>
        <button onClick={() => setModalCrear(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"><Plus className="w-4 h-4" /> Nuevo grado</button>
      </div>

      {isLoading ? <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data ?? []).map((g: GradoRow) => (
            <div key={g.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center"><span className="text-white font-bold">{g.nombre}{g.grupo}</span></div>
                <Badge texto={g.nivel} color={NIVEL_COLOR[g.nivel]} />
              </div>
              <h3 className="font-bold text-slate-800">Grado {g.nombre} — Grupo {g.grupo}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Año {g.anio}</p>
              <div className="flex gap-4 mt-3 pt-3 border-t border-slate-100">
                <div><p className="text-xs text-slate-400">Estudiantes</p><p className="text-lg font-bold text-slate-700">{g._count.estudiantes}</p></div>
                <div><p className="text-xs text-slate-400">Materias</p><p className="text-lg font-bold text-slate-700">{g.materiaGrados.length}</p></div>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                <button onClick={() => { setModalEditar(g); rEditar({ nombre: g.nombre, grupo: g.grupo, nivel: g.nivel, anio: g.anio }); }}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
                  <Edit2 className="w-3 h-3" /> Editar
                </button>
                <button onClick={() => setModalMaterias(g)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                  <BookMarked className="w-3 h-3" /> Materias
                </button>
              </div>
            </div>
          ))}
          {(data ?? []).length === 0 && <div className="col-span-3 text-center py-12 text-slate-400"><Layers className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No hay grados registrados</p></div>}
        </div>
      )}

      {modalCrear && (
        <Modal titulo="Crear nuevo grado" onClose={() => { setModalCrear(false); rCrear(); }}>
          <FormGrado onSubmit={hCrear(d => crearMutation.mutate(d))} errors={eCrear} reg={regCrear} cargando={crearMutation.isPending} onCancel={() => { setModalCrear(false); rCrear(); }} />
        </Modal>
      )}

      {modalEditar && (
        <Modal titulo={`Editar grado ${modalEditar.nombre}${modalEditar.grupo}`} onClose={() => setModalEditar(null)}>
          <FormGrado onSubmit={hEditar(d => editarMutation.mutate({ id: modalEditar.id, ...d }))} errors={eEditar} reg={regEditar} cargando={editarMutation.isPending} onCancel={() => setModalEditar(null)} inicial={modalEditar} />
        </Modal>
      )}

      {modalMaterias && (
        <Modal titulo={`Materias — Grado ${modalMaterias.nombre}${modalMaterias.grupo}`} onClose={() => setModalMaterias(null)} ancho="max-w-2xl">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-600">Materias asignadas</p>
              {modalMaterias.materiaGrados.length === 0 ? (
                <p className="text-sm text-slate-400 italic">Sin materias asignadas aún</p>
              ) : (
                modalMaterias.materiaGrados.map(mg => (
                  <div key={mg.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{mg.materia.nombre}</p>
                      <p className="text-xs text-slate-400">Prof. {mg.profesor.nombres} {mg.profesor.apellidos}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-slate-100 pt-4">
              <p className="text-sm font-medium text-slate-600 mb-3">Asignar materia y profesor</p>
              <form onSubmit={hAsig(d => asignarMutation.mutate({ ...d, gradoId: modalMaterias.id, anio: modalMaterias.anio }))} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Materia">
                    <select className={inputCls()} {...regAsig('materiaId', { required: true })}>
                      <option value="">Seleccionar materia</option>
                      {(materiasList ?? []).map((m: { id: string; nombre: string }) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                    </select>
                  </Campo>
                  <Campo label="Profesor">
                    <select className={inputCls()} {...regAsig('profesorId', { required: true })}>
                      <option value="">Seleccionar profesor</option>
                      {(profesoresList ?? []).map((u: UsuRow & { perfil?: { id: string; nombres: string; apellidos: string } }) => u.perfil && <option key={u.perfil.id} value={u.perfil.id}>{u.perfil.nombres} {u.perfil.apellidos}</option>)}
                    </select>
                  </Campo>
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={asignarMutation.isPending} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
                    {asignarMutation.isPending ? 'Asignando...' : 'Asignar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Materias() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [materiaEditar, setMateriaEditar] = useState<{ id: string; nombre: string; codigo?: string } | null>(null);
  const [materiaEliminar, setMateriaEliminar] = useState<{ id: string; nombre: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['materias'], queryFn: async () => (await api.get('/materias')).data.datos ?? [] });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ nombre: string; codigo?: string }>();
  const { register: regE, handleSubmit: hE, formState: { errors: eE } } = useForm<{ nombre: string; codigo?: string }>();

  const MATERIAS_COLOMBIA = ['Matemáticas','Lenguaje','Ciencias Naturales','Ciencias Sociales','Inglés','Educación Física','Educación Artística','Ética y Valores','Tecnología e Informática','Religión','Química','Física','Filosofía','Economía y Política'];

  const crearMutation = useMutation({
    mutationFn: (d: unknown) => api.post('/materias', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['materias'] }); setModal(false); reset(); setToast({ msg: 'Materia creada', tipo: 'ok' }); },
    onError: (e: unknown) => setToast({ msg: (e as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? 'Error', tipo: 'error' }),
  });

  const editarMutation = useMutation({
    mutationFn: ({ id, ...d }: { id: string; nombre: string; codigo?: string }) => api.put(`/materias/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['materias'] }); setMateriaEditar(null); setToast({ msg: 'Materia actualizada', tipo: 'ok' }); },
    onError: (e: unknown) => setToast({ msg: (e as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? 'Error', tipo: 'error' }),
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/materias/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['materias'] }); setMateriaEliminar(null); setToast({ msg: 'Materia eliminada', tipo: 'ok' }); },
    onError: (e: unknown) => setToast({ msg: (e as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? 'No se puede eliminar', tipo: 'error' }),
  });

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{(data ?? []).length} materia(s) registrada(s)</p>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"><Plus className="w-4 h-4" /> Nueva materia</button>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-xs font-semibold text-blue-700 mb-2">Materias comunes en Colombia — clic para agregar</p>
        <div className="flex flex-wrap gap-2">
          {MATERIAS_COLOMBIA.map(m => {
            const yaExiste = (data ?? []).some((mat: { nombre: string }) => mat.nombre === m);
            return (
              <button key={m} disabled={yaExiste}
                onClick={() => crearMutation.mutate({ nombre: m })}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${yaExiste ? 'bg-emerald-100 text-emerald-700 cursor-default' : 'bg-white border border-blue-200 text-blue-700 hover:bg-blue-600 hover:text-white hover:border-blue-600'}`}>
                {yaExiste ? '✓ ' : ''}{m}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div> : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {(data ?? []).length === 0 ? (
            <div className="text-center py-12 text-slate-400"><BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No hay materias registradas</p></div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>{['Materia','Código',''].map(h => <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(data ?? []).map((m: { id: string; nombre: string; codigo?: string }) => (
                  <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-slate-800">{m.nombre}</td>
                    <td className="px-5 py-3 text-sm text-slate-400">{m.codigo ?? '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setMateriaEditar(m)} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => setMateriaEliminar(m)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modal && (
        <Modal titulo="Nueva materia" onClose={() => { setModal(false); reset(); }}>
          <form onSubmit={handleSubmit(d => crearMutation.mutate(d))} className="space-y-4">
            <Campo label="Nombre de la materia *" error={errors.nombre?.message} hint="Solo letras y espacios">
              <input className={inputCls(errors.nombre?.message)} placeholder="Ej: Matemáticas" maxLength={60} onKeyDown={soloLetrasKeyDown}
                {...register('nombre', { required: 'Requerido', minLength: { value: 2, message: 'Mínimo 2 caracteres' }, maxLength: { value: 60, message: 'Máximo 60 caracteres' }, pattern: { value: /^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s\-]+$/, message: 'Solo letras y espacios' } })} />
            </Campo>
            <Campo label="Código (opcional)" hint="Ej: MAT, LEN, CN">
              <input className={inputCls()} placeholder="Ej: MAT" maxLength={10}
                {...register('codigo', { maxLength: { value: 10, message: 'Máximo 10 caracteres' } })} />
            </Campo>
            <BotonesForm onCancel={() => { setModal(false); reset(); }} cargando={crearMutation.isPending} labelGuardar="Crear materia" />
          </form>
        </Modal>
      )}

      {materiaEditar && (
        <Modal titulo="Editar materia" onClose={() => setMateriaEditar(null)}>
          <form key={materiaEditar.id} onSubmit={hE(d => editarMutation.mutate({ ...d, id: materiaEditar.id }))} className="space-y-4">
            <Campo label="Nombre de la materia *" error={eE.nombre?.message}>
              <input className={inputCls(eE.nombre?.message)} defaultValue={materiaEditar.nombre} maxLength={60} onKeyDown={soloLetrasKeyDown}
                {...regE('nombre', { required: 'Requerido', minLength: { value: 2, message: 'Mínimo 2 caracteres' }, maxLength: { value: 60, message: 'Máximo 60 caracteres' }, pattern: { value: /^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s\-]+$/, message: 'Solo letras y espacios' } })} />
            </Campo>
            <Campo label="Código (opcional)">
              <input className={inputCls()} defaultValue={materiaEditar.codigo ?? ''} placeholder="Ej: MAT" maxLength={10}
                {...regE('codigo', { maxLength: { value: 10, message: 'Máximo 10 caracteres' } })} />
            </Campo>
            <BotonesForm onCancel={() => setMateriaEditar(null)} cargando={editarMutation.isPending} labelGuardar="Guardar cambios" />
          </form>
        </Modal>
      )}

      {materiaEliminar && (
        <Modal titulo="Eliminar materia" onClose={() => setMateriaEliminar(null)}>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-700">¿Eliminar la materia <strong>"{materiaEliminar.nombre}"</strong>?</p>
              <p className="text-xs text-red-500 mt-1">Solo se puede eliminar si no está asignada a ningún grado.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setMateriaEliminar(null)} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
              <button onClick={() => eliminarMutation.mutate(materiaEliminar.id)} disabled={eliminarMutation.isPending}
                className="px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition disabled:opacity-50">
                {eliminarMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

type PeriodoRow = { id: string; nombre: string; numero: number; anio: number; fechaInicio: string; fechaFin: string; activo: boolean };

function Periodos() {
  const qc = useQueryClient();
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState<PeriodoRow | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['periodos'], queryFn: async () => (await api.get('/periodos')).data.datos ?? [] });

  const { register: regC, handleSubmit: hC, reset: rC, watch: wC, formState: { errors: eC } } = useForm<{ nombre: string; numero: number; anio: number; fechaInicio: string; fechaFin: string }>();
  const { register: regE, handleSubmit: hE, reset: rE, watch: wE, formState: { errors: eE } } = useForm<{ nombre: string; numero: number; anio: number; fechaInicio: string; fechaFin: string }>();

  const fechaInicioC = wC('fechaInicio');
  const fechaInicioE = wE('fechaInicio');

  const crearMutation = useMutation({
    mutationFn: (d: unknown) => api.post('/periodos', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['periodos'] }); setModalCrear(false); rC(); setToast({ msg: 'Período creado', tipo: 'ok' }); },
    onError: (e: unknown) => setToast({ msg: (e as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? 'Error', tipo: 'error' }),
  });

  const editarMutation = useMutation({
    mutationFn: ({ id, ...d }: PeriodoRow) => api.put(`/periodos/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['periodos'] }); setModalEditar(null); setToast({ msg: 'Período actualizado', tipo: 'ok' }); },
    onError: (e: unknown) => setToast({ msg: (e as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? 'Error', tipo: 'error' }),
  });

  const activarMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/periodos/${id}/activar`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['periodos'] }); qc.invalidateQueries({ queryKey: ['stats'] }); setToast({ msg: 'Período activado', tipo: 'ok' }); },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const FormPeriodo = ({ reg, errors: errs, onSubmit, cargando, onCancel, fechaInicio, labelGuardar }: { reg: any; errors: Record<string, { message?: string }>; onSubmit: () => void; cargando: boolean; onCancel: () => void; fechaInicio: string; labelGuardar: string }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Nombre *" error={errs.nombre?.message} hint="Ej: Período 1">
          <input className={inputCls(errs.nombre?.message)} placeholder="Ej: Período 1" maxLength={20}
            {...reg('nombre', { required: 'Requerido', maxLength: { value: 20, message: 'Máximo 20 caracteres' } })} />
        </Campo>
        <Campo label="Número *" error={errs.numero?.message}>
          <select className={inputCls(errs.numero?.message)} {...reg('numero', { required: 'Requerido', valueAsNumber: true })}>
            <option value="">Seleccionar</option>
            {[1,2,3,4].map(n => <option key={n} value={n}>Período {n}</option>)}
          </select>
        </Campo>
      </div>
      <Campo label="Año *" error={errs.anio?.message}>
        <input type="number" className={inputCls(errs.anio?.message)} min={2020} max={2099} onKeyDown={soloNumerosKeyDown}
          {...reg('anio', { required: 'Requerido', valueAsNumber: true, min: { value: 2020, message: 'Mínimo 2020' }, max: { value: 2099, message: 'Máximo 2099' } })} />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Fecha de inicio *" error={errs.fechaInicio?.message}>
          <input type="date" className={inputCls(errs.fechaInicio?.message)} {...reg('fechaInicio', { required: 'Requerido' })} />
        </Campo>
        <Campo label="Fecha de fin *" error={errs.fechaFin?.message}>
          <input type="date" className={inputCls(errs.fechaFin?.message)} min={fechaInicio || undefined}
            {...reg('fechaFin', { required: 'Requerido', validate: (v: string) => !fechaInicio || v > fechaInicio || 'Debe ser posterior al inicio' })} />
        </Campo>
      </div>
      <BotonesForm onCancel={onCancel} cargando={cargando} labelGuardar={labelGuardar} />
    </form>
  );

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">Solo puede haber un período activo a la vez</p>
        <button onClick={() => setModalCrear(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"><Plus className="w-4 h-4" /> Nuevo período</button>
      </div>
      {isLoading ? <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div> : (
        <div className="space-y-3">
          {(data ?? []).map((p: PeriodoRow) => (
            <div key={p.id} className={`bg-white rounded-2xl border shadow-sm p-5 ${p.activo ? 'border-blue-200 shadow-blue-50' : 'border-slate-100'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${p.activo ? 'bg-blue-600' : 'bg-slate-100'}`}>
                    <span className={`font-bold text-lg ${p.activo ? 'text-white' : 'text-slate-500'}`}>P{p.numero}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-800">{p.nombre} — {p.anio}</h3>
                      {p.activo && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Activo</span>}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {new Date(p.fechaInicio).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', timeZone: 'UTC' })} —{' '}
                      {new Date(p.fechaFin).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setModalEditar(p); rE({ nombre: p.nombre, numero: p.numero, anio: p.anio, fechaInicio: p.fechaInicio.split('T')[0], fechaFin: p.fechaFin.split('T')[0] }); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"><Edit2 className="w-4 h-4" /></button>
                  {!p.activo && <button onClick={() => activarMutation.mutate(p.id)} className="px-3 py-1.5 text-xs border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium">Activar</button>}
                </div>
              </div>
            </div>
          ))}
          {(data ?? []).length === 0 && <div className="text-center py-12 text-slate-400"><Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No hay períodos registrados</p></div>}
        </div>
      )}
      {modalCrear && (
        <Modal titulo="Crear nuevo período" onClose={() => { setModalCrear(false); rC(); }}>
          <FormPeriodo reg={regC} errors={eC} onSubmit={hC(d => crearMutation.mutate(d))} cargando={crearMutation.isPending} onCancel={() => { setModalCrear(false); rC(); }} fechaInicio={fechaInicioC} labelGuardar="Crear período" />
        </Modal>
      )}
      {modalEditar && (
        <Modal titulo={`Editar ${modalEditar.nombre}`} onClose={() => setModalEditar(null)}>
          <FormPeriodo reg={regE} errors={eE} onSubmit={hE(d => editarMutation.mutate({ ...modalEditar, ...d }))} cargando={editarMutation.isPending} onCancel={() => setModalEditar(null)} fechaInicio={fechaInicioE} labelGuardar="Guardar cambios" />
        </Modal>
      )}
    </div>
  );
}

function Reportes() {
  const [reporteActivo, setReporteActivo] = useState<string | null>(null);
  const [gradoId, setGradoId] = useState('');
  const [periodoId, setPeriodoId] = useState('');
  const [datos, setDatos] = useState<unknown[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);

  const { data: grados = [] } = useQuery({ queryKey: ['grados'], queryFn: async () => (await api.get('/grados')).data.datos ?? [] });
  const { data: periodos = [] } = useQuery({ queryKey: ['periodos'], queryFn: async () => (await api.get('/periodos')).data.datos ?? [] });

  const REPORTES = [
    { id: 'boletines-grado', titulo: 'Boletines por grado', desc: 'Notas de todos los estudiantes de un grado', icono: FileText, color: 'bg-blue-500', necesitaGrado: true, sinPeriodo: false },
    { id: 'rendimiento-materia', titulo: 'Rendimiento académico', desc: 'Promedio general por materia', icono: BarChart2, color: 'bg-emerald-500', necesitaGrado: false, sinPeriodo: false },
    { id: 'estudiantes-destacados', titulo: 'Estudiantes destacados', desc: 'Promedio mayor a 4.5', icono: GraduationCap, color: 'bg-amber-500', necesitaGrado: false, sinPeriodo: false },
    { id: 'observaciones-pendientes', titulo: 'Observaciones pendientes', desc: 'No vistas por los padres', icono: AlertCircle, color: 'bg-red-500', necesitaGrado: false, sinPeriodo: true },
  ];

  const generar = async (id: string) => {
    const r = REPORTES.find(x => x.id === id);
    if (r?.necesitaGrado && !gradoId) { alert('Selecciona un grado primero'); return; }
    if (!r?.sinPeriodo && !periodoId) { alert('Selecciona un período primero'); return; }

    setCargando(true);
    setReporteActivo(id);
    try {
      const params: Record<string, string> = {};
      if (r?.necesitaGrado) params.gradoId = gradoId;
      if (!r?.sinPeriodo) params.periodoId = periodoId;
      const res = await api.get(`/reportes/${id}`, { params });
      setDatos(res.data.datos);
    } catch { setDatos([]); }
    finally { setCargando(false); }
  };

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <p className="text-sm font-semibold text-slate-600 mb-3">Filtros</p>
        <div className="grid grid-cols-2 gap-3">
          <select value={gradoId} onChange={e => setGradoId(e.target.value)} className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white">
            <option value="">Grado (si aplica)</option>
            {(grados as { id: string; nombre: string; grupo: string }[]).map(g => <option key={g.id} value={g.id}>{g.nombre}{g.grupo}</option>)}
          </select>
          <select value={periodoId} onChange={e => setPeriodoId(e.target.value)} className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white">
            <option value="">Período</option>
            {(periodos as { id: string; nombre: string }[]).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        {gradoId && periodoId && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
            <button
              onClick={() => descargarExcel('/exportar/notas-grado', { gradoId, periodoId }, setToast)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" /> Exportar notas del grado a Excel
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORTES.map(r => (
          <div key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className={`w-10 h-10 ${r.color} rounded-xl flex items-center justify-center mb-3`}><r.icono className="w-5 h-5 text-white" /></div>
            <h3 className="font-semibold text-slate-800">{r.titulo}</h3>
            <p className="text-sm text-slate-500 mt-1">{r.desc}</p>
            <button onClick={() => generar(r.id)} className="mt-4 w-full py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">Generar reporte</button>
          </div>
        ))}
      </div>

      {reporteActivo && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-700">Resultado: {REPORTES.find(r => r.id === reporteActivo)?.titulo}</h3>
            <button onClick={() => setReporteActivo(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
          {cargando ? (
            <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
          ) : !datos || datos.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">No hay datos disponibles para estos filtros</div>
          ) : (
            <div className="overflow-x-auto p-5">
              <pre className="text-xs bg-slate-50 rounded-xl p-4 overflow-auto max-h-96">{JSON.stringify(datos, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type AuditRow = { id: string; accion: string; entidad: string | null; entidadId: string | null; ip: string | null; createdAt: string; usuario: { email: string; rol: string } | null };

function Auditoria() {
  const [filtroAccion, setFiltroAccion] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['auditoria', filtroAccion],
    queryFn: async () => (await api.get('/auditoria', { params: { accion: filtroAccion || undefined, limite: 50 } })).data,
  });

  const ACCION_COLOR: Record<string, string> = {
    LOGIN: 'bg-emerald-50 text-emerald-700', LOGOUT: 'bg-slate-100 text-slate-600',
    CREAR: 'bg-blue-50 text-blue-700', EDITAR: 'bg-amber-50 text-amber-700',
    ELIMINAR: 'bg-red-50 text-red-700', SUBIR_ARCHIVO: 'bg-violet-50 text-violet-700',
    LOGIN_FALLIDO: 'bg-red-50 text-red-700', MARCAR_VISTO: 'bg-blue-50 text-blue-700',
    DESCARGAR_ARCHIVO: 'bg-slate-50 text-slate-600', CAMBIO_CONTRASENA: 'bg-orange-50 text-orange-700',
    BLOQUEO_CUENTA: 'bg-red-100 text-red-800', VER: 'bg-slate-50 text-slate-500',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={filtroAccion} onChange={e => setFiltroAccion(e.target.value)} className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white">
          <option value="">Todas las acciones</option>
          {Object.keys(ACCION_COLOR).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <p className="text-sm text-slate-400">{data?.meta?.total ?? 0} registro(s) en total</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div> : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100"><tr>{['Usuario','Acción','Entidad','IP','Fecha'].map(h => <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-50">
              {(data?.datos as AuditRow[] ?? []).map(log => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-sm text-slate-700">{log.usuario?.email ?? '—'}</td>
                  <td className="px-5 py-3"><Badge texto={log.accion} color={ACCION_COLOR[log.accion] ?? 'bg-slate-100'} /></td>
                  <td className="px-5 py-3 text-sm text-slate-500">{log.entidad ?? '—'}</td>
                  <td className="px-5 py-3 text-xs font-mono text-slate-400">{log.ip ?? '—'}</td>
                  <td className="px-5 py-3 text-xs text-slate-400">{new Date(log.createdAt).toLocaleString('es-CO')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {(data?.datos ?? []).length === 0 && !isLoading && <div className="text-center py-10 text-slate-400 text-sm">Sin registros de auditoría</div>}
      </div>
    </div>
  );
}

const NAV = [
  { id: 'resumen',     label: 'Resumen',          icono: LayoutDashboard },
  { id: 'estudiantes', label: 'Estudiantes',       icono: GraduationCap },
  { id: 'usuarios',    label: 'Usuarios',          icono: Users },
  { id: 'vinculos',    label: 'Vínculos Padres',   icono: Users },
  { id: 'grados',      label: 'Grados',            icono: Layers },
  { id: 'materias',    label: 'Materias',          icono: BookOpen },
  { id: 'periodos',    label: 'Períodos',          icono: Calendar },
  { id: 'pagos',       label: 'Pagos y cartera',   icono: CreditCard },
  { id: 'reportes',    label: 'Reportes',          icono: FileText },
  { id: 'auditoria',   label: 'Auditoría',         icono: Shield },
  { id: 'documentos',  label: 'Documentos',         icono: FileText },
  { id: 'directorio',  label: 'Directorio',         icono: Users },
  { id: 'comunicados', label: 'Comunicados',         icono: Mail },
] as const;

const TITULOS: Record<Seccion, string> = {
  resumen: 'Resumen general', estudiantes: 'Gestión de estudiantes',
  usuarios: 'Gestión de usuarios', vinculos: 'Vínculos padre-estudiante',
  grados: 'Grados', materias: 'Materias',
  periodos: 'Períodos académicos', reportes: 'Reportes', auditoria: 'Log de auditoría',
  directorio: 'Directorio de docentes', comunicados: 'Comunicados a padres',
  documentos: 'Documentos requeridos', pagos: 'Pagos y cartera',
};

// ─── DIRECTORIO DE DOCENTES ───────────────────────────────────────────────────
type ProfesorDir = {
  id: string;
  nombres: string;
  apellidos: string;
  tipoDocumento: string;
  numeroDocumento: string;
  telefono?: string;
  usuario: { email: string };
  materiaGrados: { materia: { nombre: string }; grado: { nombre: string; grupo: string } }[];
};

function DirectorioDocentes() {
  const [busqueda, setBusqueda] = useState('');

  const { data: profesores = [], isLoading } = useQuery({
    queryKey: ['directorio-profesores'],
    queryFn: async () => {
      const res = await api.get('/usuarios', { params: { rol: 'PROFESOR' } });
      return res.data.datos ?? [];
    },
  });

  type UsuProf = { id: string; email: string; estado: string; perfil: ProfesorDir | null };

  const filtrados = (profesores as UsuProf[]).filter(p =>
    !busqueda || `${p.perfil?.nombres} ${p.perfil?.apellidos} ${p.perfil?.numeroDocumento} ${p.email}`
      .toLowerCase().includes(busqueda.toLowerCase())
  ).filter(p => p.perfil);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-slate-500">Directorio de docentes del colegio</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar docente..."
            className="pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-64" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center py-12 text-slate-400">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay docentes registrados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtrados.map((u: UsuProf) => {
            const p = u.perfil!;
            const materias = p.materiaGrados ?? [];
            const materiasUnicas = [...new Set(materias.map(m => m.materia.nombre))];
            return (
              <div key={u.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                {/* Header con avatar */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-5 py-4 flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                    {p.nombres[0]}{p.apellidos[0]}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-white truncate">{p.nombres} {p.apellidos}</h3>
                    <p className="text-blue-200 text-xs mt-0.5">Docente</p>
                  </div>
                </div>

                {/* Info de contacto */}
                <div className="px-5 py-4 space-y-3">
                  <div className="flex items-center gap-2.5 text-sm text-slate-600">
                    <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Mail className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <span className="truncate">{u.email}</span>
                  </div>

                  {p.telefono && (
                    <div className="flex items-center gap-2.5 text-sm text-slate-600">
                      <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                      <span>{p.telefono}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2.5 text-sm text-slate-600">
                    <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                    <span>{p.tipoDocumento} {p.numeroDocumento}</span>
                  </div>

                  {materiasUnicas.length > 0 && (
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        <BookOpen className="w-3.5 h-3.5 text-violet-600" />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {materiasUnicas.map(m => (
                          <span key={m} className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">{m}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── DOCUMENTOS REQUERIDOS ────────────────────────────────────────────────────
function DocumentosRequeridos() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<{ id: string; nombre: string; descripcion?: string; obligatorio: boolean; orden: number } | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);

  const { data: tipos = [], isLoading } = useQuery({
    queryKey: ['tipos-documento-admin'],
    queryFn: async () => (await api.get('/tipos-documento')).data.datos ?? [],
    staleTime: 0,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ nombre: string; descripcion?: string; obligatorio: boolean; orden: number }>();
  const { register: regE, handleSubmit: hE, reset: resetE, formState: { errors: eE } } = useForm<{ nombre: string; descripcion?: string; obligatorio: boolean; orden: number }>();

  React.useEffect(() => {
    if (editando) resetE({ nombre: editando.nombre, descripcion: editando.descripcion ?? '', obligatorio: editando.obligatorio, orden: editando.orden });
  }, [editando]);

  const crearMutation = useMutation({
    mutationFn: (d: unknown) => api.post('/tipos-documento', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tipos-documento-admin'] }); qc.invalidateQueries({ queryKey: ['tipos-documento'] }); setModal(false); reset(); setToast({ msg: 'Documento creado', tipo: 'ok' }); },
    onError: () => setToast({ msg: 'Error al crear', tipo: 'error' }),
  });

  const editarMutation = useMutation({
    mutationFn: ({ id, ...d }: { id: string; nombre: string; descripcion?: string; obligatorio: boolean; orden: number; activo?: boolean }) => api.put(`/tipos-documento/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tipos-documento-admin'] }); qc.invalidateQueries({ queryKey: ['tipos-documento'] }); setEditando(null); setToast({ msg: 'Documento actualizado', tipo: 'ok' }); },
    onError: () => setToast({ msg: 'Error al actualizar', tipo: 'error' }),
  });

  type TipoDoc = { id: string; nombre: string; descripcion?: string; obligatorio: boolean; activo: boolean; orden: number };

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Configura qué documentos debe subir el padre durante la matrícula</p>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> Nuevo documento
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
      ) : (tipos as TipoDoc[]).length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center py-12 text-slate-400">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay documentos configurados aún</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{['#','Documento','Descripción','Obligatorio','Estado',''].map(h => <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(tipos as TipoDoc[]).map(t => (
                <tr key={t.id} className={`hover:bg-slate-50 transition-colors ${!t.activo ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 text-sm font-mono text-slate-400">{t.orden}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{t.nombre}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{t.descripcion ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${t.obligatorio ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                      {t.obligatorio ? 'Obligatorio' : 'Opcional'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${t.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {t.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => setEditando(t)} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => editarMutation.mutate({ ...t, activo: !t.activo })}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors" title={t.activo ? 'Desactivar' : 'Activar'}>
                        {t.activo ? <Eye className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal titulo="Nuevo tipo de documento" onClose={() => { setModal(false); reset(); }}>
          <form onSubmit={handleSubmit(d => crearMutation.mutate(d))} className="space-y-4">
            <Campo label="Nombre del documento *" error={errors.nombre?.message}>
              <input className={inputCls(errors.nombre?.message)} placeholder="Ej: Cédula del acudiente" maxLength={100}
                {...register('nombre', { required: 'Requerido', maxLength: { value: 100, message: 'Máximo 100' } })} />
            </Campo>
            <Campo label="Descripción (opcional)">
              <input className={inputCls()} placeholder="Ej: Copia legible por ambas caras" maxLength={200}
                {...register('descripcion', { maxLength: { value: 200, message: 'Máximo 200' } })} />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Orden">
                <input type="number" min={1} max={20} className={inputCls(errors.orden?.message)} defaultValue={1}
                  {...register('orden', { required: 'Requerido', valueAsNumber: true, min: { value: 1, message: 'Mínimo 1' } })} />
              </Campo>
              <Campo label="Tipo">
                <label className="flex items-center gap-2 mt-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" className="rounded" defaultChecked {...register('obligatorio')} />
                  Obligatorio
                </label>
              </Campo>
            </div>
            <BotonesForm onCancel={() => { setModal(false); reset(); }} cargando={crearMutation.isPending} labelGuardar="Crear documento" />
          </form>
        </Modal>
      )}

      {editando && (
        <Modal titulo="Editar documento" onClose={() => setEditando(null)}>
          <form key={editando.id} onSubmit={hE(d => editarMutation.mutate({ ...d, id: editando.id }))} className="space-y-4">
            <Campo label="Nombre *" error={eE.nombre?.message}>
              <input className={inputCls(eE.nombre?.message)} maxLength={100}
                {...regE('nombre', { required: 'Requerido', maxLength: { value: 100, message: 'Máximo 100' } })} />
            </Campo>
            <Campo label="Descripción (opcional)">
              <input className={inputCls()} maxLength={200} {...regE('descripcion', { maxLength: { value: 200, message: 'Máximo 200' } })} />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Orden">
                <input type="number" min={1} max={20} className={inputCls(eE.orden?.message)}
                  {...regE('orden', { required: 'Requerido', valueAsNumber: true })} />
              </Campo>
              <Campo label="Tipo">
                <label className="flex items-center gap-2 mt-2 text-sm text-slate-600 cursor-pointer">
                  <input type="checkbox" className="rounded" {...regE('obligatorio')} />
                  Obligatorio
                </label>
              </Campo>
            </div>
            <BotonesForm onCancel={() => setEditando(null)} cargando={editarMutation.isPending} labelGuardar="Guardar cambios" />
          </form>
        </Modal>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [seccion, setSeccion] = useState<Seccion>('resumen');
  const [sidebar, setSidebar] = useState(false);
  const [modalPassword, setModalPassword] = useState(false);
  const { usuario, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => { try { await api.post('/auth/logout'); } catch {} clearAuth(); navigate('/login'); };

  const renderSeccion = () => {
    switch (seccion) {
      case 'resumen':     return <Resumen setSeccion={setSeccion} />;
      case 'estudiantes': return <Estudiantes />;
      case 'usuarios':    return <Usuarios />;
      case 'vinculos':    return <Vinculos />;
      case 'grados':      return <Grados />;
      case 'materias':    return <Materias />;
      case 'periodos':    return (
        <div className="space-y-6">
          <PeriodosAcademicos />
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Gestión manual de períodos</h2>
            <Periodos />
          </div>
        </div>
      );
      case 'pagos':       return <Pagos />;
      case 'reportes':    return <ReportesAdmin />;
      case 'auditoria':   return <Auditoria />;
      case 'directorio':  return <DirectorioDocentes />;
      case 'comunicados': return <Comunicados />;
      case 'documentos':  return <DocumentosRequeridos />;
      default: return <div className="text-slate-400 text-sm bg-white rounded-2xl p-8 text-center border border-slate-100">Módulo en construcción</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {sidebar && <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebar(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 flex flex-col overflow-hidden transition-transform duration-200 ${sidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center"><GraduationCap className="w-5 h-5 text-white" /></div>
            <div><p className="text-white font-bold text-sm">Portal Escolar</p><p className="text-slate-400 text-xs">Administrador</p></div>
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
            <div className="flex-1 min-w-0"><p className="text-white text-xs font-medium truncate">{usuario?.email}</p><p className="text-slate-400 text-xs">Administrador</p></div>
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