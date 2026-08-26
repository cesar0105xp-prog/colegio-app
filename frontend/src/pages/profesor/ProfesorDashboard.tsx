import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  BookOpen, Users, MessageSquare, LogOut, Menu, Plus,
  Save, AlertCircle, CheckCircle, X, ChevronDown, ChevronUp,
  GraduationCap, BarChart2, Edit2, Eye, FileSpreadsheet, Trash2,
  Calendar, KeyRound, Mail, Phone, CreditCard, BookOpen as BookOpenIcon, CalendarCheck
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import CalendarioAcademico from '../../components/CalendarioAcademico';
import { CambiarPassword } from '../../components/CambiarPassword';
import Asistencia from '../../components/Asistencia';

type Seccion = 'notas' | 'observaciones' | 'asistencia' | 'calendario' | 'estudiantes' | 'perfil';

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

function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
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

const COLOR_NOTA = (n: number | null) => {
  if (n === null) return 'text-slate-400';
  if (n >= 90) return 'text-emerald-600 font-bold';
  if (n >= 70) return 'text-blue-600 font-semibold';
  return 'text-red-600 font-bold';
};

const TIPO_ACTIVIDAD = ['TAREA','TALLER','EXAMEN','QUIZ','PROYECTO','EXPOSICION','PARTICIPACION'];
const LABEL_TIPO: Record<string, string> = { TAREA:'Tarea', TALLER:'Taller', EXAMEN:'Examen', QUIZ:'Quiz', PROYECTO:'Proyecto', EXPOSICION:'Exposición', PARTICIPACION:'Participación' };
const TIPO_OBSERVACION = ['POSITIVA','NEGATIVA','NEUTRA','DISCIPLINARIA','ACADEMICA','CONVIVENCIA'];
const LABEL_OBS: Record<string, string> = { POSITIVA:'Positiva', NEGATIVA:'Negativa', NEUTRA:'Neutra', DISCIPLINARIA:'Disciplinaria', ACADEMICA:'Académica', CONVIVENCIA:'Convivencia' };
const COLOR_OBS: Record<string, string> = { POSITIVA:'bg-emerald-100 text-emerald-800', NEGATIVA:'bg-red-100 text-red-800', NEUTRA:'bg-slate-100 text-slate-700', DISCIPLINARIA:'bg-orange-100 text-orange-800', ACADEMICA:'bg-blue-100 text-blue-800', CONVIVENCIA:'bg-purple-100 text-purple-800' };

const MAX_DESCRIPCION = 1000;

// ─── TIPOS ────────────────────────────────────────────────────────────────────
type Grado = { id: string; nombre: string; grupo: string; nivel: string };
type Materia = { id: string; nombre: string };
type Periodo = { id: string; nombre: string; numero: number; activo: boolean };
type Actividad = { id: string; nombre: string; tipo: string; porcentaje: number; descripcion?: string; fechaEntrega?: string };
type Estudiante = { id: string; nombres: string; apellidos: string; numeroDocumento: string };

