import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  UserPlus, CheckCircle, XCircle, Clock, Eye, X,
  AlertCircle, Copy, GraduationCap, Users, FileText, Search, Mail, Send
} from 'lucide-react';
import api from '../services/api';

function Toast({ mensaje, tipo, onClose }: { mensaje: string; tipo: 'ok' | 'error'; onClose: () => void }) {
  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${tipo === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
      {tipo === 'ok' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {mensaje}
      <button onClick={onClose}><X className="w-4 h-4" /></button>
    </div>
  );
}

type MatriculaRow = {
  id: string;
  estadoDocumentos: string;
  fechaMatricula: string;
  observaciones?: string;
  firmaDigitalNombre?: string | null;
  firmaDigitalFecha?: string | null;
  formularioPagado?: boolean;
  formularioComprobanteUrl?: string | null;
  formularioReferencia?: string | null;
  formularioFechaPago?: string | null;
  estudiante: { id: string; nombres: string; apellidos: string; codigoMatricula?: string; grado: { nombre: string; grupo: string } };
  padre: { nombres: string; apellidos: string; usuario: { email: string } };
  verificador?: { email: string };
};

type SolicitudCupoRow = {
  id: string;
  nombreEstudiante: string;
  gradoInteres: string;
  nombreAcudiente: string;
  telefonoAcudiente: string;
  emailAcudiente: string;
  estado: 'PENDIENTE' | 'CONTACTADO' | 'MATRICULADO' | 'DESCARTADO';
  observaciones?: string;
  createdAt: string;
  matricula?: { id: string } | null;
};

const COLOR_ESTADO_SOLICITUD: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-700',
  CONTACTADO: 'bg-blue-100 text-blue-700',
  MATRICULADO: 'bg-emerald-100 text-emerald-700',
  DESCARTADO: 'bg-slate-200 text-slate-500',
};

type FormMatricula = {
  estudiante: {
    nombres: string; apellidos: string; tipoDocumento: string;
    numeroDocumento: string; fechaNacimiento: string; genero: string;
    gradoId: string; direccion?: string; telefono?: string;
  };
  padre: {
    nombres: string; apellidos: string; tipoDocumento: string;
    numeroDocumento: string; email?: string; telefono?: string; parentesco: string;
  };
};

const COLOR_ESTADO: Record<string, string> = {
  PENDIENTE: 'bg-amber-100 text-amber-700',
  VERIFICADO: 'bg-emerald-100 text-emerald-700',
  RECHAZADO: 'bg-red-100 text-red-700',
};

const ICONO_ESTADO: Record<string, React.ReactNode> = {
  PENDIENTE: <Clock className="w-3.5 h-3.5" />,
  VERIFICADO: <CheckCircle className="w-3.5 h-3.5" />,
  RECHAZADO: <XCircle className="w-3.5 h-3.5" />,
};