// ─── MÓDULO NOTAS ─────────────────────────────────────────────────────────────
function ModuloNotas() {
  const qc = useQueryClient();
  const [gradoId, setGradoId] = useState('');
  const [materiaId, setMateriaId] = useState('');
  const [periodoId, setPeriodoId] = useState('');
  const [modalActividad, setModalActividad] = useState(false);
  const [actividadEditar, setActividadEditar] = useState<Actividad | null>(null);
  const [actividadEliminar, setActividadEliminar] = useState<Actividad | null>(null);
  const [vistaNotas, setVistaNotas] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);

  const { data: grados = [] } = useQuery({ queryKey: ['grados'], queryFn: async () => (await api.get('/grados')).data.datos ?? [] });
  const { data: periodos = [] } = useQuery({ queryKey: ['periodos'], queryFn: async () => (await api.get('/periodos')).data.datos ?? [] });

  const { data: gradoDetalle } = useQuery({
    queryKey: ['grado-detalle', gradoId],
    queryFn: async () => (await api.get('/grados')).data.datos?.find((g: Grado & { materiaGrados: { materia: Materia; profesorId: string }[] }) => g.id === gradoId),
    enabled: !!gradoId,
  });
  const materias: Materia[] = gradoDetalle?.materiaGrados?.map((mg: { materia: Materia }) => mg.materia) ?? [];

  const { data: actividadesData } = useQuery({
    queryKey: ['actividades', materiaId, gradoId, periodoId],
    queryFn: async () => (await api.get('/actividades', { params: { materiaId, gradoId, periodoId } })).data,
    enabled: !!(materiaId && gradoId && periodoId),
  });
  const actividades: Actividad[] = actividadesData?.lista ?? actividadesData?.datos ?? [];
  const porcentajeTotal = actividadesData?.meta?.totalPorcentaje ?? actividades.reduce((a, b) => a + b.porcentaje, 0);
  const porcentajeRestante = 100 - porcentajeTotal;

  const { data: estudiantesData } = useQuery({
    queryKey: ['estudiantes-grado', gradoId],
    queryFn: async () => (await api.get('/estudiantes', { params: { gradoId } })).data.datos ?? [],
    enabled: !!gradoId,
  });
  const estudiantes: Estudiante[] = estudiantesData ?? [];

  const { data: calificacionesData, refetch: refetchCals } = useQuery({
    queryKey: ['calificaciones-tabla', gradoId, materiaId, periodoId],
    queryFn: async () => {
      const res = await Promise.all(
        estudiantes.map(e =>
          api.get(`/boletin/${e.id}`, { params: { periodoId } })
            .then(r => ({ estudianteId: e.id, boletin: r.data.datos?.boletin ?? [] }))
            .catch(() => ({ estudianteId: e.id, boletin: [] }))
        )
      );
      return res;
    },
    enabled: !!(gradoId && materiaId && periodoId && vistaNotas && estudiantes.length > 0),
  });

  const { register: regAct, handleSubmit: hAct, reset: rAct, watch: wAct, formState: { errors: eAct } } = useForm<{ nombre: string; tipo: string; porcentaje: number; descripcion?: string; fechaEntrega?: string }>();

  const crearActividadMutation = useMutation({
    mutationFn: (d: unknown) => api.post('/actividades', { ...d as object, materiaId, gradoId, periodoId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['actividades'] }); setModalActividad(false); rAct(); setToast({ msg: 'Actividad creada', tipo: 'ok' }); },
    onError: (e: unknown) => { const d = (e as { response?: { data?: { mensaje?: string; errores?: string[] } } })?.response?.data; setToast({ msg: d?.errores?.[0] ?? d?.mensaje ?? 'Error', tipo: 'error' }); },
  });

  const editarActividadMutation = useMutation({
    mutationFn: ({ id, ...d }: { id: string; nombre: string; tipo: string; descripcion?: string; fechaEntrega?: string }) => api.put(`/actividades/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['actividades'] }); setActividadEditar(null); setToast({ msg: 'Actividad actualizada', tipo: 'ok' }); },
    onError: (e: unknown) => { const d = (e as { response?: { data?: { mensaje?: string } } })?.response?.data; setToast({ msg: d?.mensaje ?? 'Error', tipo: 'error' }); },
  });

  const eliminarActividadMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/actividades/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['actividades'] }); setActividadEliminar(null); setToast({ msg: 'Actividad eliminada', tipo: 'ok' }); },
    onError: (e: unknown) => { const d = (e as { response?: { data?: { mensaje?: string } } })?.response?.data; setToast({ msg: d?.mensaje ?? 'Error al eliminar', tipo: 'error' }); },
  });

  const notaMutation = useMutation({
    mutationFn: (d: { actividadId: string; estudianteId: string; valor: number; observacion?: string }) => api.post('/calificaciones', d),
    onSuccess: () => { refetchCals(); setToast({ msg: 'Nota guardada', tipo: 'ok' }); },
    onError: () => setToast({ msg: 'Error al guardar la nota', tipo: 'error' }),
  });

  const [notasTemp, setNotasTemp] = useState<Record<string, Record<string, string>>>({});

  const guardarNota = (actividadId: string, estudianteId: string) => {
    const valor = parseFloat(notasTemp[estudianteId]?.[actividadId] ?? '');
    if (isNaN(valor) || valor < 0 || valor > 100) { setToast({ msg: 'La nota debe estar entre 0 y 100', tipo: 'error' }); return; }
    notaMutation.mutate({ actividadId, estudianteId, valor });
  };

  const listo = !!(gradoId && materiaId && periodoId);
  const watchDescripcionAct = wAct('descripcion');

  return (
    <div className="space-y-5">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <p className="text-sm font-semibold text-slate-600 mb-3">Selecciona el contexto</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Grado</label>
            <select value={gradoId} onChange={e => { setGradoId(e.target.value); setMateriaId(''); setVistaNotas(false); }} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Seleccionar</option>
              {(grados as Grado[]).map(g => <option key={g.id} value={g.id}>{g.nombre}{g.grupo}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Materia</label>
            <select value={materiaId} onChange={e => { setMateriaId(e.target.value); setVistaNotas(false); }} disabled={!gradoId} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50">
              <option value="">Seleccionar</option>
              {materias.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Período</label>
            <select value={periodoId} onChange={e => { setPeriodoId(e.target.value); setVistaNotas(false); }} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Seleccionar</option>
              {(periodos as Periodo[]).map(p => <option key={p.id} value={p.id}>{p.nombre}{p.activo ? ' ✓' : ''}</option>)}
            </select>
          </div>
        </div>
        {gradoId && periodoId && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
            <button
              onClick={() => descargarExcel(`/exportar/notas-profesor`, { gradoId, periodoId }, setToast)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" /> Exportar notas a Excel
            </button>
          </div>
        )}
      </div>

      {listo && (
        <>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <BarChart2 className="w-5 h-5 text-slate-400" />
                <h3 className="font-semibold text-slate-700">Actividades del período</h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-slate-400">Porcentaje asignado</p>
                  <p className={`text-lg font-bold ${porcentajeTotal === 100 ? 'text-emerald-600' : porcentajeTotal > 100 ? 'text-red-600' : 'text-blue-600'}`}>{porcentajeTotal}%</p>
                </div>
                <button onClick={() => setModalActividad(true)} disabled={porcentajeRestante <= 0}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
                  <Plus className="w-4 h-4" /> Nueva
                </button>
              </div>
            </div>

            <div className="px-5 py-3 border-b border-slate-50">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${porcentajeTotal === 100 ? 'bg-emerald-500' : porcentajeTotal > 100 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(porcentajeTotal, 100)}%` }} />
                </div>
                <span className="text-xs text-slate-400 w-16 text-right">
                  {porcentajeRestante > 0 ? `Faltan ${porcentajeRestante}%` : porcentajeTotal === 100 ? '¡Completo!' : `Excede ${porcentajeTotal - 100}%`}
                </span>
              </div>
            </div>

            {actividades.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <BarChart2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay actividades para este período</p>
                <button onClick={() => setModalActividad(true)} className="mt-2 text-blue-600 text-sm font-medium hover:underline">Crear la primera</button>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {actividades.map(act => (
                  <div key={act.id} className="px-5 py-3 flex items-center gap-4">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg font-medium flex-shrink-0">{LABEL_TIPO[act.tipo]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{act.nombre}</p>
                      {act.descripcion && <p className="text-xs text-slate-400 break-words line-clamp-2">{act.descripcion}</p>}
                      {act.fechaEntrega && <p className="text-xs text-slate-400">Entrega: {new Date(act.fechaEntrega).toLocaleDateString('es-CO')}</p>}
                    </div>
                    <span className="text-lg font-bold text-blue-600 flex-shrink-0">{act.porcentaje}%</span>
                    <div className="flex gap-1">
                      <button onClick={() => setActividadEditar(act)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => setActividadEliminar(act)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {actividades.length > 0 && (
            <button onClick={() => setVistaNotas(!vistaNotas)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-blue-200 text-blue-700 font-semibold rounded-2xl hover:bg-blue-50 transition-colors shadow-sm">
              {vistaNotas ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              {vistaNotas ? 'Ocultar tabla de notas' : 'Ver e ingresar notas de estudiantes'}
            </button>
          )}

          {vistaNotas && actividades.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-700">Notas de estudiantes</h3>
                <p className="text-xs text-slate-400 mt-0.5">Escala 0 – 100 · Mínimo aprobatorio: 70</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-max">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 sticky left-0 bg-slate-50">Estudiante</th>
                      {actividades.map(act => (
                        <th key={act.id} className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wide px-3 py-3 min-w-28">
                          <div className="truncate max-w-28">{act.nombre}</div>
                          <div className="text-slate-400 font-normal normal-case">{act.porcentaje}%</div>
                        </th>
                      ))}
                      <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wide px-3 py-3">Período</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {estudiantes.map(est => {
                      const boletinEst = calificacionesData?.find(c => c.estudianteId === est.id);
                      const materiaBoletin = boletinEst?.boletin?.find((m: { materia: { id: string }; notaPeriodo: number | null; actividades: { id: string; nota: number | null }[] }) => m.materia.id === materiaId);

                      return (
                        <tr key={est.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 sticky left-0 bg-white">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">{est.nombres[0]}{est.apellidos[0]}</div>
                              <span className="text-sm font-medium text-slate-800 whitespace-nowrap">{est.nombres} {est.apellidos}</span>
                            </div>
                          </td>
                          {actividades.map(act => {
                            const notaExistente = materiaBoletin?.actividades?.find((a: { id: string; nota: number | null }) => a.id === act.id)?.nota;
                            const notaExistenteNum = notaExistente != null ? Number(notaExistente) : null;
                            const valorTemp = notasTemp[est.id]?.[act.id];
                            return (
                              <td key={act.id} className="px-3 py-3 text-center">
                                <div className="flex items-center gap-1 justify-center">
                                  <input
                                    type="number" min="0" max="100" step="0.1"
                                    placeholder={notaExistenteNum != null ? String(notaExistenteNum) : '—'}
                                    value={valorTemp ?? ''}
                                    onChange={e => setNotasTemp(prev => ({ ...prev, [est.id]: { ...prev[est.id], [act.id]: e.target.value } }))}
                                    className={`w-16 text-center px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${notaExistenteNum != null ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200'}`}
                                  />
                                  {valorTemp && (
                                    <button onClick={() => guardarNota(act.id, est.id)} className="p-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                                      <Save className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                                {notaExistenteNum != null && !valorTemp && (
                                  <p className={`text-xs mt-0.5 ${COLOR_NOTA(notaExistenteNum)}`}>{notaExistenteNum.toFixed(1)}</p>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 text-center">
                            <span className={`text-lg font-bold ${COLOR_NOTA(materiaBoletin?.notaPeriodo != null ? Number(materiaBoletin.notaPeriodo) : null)}`}>
                              {materiaBoletin?.notaPeriodo != null ? Number(materiaBoletin.notaPeriodo).toFixed(1) : '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {modalActividad && (
        <Modal titulo="Nueva actividad" onClose={() => { setModalActividad(false); rAct(); }}>
          <form onSubmit={hAct(d => crearActividadMutation.mutate(d))} className="space-y-4">
            <Campo label="Nombre *" error={eAct.nombre?.message}>
              <input className={inputCls(eAct.nombre?.message)} placeholder="Ej: Taller de fracciones" maxLength={100}
                {...regAct('nombre', { required: 'Requerido', maxLength: { value: 100, message: 'Máximo 100 caracteres' } })} />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Tipo *" error={eAct.tipo?.message}>
                <select className={inputCls(eAct.tipo?.message)} {...regAct('tipo', { required: 'Requerido' })}>
                  <option value="">Seleccionar</option>
                  {TIPO_ACTIVIDAD.map(t => <option key={t} value={t}>{LABEL_TIPO[t]}</option>)}
                </select>
              </Campo>
              <Campo label={`Porcentaje * (disp: ${porcentajeRestante}%)`} error={eAct.porcentaje?.message}>
                <input type="number" min={1} max={porcentajeRestante} className={inputCls(eAct.porcentaje?.message)} placeholder={`Máx. ${porcentajeRestante}`}
                  {...regAct('porcentaje', { required: 'Requerido', valueAsNumber: true, min: { value: 1, message: 'Mínimo 1%' }, max: { value: porcentajeRestante, message: `Máximo disponible: ${porcentajeRestante}%` } })} />
              </Campo>
            </div>
            <Campo label="Descripción (opcional)">
              <textarea
                rows={3}
                maxLength={300}
                className={`${inputCls()} resize-none break-words whitespace-pre-wrap`}
                placeholder="Descripción de la actividad..."
                {...regAct('descripcion', { maxLength: { value: 300, message: 'Máximo 300 caracteres' } })}
              />
              <p className="mt-1 text-xs text-slate-400 text-right">{(watchDescripcionAct ?? '').length} / 300 caracteres</p>
            </Campo>
            <Campo label="Fecha de entrega (opcional)">
              <input type="date" className={inputCls()} {...regAct('fechaEntrega')} />
            </Campo>
            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
              <button type="button" onClick={() => { setModalActividad(false); rAct(); }} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
              <button type="submit" disabled={crearActividadMutation.isPending} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
                {crearActividadMutation.isPending ? 'Guardando...' : 'Crear actividad'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {actividadEditar && (
        <Modal titulo="Editar actividad" onClose={() => setActividadEditar(null)}>
          <form onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); editarActividadMutation.mutate({ id: actividadEditar.id, nombre: fd.get('nombre') as string, tipo: fd.get('tipo') as string, descripcion: fd.get('descripcion') as string, fechaEntrega: fd.get('fechaEntrega') as string || undefined }); }} className="space-y-4">
            <Campo label="Nombre *">
              <input name="nombre" className={inputCls()} defaultValue={actividadEditar.nombre} maxLength={100} required />
            </Campo>
            <Campo label="Tipo *">
              <select name="tipo" className={inputCls()} defaultValue={actividadEditar.tipo} required>
                {TIPO_ACTIVIDAD.map(t => <option key={t} value={t}>{LABEL_TIPO[t]}</option>)}
              </select>
            </Campo>
            <Campo label="Descripción (opcional)">
              <textarea name="descripcion" rows={3} maxLength={300} className={`${inputCls()} resize-none`} defaultValue={actividadEditar.descripcion ?? ''} />
            </Campo>
            <Campo label="Fecha de entrega (opcional)">
              <input type="date" name="fechaEntrega" className={inputCls()} defaultValue={actividadEditar.fechaEntrega ? new Date(actividadEditar.fechaEntrega).toISOString().split('T')[0] : ''} />
            </Campo>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <p className="text-xs text-amber-700">El porcentaje no se puede modificar para no afectar la suma total.</p>
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setActividadEditar(null)} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
              <button type="submit" disabled={editarActividadMutation.isPending} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
                {editarActividadMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {actividadEliminar && (
        <Modal titulo="Eliminar actividad" onClose={() => setActividadEliminar(null)}>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-700">¿Estás seguro de que quieres eliminar <strong>"{actividadEliminar.nombre}"</strong>?</p>
              <p className="text-xs text-red-500 mt-1">Solo se puede eliminar si no tiene notas registradas.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setActividadEliminar(null)} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
              <button onClick={() => eliminarActividadMutation.mutate(actividadEliminar.id)} disabled={eliminarActividadMutation.isPending}
                className="px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition disabled:opacity-50">
                {eliminarActividadMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── MÓDULO OBSERVACIONES ─────────────────────────────────────────────────────
function ModuloObservaciones() {
  const qc = useQueryClient();
  const [gradoId, setGradoId] = useState('');
  const [estudianteId, setEstudianteId] = useState('');
  const [modal, setModal] = useState(false);
  const [obsEditar, setObsEditar] = useState<{ id: string; tipo: string; descripcion: string; materiaId?: string } | null>(null);
  const [obsEliminar, setObsEliminar] = useState<{ id: string; descripcion: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);

  const { data: grados = [] } = useQuery({ queryKey: ['grados'], queryFn: async () => (await api.get('/grados')).data.datos ?? [] });
  const { data: estudiantes = [] } = useQuery({
    queryKey: ['estudiantes-grado', gradoId],
    queryFn: async () => (await api.get('/estudiantes', { params: { gradoId } })).data.datos ?? [],
    enabled: !!gradoId,
  });

  // Materias del profesor en el grado seleccionado
  const { data: gradoDetalle } = useQuery({
    queryKey: ['grado-detalle', gradoId],
    queryFn: async () => (await api.get('/grados')).data.datos?.find((g: Grado & { materiaGrados: { materia: Materia; profesorId: string }[] }) => g.id === gradoId),
    enabled: !!gradoId,
  });
  const materias: Materia[] = gradoDetalle?.materiaGrados?.map((mg: { materia: Materia }) => mg.materia) ?? [];

  const { data: observaciones = [], isLoading } = useQuery({
    queryKey: ['observaciones', estudianteId],
    queryFn: async () => (await api.get(`/observaciones/${estudianteId}`)).data.datos ?? [],
    enabled: !!estudianteId,
    staleTime: 0,
  });

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<{ tipo: string; descripcion: string; materiaId?: string }>();
  const watchDescripcion = watch('descripcion');

  const crearMutation = useMutation({
    mutationFn: (d: unknown) => api.post('/observaciones', { ...d as object, estudianteId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['observaciones', estudianteId] }); setModal(false); reset(); setToast({ msg: 'Observación registrada', tipo: 'ok' }); },
    onError: (e: unknown) => { const d = (e as { response?: { data?: { mensaje?: string; errores?: string[] } } })?.response?.data; setToast({ msg: d?.errores?.[0] ?? d?.mensaje ?? 'Error', tipo: 'error' }); },
  });

  const editarMutation = useMutation({
    mutationFn: ({ id, ...d }: { id: string; tipo: string; descripcion: string; materiaId?: string }) => api.put(`/observaciones/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['observaciones', estudianteId] }); setObsEditar(null); setToast({ msg: 'Observación actualizada', tipo: 'ok' }); },
    onError: (e: unknown) => { const d = (e as { response?: { data?: { mensaje?: string } } })?.response?.data; setToast({ msg: d?.mensaje ?? 'Error', tipo: 'error' }); },
  });

  const eliminarMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/observaciones/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['observaciones', estudianteId] }); setObsEliminar(null); setToast({ msg: 'Observación eliminada', tipo: 'ok' }); },
    onError: (e: unknown) => { const d = (e as { response?: { data?: { mensaje?: string } } })?.response?.data; setToast({ msg: d?.mensaje ?? 'Error', tipo: 'error' }); },
  });

  type ObsRow = { id: string; tipo: string; descripcion: string; fecha: string; profesorId: string; profesor: { nombres: string; apellidos: string }; materia?: { nombre: string }; materiaId?: string; yaVista?: boolean };

  return (
    <div className="space-y-5">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <p className="text-sm font-semibold text-slate-600 mb-3">Selecciona el estudiante</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Grado</label>
            <select value={gradoId} onChange={e => { setGradoId(e.target.value); setEstudianteId(''); }} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Seleccionar grado</option>
              {(grados as Grado[]).map(g => <option key={g.id} value={g.id}>{g.nombre}{g.grupo}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Estudiante</label>
            <select value={estudianteId} onChange={e => setEstudianteId(e.target.value)} disabled={!gradoId} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-50">
              <option value="">Seleccionar estudiante</option>
              {(estudiantes as Estudiante[]).map(e => <option key={e.id} value={e.id}>{e.nombres} {e.apellidos}</option>)}
            </select>
          </div>
        </div>
      </div>

      {estudianteId && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-600">{(observaciones as ObsRow[]).length} observacion(es)</p>
            <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors">
              <Plus className="w-4 h-4" /> Nueva observación
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-24"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
          ) : (observaciones as ObsRow[]).length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center py-10 text-slate-400">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin observaciones para este estudiante</p>
            </div>
          ) : (
            (observaciones as ObsRow[]).map(obs => (
              <div key={obs.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${COLOR_OBS[obs.tipo]}`}>{LABEL_OBS[obs.tipo]}</span>
                      {obs.materia && <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">{obs.materia.nombre}</span>}
                      {obs.yaVista && <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Visto</span>}
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed break-words whitespace-pre-wrap">{obs.descripcion}</p>
                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                      Prof. {obs.profesor.nombres} {obs.profesor.apellidos} · {new Date(obs.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => setObsEditar({ id: obs.id, tipo: obs.tipo, descripcion: obs.descripcion, materiaId: obs.materiaId })}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setObsEliminar({ id: obs.id, descripcion: obs.descripcion })}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal crear */}
      {modal && (
        <Modal titulo="Nueva observación" onClose={() => { setModal(false); reset(); }}>
          <form onSubmit={handleSubmit(d => crearMutation.mutate(d))} className="space-y-4">
            <Campo label="Tipo *" error={errors.tipo?.message}>
              <select className={inputCls(errors.tipo?.message)} {...register('tipo', { required: 'Selecciona el tipo' })}>
                <option value="">Seleccionar tipo</option>
                {TIPO_OBSERVACION.map(t => <option key={t} value={t}>{LABEL_OBS[t]}</option>)}
              </select>
            </Campo>
            <Campo label="Materia (opcional)">
              <select className={inputCls()} {...register('materiaId')}>
                <option value="">Sin materia específica</option>
                {materias.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </Campo>
            <Campo label="Descripción *" error={errors.descripcion?.message}>
              <textarea rows={5} maxLength={MAX_DESCRIPCION}
                className={`${inputCls(errors.descripcion?.message)} resize-none break-words whitespace-pre-wrap`}
                placeholder="Describe la situación observada..."
                {...register('descripcion', { required: 'La descripción es requerida', minLength: { value: 10, message: 'Mínimo 10 caracteres' }, maxLength: { value: MAX_DESCRIPCION, message: `Máximo ${MAX_DESCRIPCION} caracteres` } })} />
              <p className={`mt-1 text-xs text-right ${(watchDescripcion?.length ?? 0) >= MAX_DESCRIPCION ? 'text-red-500' : 'text-slate-400'}`}>
                {watchDescripcion?.length ?? 0} / {MAX_DESCRIPCION} caracteres
              </p>
            </Campo>
            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
              <button type="button" onClick={() => { setModal(false); reset(); }} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
              <button type="submit" disabled={crearMutation.isPending} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
                {crearMutation.isPending ? 'Guardando...' : 'Registrar observación'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal editar */}
      {obsEditar && (
        <Modal titulo="Editar observación" onClose={() => setObsEditar(null)}>
          <form onSubmit={e => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            editarMutation.mutate({ id: obsEditar.id, tipo: fd.get('tipo') as string, descripcion: fd.get('descripcion') as string, materiaId: fd.get('materiaId') as string || undefined });
          }} className="space-y-4">
            <Campo label="Tipo *">
              <select name="tipo" className={inputCls()} defaultValue={obsEditar.tipo} required>
                {TIPO_OBSERVACION.map(t => <option key={t} value={t}>{LABEL_OBS[t]}</option>)}
              </select>
            </Campo>
            <Campo label="Materia (opcional)">
              <select name="materiaId" className={inputCls()} defaultValue={obsEditar.materiaId ?? ''}>
                <option value="">Sin materia específica</option>
                {materias.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </Campo>
            <Campo label="Descripción *">
              <textarea name="descripcion" rows={5} maxLength={MAX_DESCRIPCION}
                className={`${inputCls()} resize-none`} defaultValue={obsEditar.descripcion} required />
            </Campo>
            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setObsEditar(null)} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
              <button type="submit" disabled={editarMutation.isPending} className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
                {editarMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal eliminar */}
      {obsEliminar && (
        <Modal titulo="Eliminar observación" onClose={() => setObsEliminar(null)}>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-700">¿Estás seguro de que quieres eliminar esta observación?</p>
              <p className="text-xs text-slate-500 mt-2 line-clamp-2">{obsEliminar.descripcion}</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setObsEliminar(null)} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
              <button onClick={() => eliminarMutation.mutate(obsEliminar.id)} disabled={eliminarMutation.isPending}
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

// ─── DASHBOARD PROFESOR ───────────────────────────────────────────────────────
// ─── MI PERFIL ────────────────────────────────────────────────────────────────
function MiPerfil() {
  const [editando, setEditando] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);
  const { usuario } = useAuthStore();
  const qc = useQueryClient();

  const { data: perfil, isLoading } = useQuery({
    queryKey: ['mi-perfil-profesor'],
    queryFn: async () => (await api.get('/usuarios/mi-perfil')).data.datos,
    staleTime: 0,
  });

  const { register, handleSubmit, formState: { errors } } = useForm<{ nombres: string; apellidos: string; tipoDocumento: string; numeroDocumento: string; telefono?: string }>();

  const editarMutation = useMutation({
    mutationFn: (d: { nombres: string; apellidos: string; tipoDocumento: string; numeroDocumento: string; telefono?: string }) => api.put('/usuarios/mi-perfil', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mi-perfil-profesor'] });
      setEditando(false);
      setToast({ msg: 'Perfil actualizado correctamente', tipo: 'ok' });
    },
    onError: () => setToast({ msg: 'Error al actualizar el perfil', tipo: 'error' }),
  });

  if (isLoading) return <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;

  const materias = perfil?.perfilProfesor?.materiaGrados ?? [];
  const materiasUnicas = [...new Map(materias.map((m: { materia: { id: string; nombre: string }; grado: { id: string; nombre: string; grupo: string } }) => [m.materia.id, m])).values()] as { materia: { id: string; nombre: string }; grado: { nombre: string; grupo: string } }[];

  return (
    <div className="space-y-4 max-w-2xl">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      {/* Tarjeta principal */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Header con gradiente */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-8 flex items-center gap-5">
          <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center text-white text-3xl font-bold flex-shrink-0">
            {perfil?.perfilProfesor?.nombres?.[0]}{perfil?.perfilProfesor?.apellidos?.[0]}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{perfil?.perfilProfesor?.nombres} {perfil?.perfilProfesor?.apellidos}</h2>
            <p className="text-blue-200 text-sm mt-0.5">Docente · Portal Escolar</p>
          </div>
        </div>

        {/* Info de contacto */}
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Correo</p>
                <p className="text-sm font-medium text-slate-700">{usuario?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-4 h-4 text-slate-500" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Documento</p>
                <p className="text-sm font-medium text-slate-700">{perfil?.perfilProfesor?.tipoDocumento} {perfil?.perfilProfesor?.numeroDocumento}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <Phone className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Teléfono</p>
                <p className="text-sm font-medium text-slate-700">{perfil?.perfilProfesor?.telefono ?? '—'}</p>
              </div>
            </div>
          </div>

          {!editando ? (
            <button onClick={() => setEditando(true)}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
              <Edit2 className="w-4 h-4" /> Editar información de contacto
            </button>
          ) : (
            <form onSubmit={handleSubmit(d => editarMutation.mutate(d))} className="space-y-3 pt-3 border-t border-slate-100">
              <p className="text-sm font-semibold text-slate-600">Editar información personal</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Nombres *</label>
                  <input className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    defaultValue={perfil?.perfilProfesor?.nombres ?? ''}
                    {...register('nombres', { required: 'Requerido' })} />
                  {errors.nombres && <p className="mt-1 text-xs text-red-500">{errors.nombres.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Apellidos *</label>
                  <input className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    defaultValue={perfil?.perfilProfesor?.apellidos ?? ''}
                    {...register('apellidos', { required: 'Requerido' })} />
                  {errors.apellidos && <p className="mt-1 text-xs text-red-500">{errors.apellidos.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Tipo de documento *</label>
                  <select className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    defaultValue={perfil?.perfilProfesor?.tipoDocumento ?? ''}
                    {...register('tipoDocumento', { required: 'Requerido' })}>
                    <option value="CC">CC — Cédula</option>
                    <option value="CE">CE — Cédula Extranjería</option>
                    <option value="PASAPORTE">Pasaporte</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Número de documento *</label>
                  <input className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    defaultValue={perfil?.perfilProfesor?.numeroDocumento ?? ''}
                    {...register('numeroDocumento', { required: 'Requerido' })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Teléfono</label>
                  <input className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    placeholder="Ej: 3001234567" maxLength={10}
                    defaultValue={perfil?.perfilProfesor?.telefono ?? ''}
                    {...register('telefono', { pattern: { value: /^[0-9]{7,10}$/, message: '7 a 10 dígitos' } })} />
                  {errors.telefono && <p className="mt-1 text-xs text-red-500">{errors.telefono.message}</p>}
                </div>
              </div>
              <p className="text-xs text-slate-400">El correo electrónico solo puede ser modificado por el administrador.</p>
              <div className="flex gap-2">
                <button type="submit" disabled={editarMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
                  <Save className="w-4 h-4" /> {editarMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
                </button>
                <button type="button" onClick={() => setEditando(false)} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Materias asignadas */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4">
          <BookOpenIcon className="w-5 h-5 text-violet-600" />
          <h3 className="font-semibold text-slate-700">Materias asignadas</h3>
        </div>
        {materiasUnicas.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No tienes materias asignadas aún</p>
        ) : (
          <div className="space-y-2">
            {materias.map((mg: { materia: { id: string; nombre: string }; grado: { nombre: string; grupo: string } }, i: number) => (
              <div key={i} className="flex items-center justify-between py-2.5 px-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                    <BookOpenIcon className="w-4 h-4 text-violet-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-800">{mg.materia.nombre}</p>
                </div>
                <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg font-medium">
                  Grado {mg.grado.nombre}{mg.grado.grupo}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const NAV = [
  { id: 'notas',         label: 'Notas y actividades', icono: BarChart2 },
  { id: 'observaciones', label: 'Observaciones',        icono: MessageSquare },
  { id: 'asistencia',    label: 'Asistencia',           icono: CalendarCheck },
  { id: 'calendario',    label: 'Calendario',           icono: Calendar },
  { id: 'perfil',        label: 'Mi perfil',            icono: Users },
] as const;

const TITULOS: Record<Seccion, string> = {
  notas: 'Notas y actividades',
  observaciones: 'Observador del estudiante',
  asistencia: 'Asistencia diaria',
  calendario: 'Calendario académico',
  perfil: 'Mi perfil',
  estudiantes: 'Mis estudiantes',
};

export default function ProfesorDashboard() {
  const [seccion, setSeccion] = useState<Seccion>('notas');
  const [sidebar, setSidebar] = useState(false);
  const [modalPassword, setModalPassword] = useState(false);
  const { usuario, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const handleLogout = async () => { try { await api.post('/auth/logout'); } catch {} clearAuth(); navigate('/login'); };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {sidebar && <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebar(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 flex flex-col overflow-hidden transition-transform duration-200 ${sidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center"><GraduationCap className="w-5 h-5 text-white" /></div>
            <div><p className="text-white font-bold text-sm">Portal Escolar</p><p className="text-slate-400 text-xs">Profesor/a</p></div>
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
            <div className="flex-1 min-w-0"><p className="text-white text-xs font-medium truncate">{usuario?.email}</p><p className="text-slate-400 text-xs">Profesor/a</p></div>
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
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {seccion === 'notas' ? <ModuloNotas />
            : seccion === 'observaciones' ? <ModuloObservaciones />
            : seccion === 'asistencia' ? <Asistencia />
            : seccion === 'calendario' ? <CalendarioAcademico soloProfesor />
            : <MiPerfil />}
        </main>
      </div>
      {modalPassword && <CambiarPassword onClose={() => setModalPassword(false)} />}
    </div>
  );
}