export default function Matriculas() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'matriculas' | 'solicitudes'>('matriculas');
  const [modal, setModal] = useState(false);
  const [modalDetalle, setModalDetalle] = useState<MatriculaRow | null>(null);
  const [pinGenerado, setPinGenerado] = useState<{ pin: string; emailAcceso: string; emailContacto?: string; codigo: string; nombre: string; magicLinkEnviado?: boolean } | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);
  const [filtro, setFiltro] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [obsVerif, setObsVerif] = useState('');
  const [solicitudCupoIdActual, setSolicitudCupoIdActual] = useState<string | null>(null);

  const { data: grados = [] } = useQuery({ queryKey: ['grados'], queryFn: async () => (await api.get('/grados')).data.datos ?? [] });
  const { data: matriculas = [], isLoading } = useQuery({
    queryKey: ['matriculas', filtroEstado],
    queryFn: async () => (await api.get('/matriculas', { params: filtroEstado ? { estado: filtroEstado } : {} })).data.datos ?? [],
    staleTime: 0,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormMatricula>();

  const crearMutation = useMutation({
    mutationFn: (d: FormMatricula) => api.post('/matriculas', { ...d, solicitudCupoId: solicitudCupoIdActual || undefined }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['matriculas'] });
      qc.invalidateQueries({ queryKey: ['solicitudes-cupo'] });
      setModal(false);
      setSolicitudCupoIdActual(null);
      reset();
      setPinGenerado({
        pin: res.data.datos.pin,
        emailAcceso: res.data.datos.emailAcceso,
        emailContacto: res.data.datos.emailContacto,
        codigo: res.data.datos.codigoMatricula,
        nombre: `${res.data.datos.estudiante.nombres} ${res.data.datos.estudiante.apellidos}`,
        magicLinkEnviado: res.data.datos.magicLinkEnviado,
      });
    },
    onError: (e: unknown) => {
      const d = (e as { response?: { data?: { mensaje?: string; errores?: string[] } } })?.response?.data;
      setToast({ msg: d?.errores?.[0] ?? d?.mensaje ?? 'Error al crear matrícula', tipo: 'error' });
    },
  });

  const verificarMutation = useMutation({
    mutationFn: ({ id, obs }: { id: string; obs?: string }) => api.patch(`/matriculas/${id}/verificar`, { observaciones: obs }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['matriculas'] }); setModalDetalle(null); setToast({ msg: 'Matrícula verificada — estudiante activado', tipo: 'ok' }); },
    onError: () => setToast({ msg: 'Error al verificar', tipo: 'error' }),
  });

  const rechazarMutation = useMutation({
    mutationFn: ({ id, obs }: { id: string; obs?: string }) => api.patch(`/matriculas/${id}/rechazar`, { observaciones: obs }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['matriculas'] }); setModalDetalle(null); setToast({ msg: 'Matrícula rechazada', tipo: 'ok' }); },
    onError: () => setToast({ msg: 'Error al rechazar', tipo: 'error' }),
  });

  const reenviarLinkMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/matriculas/${id}/reenviar-link`),
    onSuccess: (res) => setToast({ msg: res.data.mensaje ?? 'Enlace reenviado', tipo: 'ok' }),
    onError: (e: unknown) => {
      const d = (e as { response?: { data?: { mensaje?: string } } })?.response?.data;
      setToast({ msg: d?.mensaje ?? 'Error al reenviar el enlace', tipo: 'error' });
    },
  });

  const inputCls = (err?: string) =>
    `w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${err ? 'border-red-400' : 'border-slate-200'}`;

  const matriculasFiltradas = (matriculas as MatriculaRow[]).filter(m =>
    !filtro || `${m.estudiante.nombres} ${m.estudiante.apellidos} ${m.estudiante.codigoMatricula} ${m.padre.usuario.email}`
      .toLowerCase().includes(filtro.toLowerCase())
  );

  const iniciarMatriculaDesdeSolicitud = (s: SolicitudCupoRow) => {
    const [nombreEst, ...restoEst] = s.nombreEstudiante.trim().split(' ');
    const [nombreAcu, ...restoAcu] = s.nombreAcudiente.trim().split(' ');
    reset({
      estudiante: { nombres: nombreEst ?? '', apellidos: restoEst.join(' ') } as FormMatricula['estudiante'],
      padre: {
        nombres: nombreAcu ?? '',
        apellidos: restoAcu.join(' '),
        telefono: s.telefonoAcudiente,
        email: s.emailAcudiente,
      } as FormMatricula['padre'],
    });
    setSolicitudCupoIdActual(s.id);
    setTab('matriculas');
    setModal(true);
  };

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {[
          { id: 'matriculas' as const, label: 'Matrículas' },
          { id: 'solicitudes' as const, label: 'Solicitudes de cupo' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${tab === t.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'solicitudes' && (
        <TabSolicitudesCupo onIniciarMatricula={iniciarMatriculaDesdeSolicitud} setToast={setToast} />
      )}

      {tab === 'matriculas' && (
      <>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Buscar por nombre o código..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white">
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="VERIFICADO">Verificado</option>
          <option value="RECHAZADO">Rechazado</option>
        </select>
        <button onClick={() => { setSolicitudCupoIdActual(null); reset({}); setModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
          <UserPlus className="w-4 h-4" /> Nueva matrícula
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
        ) : matriculasFiltradas.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay matrículas registradas</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>{['Código','Estudiante','Grado','Padre/Acudiente','Estado','Fecha',''].map(h =>
                <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {matriculasFiltradas.map(m => (
                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">{m.estudiante.codigoMatricula ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-slate-800">{m.estudiante.nombres} {m.estudiante.apellidos}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">{m.estudiante.grado.nombre}{m.estudiante.grado.grupo}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate-600">{m.padre.nombres} {m.padre.apellidos}</p>
                    <p className="text-xs text-slate-400">{m.padre.usuario.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1 w-fit ${COLOR_ESTADO[m.estadoDocumentos]}`}>
                      {ICONO_ESTADO[m.estadoDocumentos]} {m.estadoDocumentos}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(m.fechaMatricula).toLocaleDateString('es-CO')}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => { setModalDetalle(m); setObsVerif(''); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </>
      )}

      {/* Modal PIN generado */}
      {pinGenerado && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className="text-center mb-5">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="font-bold text-slate-800 text-lg">¡Matrícula creada!</h2>
              <p className="text-sm text-slate-500 mt-1">Entrega estos datos al padre/acudiente</p>
            </div>

            <div className="space-y-3 mb-5">
              {pinGenerado.magicLinkEnviado ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <p className="text-xs text-emerald-700">Se envió un enlace de acceso directo al correo del padre/acudiente. También puede ingresar con el correo y PIN de respaldo.</p>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <p className="text-xs text-amber-700">No se pudo enviar el enlace por correo. Usa el correo y PIN de respaldo, o reenvía el enlace luego desde el detalle de la matrícula.</p>
                </div>
              )}
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-1">Estudiante</p>
                <p className="font-semibold text-slate-800">{pinGenerado.nombre}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-xs text-blue-400 mb-1">Código de matrícula</p>
                <p className="font-mono font-bold text-blue-700 text-lg">{pinGenerado.codigo}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Mail className="w-3 h-3" /> Correo de acceso al portal <span className="text-slate-300">(generado automáticamente, no es el correo real del padre)</span></p>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-sm font-medium text-slate-700 break-all">{pinGenerado.emailAcceso}</p>
                  <button onClick={() => { navigator.clipboard.writeText(pinGenerado.emailAcceso); setToast({ msg: 'Correo copiado', tipo: 'ok' }); }}
                    className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 transition-colors flex-shrink-0">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">Este es el usuario para ingresar al portal</p>
              </div>
              <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                <p className="text-xs text-amber-600 mb-1 font-semibold">PIN de acceso (una sola vez)</p>
                <div className="flex items-center justify-between">
                  <p className="font-mono font-bold text-amber-700 text-2xl tracking-widest">{pinGenerado.pin}</p>
                  <button onClick={() => { navigator.clipboard.writeText(pinGenerado.pin); setToast({ msg: 'PIN copiado', tipo: 'ok' }); }}
                    className="p-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 transition-colors">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-red-500 text-center">⚠️ Anota el correo y PIN — no se pueden recuperar después</p>
            </div>

            <button onClick={() => setPinGenerado(null)}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition">
              Entendido, ya lo anoté
            </button>
          </div>
        </div>
      )}

      {/* Modal detalle y verificación */}
      {modalDetalle && (
        <DetalleMatricula
          matricula={modalDetalle}
          obsVerif={obsVerif}
          setObsVerif={setObsVerif}
          onClose={() => setModalDetalle(null)}
          verificarMutation={verificarMutation}
          rechazarMutation={rechazarMutation}
          reenviarLinkMutation={reenviarLinkMutation}
          setToast={setToast}
        />
      )}

      {/* Modal nueva matrícula */}
      {modal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="font-bold text-slate-800">Nueva matrícula</h2>
              <button onClick={() => { setModal(false); setSolicitudCupoIdActual(null); reset(); }} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit(d => crearMutation.mutate(d))} className="px-6 py-5 space-y-6">
              {solicitudCupoIdActual && (
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
                  <p className="text-xs text-violet-700">Datos precargados desde una solicitud de cupo. Verifica y completa los campos faltantes (documentos, fecha de nacimiento, grado exacto, etc.) antes de crear la matrícula.</p>
                </div>
              )}

              {/* Datos del estudiante */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center"><GraduationCap className="w-4 h-4 text-blue-600" /></div>
                  <h3 className="font-semibold text-slate-700">Datos del estudiante</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Nombres *</label>
                    <input className={inputCls(errors.estudiante?.nombres?.message)} placeholder="Ej: María Fernanda"
                      {...register('estudiante.nombres', { required: 'Requerido' })} />
                    {errors.estudiante?.nombres && <p className="mt-1 text-xs text-red-500">{errors.estudiante.nombres.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Apellidos *</label>
                    <input className={inputCls(errors.estudiante?.apellidos?.message)} placeholder="Ej: García López"
                      {...register('estudiante.apellidos', { required: 'Requerido' })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Tipo documento *</label>
                    <select className={inputCls(errors.estudiante?.tipoDocumento?.message)}
                      {...register('estudiante.tipoDocumento', { required: 'Requerido' })}>
                      <option value="">Seleccionar</option>
                      <option value="RC">RC — Registro Civil</option>
                      <option value="TI">TI — Tarjeta de Identidad</option>
                      <option value="CC">CC — Cédula</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Número documento *</label>
                    <input className={inputCls(errors.estudiante?.numeroDocumento?.message)} placeholder="Número"
                      {...register('estudiante.numeroDocumento', { required: 'Requerido' })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Fecha de nacimiento *</label>
                    <input type="date" className={inputCls(errors.estudiante?.fechaNacimiento?.message)}
                      {...register('estudiante.fechaNacimiento', { required: 'Requerido' })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Género *</label>
                    <select className={inputCls(errors.estudiante?.genero?.message)}
                      {...register('estudiante.genero', { required: 'Requerido' })}>
                      <option value="">Seleccionar</option>
                      <option value="MASCULINO">Masculino</option>
                      <option value="FEMENINO">Femenino</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Grado *</label>
                    <select className={inputCls(errors.estudiante?.gradoId?.message)}
                      {...register('estudiante.gradoId', { required: 'Requerido' })}>
                      <option value="">Seleccionar grado</option>
                      {(grados as { id: string; nombre: string; grupo: string; nivel: string }[]).map(g => (
                        <option key={g.id} value={g.id}>{g.nombre}{g.grupo} — {g.nivel}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Dirección (opcional)</label>
                    <input className={inputCls()} placeholder="Dirección" {...register('estudiante.direccion')} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Teléfono (opcional)</label>
                    <input className={inputCls()} placeholder="Teléfono" {...register('estudiante.telefono')} />
                  </div>
                </div>
              </div>

              {/* Datos del padre */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center"><Users className="w-4 h-4 text-violet-600" /></div>
                  <h3 className="font-semibold text-slate-700">Datos del padre/acudiente</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Nombres *</label>
                    <input className={inputCls(errors.padre?.nombres?.message)} placeholder="Ej: Carlos"
                      {...register('padre.nombres', { required: 'Requerido' })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Apellidos *</label>
                    <input className={inputCls(errors.padre?.apellidos?.message)} placeholder="Ej: García"
                      {...register('padre.apellidos', { required: 'Requerido' })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Tipo documento *</label>
                    <select className={inputCls(errors.padre?.tipoDocumento?.message)}
                      {...register('padre.tipoDocumento', { required: 'Requerido' })}>
                      <option value="">Seleccionar</option>
                      <option value="CC">CC — Cédula</option>
                      <option value="CE">CE — Extranjería</option>
                      <option value="PASAPORTE">Pasaporte</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Número documento *</label>
                    <input className={inputCls(errors.padre?.numeroDocumento?.message)} placeholder="Número"
                      {...register('padre.numeroDocumento', { required: 'Requerido' })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Teléfono (opcional)</label>
                    <input className={inputCls()} placeholder="Teléfono" {...register('padre.telefono')} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Correo personal del acudiente * <span className="text-slate-300">(para notificaciones y el enlace de acceso)</span></label>
                    <input type="email" className={inputCls(errors.padre?.email?.message)} placeholder="correo@ejemplo.com"
                      {...register('padre.email', { required: 'Requerido para enviar el acceso a matrícula', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email inválido' } })} />
                    {errors.padre?.email && <p className="mt-1 text-xs text-red-500">{errors.padre.email.message}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Parentesco *</label>
                    <select className={inputCls(errors.padre?.parentesco?.message)}
                      {...register('padre.parentesco', { required: 'Requerido' })}>
                      <option value="">Seleccionar</option>
                      {['padre','madre','acudiente','abuelo','abuela','tio','tia','otro'].map(p => (
                        <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-xs text-blue-700">
                  <strong>Acceso automático:</strong> El sistema enviará un enlace de acceso directo al correo del padre/acudiente y generará un correo y PIN de respaldo. Estos datos solo se muestran una vez — anótalos antes de cerrar.
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                <button type="button" onClick={() => { setModal(false); setSolicitudCupoIdActual(null); reset(); }} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
                <button type="submit" disabled={crearMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
                  <UserPlus className="w-4 h-4" />
                  {crearMutation.isPending ? 'Creando...' : 'Crear matrícula'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DETALLE COMPLETO DE MATRÍCULA PARA SECRETARIO ───────────────────────────
function DetalleMatricula({ matricula, obsVerif, setObsVerif, onClose, verificarMutation, rechazarMutation, reenviarLinkMutation, setToast }: {
  matricula: MatriculaRow;
  obsVerif: string;
  setObsVerif: (v: string) => void;
  onClose: () => void;
  verificarMutation: { mutate: (d: { id: string; obs?: string }) => void; isPending: boolean };
  rechazarMutation: { mutate: (d: { id: string; obs?: string }) => void; isPending: boolean };
  reenviarLinkMutation: { mutate: (id: string) => void; isPending: boolean };
  setToast: (t: { msg: string; tipo: 'ok' | 'error' } | null) => void;
}) {
  const estudianteId = matricula.estudiante.id;

  const { data: datosPadre } = useQuery({
    queryKey: ['detalle-padre-matricula', matricula.id],
    queryFn: async () => {
      const res = await api.get('/usuarios', { params: { rol: 'PADRE' } });
      const padres = res.data.datos ?? [];
      return padres.find((p: { email: string; perfil?: unknown }) => p.email === matricula.padre.usuario.email);
    },
  });

  const { data: datosAdicionales } = useQuery({
    queryKey: ['datos-adicionales-matricula', estudianteId],
    queryFn: async () => (await api.get(`/estudiantes/${estudianteId}/datos-adicionales`)).data.datos,
  });

  const { data: contactos = [] } = useQuery({
    queryKey: ['contactos-matricula', estudianteId],
    queryFn: async () => (await api.get(`/estudiantes/${estudianteId}/contactos`)).data.datos ?? [],
  });

  const { data: archivos = [] } = useQuery({
    queryKey: ['archivos-matricula-sec', estudianteId],
    queryFn: async () => (await api.get(`/archivos/estudiante/${estudianteId}`)).data.datos ?? [],
  });

  const verArchivo = async (archivoId: string) => {
    try {
      const res = await api.get(`/archivos/${archivoId}/descargar`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch { setToast({ msg: 'Error al abrir el archivo', tipo: 'error' }); }
  };

  type Contacto = { id: string; nombres: string; apellidos: string; parentesco: string; telefono: string; telefono2?: string; orden: number };
  type ArchivoRow2 = { id: string; nombreOriginal: string; tamanoBytes: number; tipoDocumento?: { nombre: string }; estadoRevision: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO'; motivoRechazo?: string | null };
  const qc = useQueryClient();
  const [modalRechazoDoc, setModalRechazoDoc] = useState<ArchivoRow2 | null>(null);
  const [motivoRechazoDoc, setMotivoRechazoDoc] = useState('');

  const aprobarDocMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/archivos/${id}/aprobar`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['archivos-matricula-sec', estudianteId] }); setToast({ msg: 'Documento aprobado', tipo: 'ok' }); },
    onError: () => setToast({ msg: 'Error al aprobar documento', tipo: 'error' }),
  });

  const rechazarDocMutation = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) => api.patch(`/archivos/${id}/rechazar`, { motivoRechazo: motivo }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['archivos-matricula-sec', estudianteId] });
      setModalRechazoDoc(null);
      setMotivoRechazoDoc('');
      setToast({ msg: 'Documento rechazado', tipo: 'ok' });
    },
    onError: (e: unknown) => {
      const d = (e as { response?: { data?: { errores?: string[]; mensaje?: string } } })?.response?.data;
      setToast({ msg: d?.errores?.[0] ?? d?.mensaje ?? 'Error al rechazar documento', tipo: 'error' });
    },
  });

  const BADGE_DOC: Record<string, string> = {
    PENDIENTE: 'bg-amber-100 text-amber-700',
    APROBADO: 'bg-emerald-100 text-emerald-700',
    RECHAZADO: 'bg-red-100 text-red-700',
  };

  const verificarFormularioMutation = useMutation({
    mutationFn: () => api.patch(`/matriculas/${matricula.id}/formulario/verificar`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['matriculas'] });
      setToast({ msg: 'Pago del formulario verificado', tipo: 'ok' });
    },
    onError: (e: unknown) => {
      const d = (e as { response?: { data?: { mensaje?: string } } })?.response?.data;
      setToast({ msg: d?.mensaje ?? 'Error al verificar el pago', tipo: 'error' });
    },
  });

  const verComprobanteFormulario = async () => {
    try {
      const res = await api.get(`/matriculas/${matricula.id}/formulario/archivo`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch { setToast({ msg: 'Error al abrir el comprobante', tipo: 'error' }); }
  };
  type PadreDetalle = { perfil?: { telefono?: string; telefonoAlt?: string; direccion?: string; ocupacion?: string; emailContacto?: string } };

  const perfil = (datosPadre as PadreDetalle)?.perfil;
  const PARENTESCO: Record<string, string> = { padre:'Padre', madre:'Madre', acudiente:'Acudiente', abuelo:'Abuelo', abuela:'Abuela', tio:'Tío', tia:'Tía', hermano:'Hermano', hermana:'Hermana', otro:'Otro' };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-none">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-bold text-slate-800">Detalle de matrícula</h2>
            <p className="text-xs text-slate-400">{matricula.estudiante.nombres} {matricula.estudiante.apellidos} · {matricula.estudiante.codigoMatricula}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Estado */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl w-fit text-sm font-medium ${COLOR_ESTADO[matricula.estadoDocumentos]}`}>
              {ICONO_ESTADO[matricula.estadoDocumentos]} {matricula.estadoDocumentos}
            </div>
            {matricula.estadoDocumentos === 'PENDIENTE' && (
              <button onClick={() => reenviarLinkMutation.mutate(matricula.id)} disabled={reenviarLinkMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 text-xs font-medium rounded-xl hover:bg-blue-100 transition disabled:opacity-50">
                <Send className="w-3.5 h-3.5" /> {reenviarLinkMutation.isPending ? 'Enviando...' : 'Reenviar enlace de acceso'}
              </button>
            )}
          </div>

          {/* Info básica */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Información básica</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Código', matricula.estudiante.codigoMatricula ?? '—'],
                ['Grado', `${matricula.estudiante.grado.nombre}${matricula.estudiante.grado.grupo}`],
                ['Correo de acceso', matricula.padre.usuario.email],
                ['Fecha matrícula', new Date(matricula.fechaMatricula).toLocaleDateString('es-CO')],
              ].map(([k, v]) => (
                <div key={k} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-0.5">{k}</p>
                  <p className="text-sm font-medium text-slate-700 break-words">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Datos del acudiente */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Datos del acudiente</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Nombre', `${matricula.padre.nombres} ${matricula.padre.apellidos}`],
                ['Teléfono', perfil?.telefono ?? '—'],
                ['Tel. alternativo', perfil?.telefonoAlt ?? '—'],
                ['Ocupación', perfil?.ocupacion ?? '—'],
                ['Dirección', perfil?.direccion ?? '—'],
                ['Correo personal (notificaciones)', perfil?.emailContacto ?? '—'],
              ].map(([k, v]) => (
                <div key={k} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-0.5">{k}</p>
                  <p className="text-sm font-medium text-slate-700 break-words">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Contactos de emergencia */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Contactos de emergencia ({(contactos as Contacto[]).length}/3)</p>
            {(contactos as Contacto[]).length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs text-amber-700">El padre aún no ha registrado contactos de emergencia.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(contactos as Contacto[]).map(c => (
                  <div key={c.id} className="bg-slate-50 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">{c.orden}°</div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{c.nombres} {c.apellidos} — {PARENTESCO[c.parentesco] ?? c.parentesco}</p>
                      <p className="text-xs text-slate-500">{c.telefono}{c.telefono2 ? ` · ${c.telefono2}` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Datos de salud */}
          {datosAdicionales && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Datos de salud del estudiante</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['EPS', datosAdicionales.eps ?? '—'],
                  ['Grupo sanguíneo', datosAdicionales.grupoSanguineo ?? '—'],
                  ['Médico', datosAdicionales.contactoMedico ?? '—'],
                  ['Tel. médico', datosAdicionales.telefonoMedico ?? '—'],
                ].map(([k, v]) => (
                  <div key={k} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-400 mb-0.5">{k}</p>
                    <p className="text-sm font-medium text-slate-700">{v}</p>
                  </div>
                ))}
                {datosAdicionales.alergias && (
                  <div className="col-span-2 bg-red-50 rounded-xl p-3">
                    <p className="text-xs text-red-400 mb-0.5">Alergias</p>
                    <p className="text-sm text-red-700">{datosAdicionales.alergias}</p>
                  </div>
                )}
                {datosAdicionales.condicionesMedicas && (
                  <div className="col-span-2 bg-amber-50 rounded-xl p-3">
                    <p className="text-xs text-amber-500 mb-0.5">Condiciones médicas</p>
                    <p className="text-sm text-amber-700">{datosAdicionales.condicionesMedicas}</p>
                  </div>
                )}
                {datosAdicionales.medicamentos && (
                  <div className="col-span-2 bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-400 mb-0.5">Medicamentos</p>
                    <p className="text-sm text-slate-700">{datosAdicionales.medicamentos}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Documentos subidos */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Documentos subidos ({(archivos as ArchivoRow2[]).length})</p>
            {(archivos as ArchivoRow2[]).length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs text-amber-700">El padre aún no ha subido documentos.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(archivos as ArchivoRow2[]).map(a => (
                  <div key={a.id} className="bg-slate-50 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {a.tipoDocumento && <p className="text-xs text-blue-600 font-medium">{a.tipoDocumento.nombre}</p>}
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${BADGE_DOC[a.estadoRevision]}`}>{a.estadoRevision}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-800 truncate">{a.nombreOriginal}</p>
                        <p className="text-xs text-slate-400">{(a.tamanoBytes / 1024).toFixed(0)} KB</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => verArchivo(a.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition">
                          <Eye className="w-3.5 h-3.5" /> Ver
                        </button>
                        {a.estadoRevision === 'PENDIENTE' && (
                          <>
                            <button onClick={() => aprobarDocMutation.mutate(a.id)} disabled={aprobarDocMutation.isPending}
                              className="px-2.5 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition disabled:opacity-50">
                              Aprobar
                            </button>
                            <button onClick={() => { setModalRechazoDoc(a); setMotivoRechazoDoc(''); }}
                              className="px-2.5 py-1.5 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100 transition">
                              Rechazar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {a.estadoRevision === 'RECHAZADO' && a.motivoRechazo && (
                      <p className="text-xs text-red-600 mt-2">Motivo: {a.motivoRechazo}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pago del formulario de matrícula */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Pago del formulario de matrícula</p>
            {matricula.formularioPagado ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <p className="text-sm text-emerald-800">Pago verificado</p>
                {matricula.formularioFechaPago && <p className="text-xs text-emerald-600 mt-0.5">{new Date(matricula.formularioFechaPago).toLocaleString('es-CO')}</p>}
              </div>
            ) : matricula.formularioComprobanteUrl ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                <p className="text-xs text-amber-700">El padre reportó el pago{matricula.formularioReferencia ? ` (ref. ${matricula.formularioReferencia})` : ''}. Verifica el comprobante antes de aprobar.</p>
                <div className="flex gap-2">
                  <button onClick={verComprobanteFormulario}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition">
                    <Eye className="w-3.5 h-3.5" /> Ver comprobante
                  </button>
                  <button onClick={() => verificarFormularioMutation.mutate()} disabled={verificarFormularioMutation.isPending}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition disabled:opacity-50">
                    {verificarFormularioMutation.isPending ? 'Verificando...' : 'Verificar pago'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500">El padre aún no ha reportado el pago del formulario.</p>
              </div>
            )}
          </div>

          {/* Firma digital */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Firma digital</p>
            {matricula.firmaDigitalNombre ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <p className="text-sm text-emerald-800">Firmado por <strong>{matricula.firmaDigitalNombre}</strong></p>
                {matricula.firmaDigitalFecha && <p className="text-xs text-emerald-600 mt-0.5">{new Date(matricula.firmaDigitalFecha).toLocaleString('es-CO')}</p>}
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs text-amber-700">El padre aún no ha firmado el formulario.</p>
              </div>
            )}
          </div>

          {/* Observaciones previas */}
          {matricula.observaciones && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs text-amber-600 font-semibold mb-1">Observaciones anteriores</p>
              <p className="text-sm text-amber-800">{matricula.observaciones}</p>
            </div>
          )}

          {/* Acciones de verificación */}
          {matricula.estadoDocumentos === 'PENDIENTE' && (
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <p className="text-sm font-semibold text-slate-600">Verificación</p>
              <textarea value={obsVerif} onChange={e => setObsVerif(e.target.value)}
                placeholder="Observaciones (opcional)..." rows={2}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              <div className="flex gap-2">
                <button onClick={() => verificarMutation.mutate({ id: matricula.id, obs: obsVerif })}
                  disabled={verificarMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition disabled:opacity-50">
                  <CheckCircle className="w-4 h-4" /> {verificarMutation.isPending ? 'Verificando...' : 'Verificar y activar'}
                </button>
                <button onClick={() => rechazarMutation.mutate({ id: matricula.id, obs: obsVerif })}
                  disabled={rechazarMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition disabled:opacity-50">
                  <XCircle className="w-4 h-4" /> {rechazarMutation.isPending ? 'Rechazando...' : 'Rechazar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {modalRechazoDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h2 className="font-bold text-slate-800 mb-1">Rechazar documento</h2>
            <p className="text-sm text-slate-500 mb-4">{modalRechazoDoc.nombreOriginal}</p>
            <textarea value={motivoRechazoDoc} onChange={e => setMotivoRechazoDoc(e.target.value)}
              placeholder="Motivo del rechazo (mínimo 10 caracteres)..." rows={3} maxLength={300}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            <p className="text-xs text-right text-slate-400 mt-0.5">{motivoRechazoDoc.length}/300</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setModalRechazoDoc(null)} className="flex-1 py-2.5 text-sm text-slate-600">Cancelar</button>
              <button onClick={() => rechazarDocMutation.mutate({ id: modalRechazoDoc.id, motivo: motivoRechazoDoc })}
                disabled={rechazarDocMutation.isPending || motivoRechazoDoc.trim().length < 10}
                className="flex-1 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition disabled:opacity-50">
                {rechazarDocMutation.isPending ? 'Rechazando...' : 'Rechazar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SOLICITUDES DE CUPO (público → secretario) ──────────────────────────────
function TabSolicitudesCupo({ onIniciarMatricula, setToast }: {
  onIniciarMatricula: (s: SolicitudCupoRow) => void;
  setToast: (t: { msg: string; tipo: 'ok' | 'error' } | null) => void;
}) {
  const qc = useQueryClient();
  const [filtroEstado, setFiltroEstado] = useState('');
  const [modalDescartar, setModalDescartar] = useState<SolicitudCupoRow | null>(null);
  const [motivoDescarte, setMotivoDescarte] = useState('');

  const { data: solicitudes = [], isLoading } = useQuery({
    queryKey: ['solicitudes-cupo', filtroEstado],
    queryFn: async () => (await api.get('/solicitudes-cupo', { params: filtroEstado ? { estado: filtroEstado } : {} })).data.datos ?? [],
    staleTime: 0,
  });

  const estadoMutation = useMutation({
    mutationFn: ({ id, estado, observaciones }: { id: string; estado: string; observaciones?: string }) =>
      api.patch(`/solicitudes-cupo/${id}/estado`, { estado, observaciones }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solicitudes-cupo'] });
      setModalDescartar(null);
      setMotivoDescarte('');
      setToast({ msg: 'Solicitud actualizada', tipo: 'ok' });
    },
    onError: (e: unknown) => {
      const d = (e as { response?: { data?: { mensaje?: string } } })?.response?.data;
      setToast({ msg: d?.mensaje ?? 'Error al actualizar la solicitud', tipo: 'error' });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white">
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="CONTACTADO">Contactado</option>
          <option value="MATRICULADO">Matriculado</option>
          <option value="DESCARTADO">Descartado</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
        ) : (solicitudes as SolicitudCupoRow[]).length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay solicitudes de cupo</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>{['Estudiante','Grado interés','Acudiente','Contacto','Estado','Fecha',''].map(h =>
                  <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(solicitudes as SolicitudCupoRow[]).map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 whitespace-nowrap">{s.nombreEstudiante}</td>
                    <td className="px-4 py-3"><span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">{s.gradoInteres}</span></td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{s.nombreAcudiente}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      <p>{s.telefonoAcudiente}</p>
                      <p className="truncate max-w-[180px]">{s.emailAcudiente}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full w-fit ${COLOR_ESTADO_SOLICITUD[s.estado]}`}>{s.estado}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{new Date(s.createdAt).toLocaleDateString('es-CO')}</td>
                    <td className="px-4 py-3">
                      {s.estado === 'PENDIENTE' || s.estado === 'CONTACTADO' ? (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => onIniciarMatricula(s)}
                            className="px-2.5 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition whitespace-nowrap">
                            Iniciar matrícula
                          </button>
                          {s.estado === 'PENDIENTE' && (
                            <button onClick={() => estadoMutation.mutate({ id: s.id, estado: 'CONTACTADO' })} disabled={estadoMutation.isPending}
                              className="px-2.5 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200 transition disabled:opacity-50 whitespace-nowrap">
                              Contactado
                            </button>
                          )}
                          <button onClick={() => { setModalDescartar(s); setMotivoDescarte(''); }}
                            className="px-2.5 py-1.5 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100 transition whitespace-nowrap">
                            Descartar
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalDescartar && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h2 className="font-bold text-slate-800 mb-1">Descartar solicitud</h2>
            <p className="text-sm text-slate-500 mb-4">{modalDescartar.nombreEstudiante} — {modalDescartar.nombreAcudiente}</p>
            <textarea value={motivoDescarte} onChange={e => setMotivoDescarte(e.target.value)}
              placeholder="Motivo (opcional)..." rows={3} maxLength={300}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setModalDescartar(null)} className="flex-1 py-2.5 text-sm text-slate-600">Cancelar</button>
              <button onClick={() => estadoMutation.mutate({ id: modalDescartar.id, estado: 'DESCARTADO', observaciones: motivoDescarte })}
                disabled={estadoMutation.isPending}
                className="flex-1 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition disabled:opacity-50">
                {estadoMutation.isPending ? 'Descartando...' : 'Descartar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}