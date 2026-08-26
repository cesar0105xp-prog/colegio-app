import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GraduationCap, MessageSquare, FileText, LogOut, Menu,
  CheckCircle, AlertTriangle, ChevronDown, ChevronUp,
  Download, Upload, X, BookOpen, Clock, AlertCircle, Mail, TrendingUp, KeyRound, Users, Search, Edit2, Wallet, CalendarCheck
} from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import api from '../../services/api';
import { CambiarPassword } from '../../components/CambiarPassword';
import ResumenAnual from '../../components/ResumenAnual';
import ContactosEmergencia from '../../components/ContactosEmergencia';
import FormularioMatricula from '../../components/FormularioMatricula';
import EstadoCuenta from '../../components/EstadoCuenta';
import HistorialAsistencia from '../../components/HistorialAsistencia';

type Seccion = 'boletin' | 'observaciones' | 'asistencia' | 'comunicados' | 'directorio' | 'cuenta' | 'matricula' | 'pagos';

const COLOR_NOTA = (n: number | null) => {
  if (n === null) return 'text-slate-400';
  if (n >= 90) return 'text-emerald-600 font-bold';
  if (n >= 70) return 'text-blue-600 font-semibold';
  return 'text-red-600 font-bold';
};

const COLOR_OBS: Record<string, string> = { POSITIVA:'bg-emerald-100 text-emerald-800', NEGATIVA:'bg-red-100 text-red-800', NEUTRA:'bg-slate-100 text-slate-700', DISCIPLINARIA:'bg-orange-100 text-orange-800', ACADEMICA:'bg-blue-100 text-blue-800', CONVIVENCIA:'bg-purple-100 text-purple-800' };
const LABEL_OBS: Record<string, string> = { POSITIVA:'Positiva', NEGATIVA:'Negativa', NEUTRA:'Neutra', DISCIPLINARIA:'Disciplinaria', ACADEMICA:'Académica', CONVIVENCIA:'Convivencia' };
const LABEL_TIPO: Record<string, string> = { TAREA:'Tarea', TALLER:'Taller', EXAMEN:'Examen', QUIZ:'Quiz', PROYECTO:'Proyecto', EXPOSICION:'Exposición', PARTICIPACION:'Participación' };

function Toast({ mensaje, tipo, onClose }: { mensaje: string; tipo: 'ok' | 'error'; onClose: () => void }) {
  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${tipo === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
      {tipo === 'ok' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {mensaje}
      <button onClick={onClose}><X className="w-4 h-4" /></button>
    </div>
  );
}

async function verArchivo(archivoId: string, setToast: (t: { msg: string; tipo: 'ok' | 'error' } | null) => void) {
  try {
    const res = await api.get(`/archivos/${archivoId}/descargar`, { responseType: 'blob' });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => window.URL.revokeObjectURL(url), 10000);
  } catch {
    setToast({ msg: 'Error al abrir el archivo. Intenta de nuevo.', tipo: 'error' });
  }
}

type Hijo = { id: string; nombres: string; apellidos: string; grado: { nombre: string; grupo: string }; estado: string };
type MateriaBoletin = { materia: { id: string; nombre: string }; profesor: string; actividades: { id: string; nombre: string; tipo: string; porcentaje: number; nota: number | null; observacion?: string }[]; notaPeriodo: number | null; porcentajeTotal: number };
type Observacion = { id: string; tipo: string; descripcion: string; fecha: string; yaVista: boolean; profesor: { nombres: string; apellidos: string }; materia?: { nombre: string } };
type Archivo = { id: string; nombreOriginal: string; tipo: string; tamanoBytes: number; createdAt: string };
type Periodo = { id: string; nombre: string; numero: number; activo: boolean };
type ComunicadoRow = { id: string; titulo: string; mensaje: string; destinatario: string; createdAt: string; grado?: { nombre: string; grupo: string } };

function TarjetaMateria({ m }: { m: MateriaBoletin }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setAbierta(!abierta)}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center"><BookOpen className="w-5 h-5 text-blue-600" /></div>
          <div>
            <h3 className="font-semibold text-slate-800">{m.materia.nombre}</h3>
            <p className="text-xs text-slate-400">Prof. {m.profesor}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-slate-400 mb-0.5">Nota período</p>
            <p className={`text-2xl ${COLOR_NOTA(m.notaPeriodo)}`}>{m.notaPeriodo != null ? m.notaPeriodo.toFixed(1) : '--'}</p>
          </div>
          {abierta ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </div>
      </div>
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${m.porcentajeTotal}%` }} />
          </div>
          <span className="text-xs text-slate-400">{m.porcentajeTotal}%</span>
        </div>
      </div>
      {abierta && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Actividades</p>
          {m.actividades.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Sin actividades registradas</p>
          ) : m.actividades.map(act => (
            <div key={act.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-xl">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-medium">{LABEL_TIPO[act.tipo] ?? act.tipo}</span>
                  <span className="text-sm font-medium text-slate-700 truncate">{act.nombre}</span>
                </div>
                {act.observacion && <p className="text-xs text-slate-400 mt-0.5 truncate">{act.observacion}</p>}
              </div>
              <div className="flex items-center gap-3 ml-3">
                <span className="text-xs text-slate-400">{act.porcentaje}%</span>
                <span className={`text-base font-bold ${COLOR_NOTA(act.nota)}`}>{act.nota != null ? act.nota.toFixed(1) : '--'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PadreDashboard() {
  const qc = useQueryClient();
  const [seccion, setSeccion] = useState<Seccion>('boletin');
  const [sidebar, setSidebar] = useState(false);
  const [hijoSeleccionado, setHijoSeleccionado] = useState('');
  const [periodoId, setPeriodoId] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);
  const [tabBoletin, setTabBoletin] = useState<'periodo' | 'anual'>('periodo');
  const [modalPassword, setModalPassword] = useState(false);
  const { usuario, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => { try { await api.post('/auth/logout'); } catch {} clearAuth(); navigate('/login'); };

  const { data: hijos = [] } = useQuery({
    queryKey: ['mis-hijos'],
    queryFn: async () => (await api.get('/estudiantes/mis-hijos')).data.datos ?? [],
  });

  const { data: periodos = [] } = useQuery({ queryKey: ['periodos'], queryFn: async () => (await api.get('/periodos')).data.datos ?? [] });

  React.useEffect(() => {
    const activo = (periodos as Periodo[]).find(p => p.activo);
    if (activo && !periodoId) setPeriodoId(activo.id);
  }, [periodos]);

  React.useEffect(() => {
    if ((hijos as Hijo[]).length > 0 && !hijoSeleccionado) setHijoSeleccionado((hijos as Hijo[])[0].id);
  }, [hijos]);

  const hijoActual = (hijos as Hijo[]).find(h => h.id === hijoSeleccionado);

  const { data: boletinData, isLoading: loadingBoletin } = useQuery({
    queryKey: ['boletin', hijoSeleccionado, periodoId],
    queryFn: async () => (await api.get(`/boletin/${hijoSeleccionado}`, { params: { periodoId } })).data.datos,
    enabled: !!(hijoSeleccionado && periodoId),
  });

  const { data: observaciones = [], isLoading: loadingObs } = useQuery({
    queryKey: ['observaciones', hijoSeleccionado],
    queryFn: async () => (await api.get(`/observaciones/${hijoSeleccionado}`)).data.datos ?? [],
    enabled: !!hijoSeleccionado,
  });

  const obsNoVistas = (observaciones as Observacion[]).filter(o => !o.yaVista).length;

  const marcarVistoMutation = useMutation({
    mutationFn: (id: string) => api.post(`/observaciones/${id}/visto`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['observaciones', hijoSeleccionado] }),
  });

  const { data: archivos = [], isLoading: loadingArchivos, refetch: refetchArchivos } = useQuery({
    queryKey: ['archivos', hijoSeleccionado],
    queryFn: async () => (await api.get(`/archivos/estudiante/${hijoSeleccionado}`)).data.datos ?? [],
    enabled: !!hijoSeleccionado,
    staleTime: 0,
  });

  const { data: comunicados = [], isLoading: loadingComunicados } = useQuery({
    queryKey: ['comunicados-padre'],
    queryFn: async () => (await api.get('/comunicados/padre')).data.datos ?? [],
    staleTime: 0,
  });

  const subirArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !hijoSeleccionado) return;
    if (file.type !== 'application/pdf') { setToast({ msg: 'Solo se permiten archivos PDF', tipo: 'error' }); return; }
    if (file.size > 10 * 1024 * 1024) { setToast({ msg: 'El archivo no puede superar 10 MB', tipo: 'error' }); return; }
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append('archivo', file);
      fd.append('estudianteId', hijoSeleccionado);
      fd.append('tipo', 'AUTORIZACION');
      fd.append('descripcion', file.name);
      fd.append('visibleParaPadre', 'true');
      await api.post('/archivos', fd);
      await qc.invalidateQueries({ queryKey: ['archivos', hijoSeleccionado] });
      await refetchArchivos();
      setToast({ msg: 'Archivo subido correctamente', tipo: 'ok' });
      setSeccion('matricula')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? 'Error al subir el archivo';
      setToast({ msg, tipo: 'error' });
    }
    finally { setSubiendo(false); e.target.value = ''; }
  };

  const materiasConNota = (boletinData?.boletin ?? []).filter((m: MateriaBoletin) => m.notaPeriodo != null);
  const promedio = materiasConNota.length > 0
    ? (materiasConNota.reduce((acc: number, m: MateriaBoletin) => acc + (m.notaPeriodo ?? 0), 0) / materiasConNota.length).toFixed(1)
    : '--';

  const NAV_PADRE = [
    { id: 'boletin',       label: 'Boletín',       icono: GraduationCap },
    { id: 'observaciones', label: 'Observaciones',  icono: MessageSquare },
    { id: 'asistencia',    label: 'Asistencia',      icono: CalendarCheck },
    { id: 'pagos',         label: 'Pagos',           icono: Wallet },
    { id: 'comunicados',   label: 'Comunicados',    icono: Mail },
    { id: 'directorio',    label: 'Docentes',        icono: Users },
    { id: 'cuenta',        label: 'Mi cuenta',        icono: KeyRound },
    { id: 'matricula',     label: 'Matrícula',        icono: FileText },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}
      {sidebar && <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebar(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 flex flex-col overflow-hidden transition-transform duration-200 ${sidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center"><GraduationCap className="w-5 h-5 text-white" /></div>
            <div><p className="text-white font-bold text-sm">Portal Escolar</p><p className="text-slate-400 text-xs">Padre/Acudiente</p></div>
          </div>
        </div>

        {(hijos as Hijo[]).length > 1 && (
          <div className="px-4 py-3 border-b border-slate-800">
            <p className="text-xs text-slate-500 mb-1.5 font-medium">Estudiante</p>
            <select value={hijoSeleccionado} onChange={e => setHijoSeleccionado(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
              {(hijos as Hijo[]).map(h => <option key={h.id} value={h.id}>{h.nombres} {h.apellidos}</option>)}
            </select>
          </div>
        )}

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-none">
          {NAV_PADRE.map(item => (
            <button key={item.id} onClick={() => { setSeccion(item.id as Seccion); setSidebar(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${seccion === item.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              <item.icono className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.id === 'observaciones' && obsNoVistas > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center">
                  {obsNoVistas}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">{usuario?.email[0].toUpperCase()}</div>
            <div className="flex-1 min-w-0"><p className="text-white text-xs font-medium truncate">{usuario?.email}</p><p className="text-slate-400 text-xs">Padre/Acudiente</p></div>
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
          <div className="flex-1">
            <h1 className="font-bold text-slate-800">{hijoActual ? `${hijoActual.nombres} ${hijoActual.apellidos}` : 'Portal del Padre'}</h1>
            {hijoActual && <p className="text-xs text-slate-400">Grado {hijoActual.grado.nombre}{hijoActual.grado.grupo}</p>}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto max-w-4xl mx-auto w-full">

          {/* ── BOLETÍN ── */}
          {seccion === 'boletin' && (
            <div className="space-y-4">
              {/* Pestañas */}
              <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                <button onClick={() => setTabBoletin('periodo')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-colors ${tabBoletin === 'periodo' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  <GraduationCap className="w-3.5 h-3.5" /> Por período
                </button>
                <button onClick={() => setTabBoletin('anual')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-colors ${tabBoletin === 'anual' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                  <TrendingUp className="w-3.5 h-3.5" /> Resumen anual
                </button>
              </div>

              {/* Vista por período */}
              {tabBoletin === 'periodo' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-slate-600">Período:</label>
                    <select value={periodoId} onChange={e => setPeriodoId(e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      {(periodos as Periodo[]).map(p => <option key={p.id} value={p.id}>{p.nombre} {p.activo ? '(Activo)' : ''}</option>)}
                    </select>
                  </div>

                  {boletinData && (
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-blue-200 text-sm mb-1">Promedio general</p>
                          <p className="text-5xl font-bold">{promedio}</p>
                          <p className="text-blue-200 text-sm mt-1">{boletinData.boletin?.length ?? 0} materias</p>
                        </div>
                        <div className="text-right">
                          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold border-4 ${parseFloat(promedio) >= 70 ? 'border-emerald-400 bg-emerald-500/20' : 'border-red-400 bg-red-500/20'}`}>
                            {parseFloat(promedio) >= 90 ? '🏆' : parseFloat(promedio) >= 70 ? '✓' : '⚠'}
                          </div>
                          <p className="text-blue-200 text-xs mt-2">{parseFloat(promedio) >= 90 ? 'Excelente' : parseFloat(promedio) >= 70 ? 'Aprobado' : 'En riesgo'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {loadingBoletin ? (
                    <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
                  ) : !hijoSeleccionado ? (
                    <div className="text-center py-12 text-slate-400"><GraduationCap className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>Selecciona un estudiante</p></div>
                  ) : (boletinData?.boletin ?? []).length === 0 ? (
                    <div className="text-center py-12 text-slate-400"><BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No hay notas registradas para este período</p></div>
                  ) : (
                    <div className="space-y-3">
                      {(boletinData.boletin as MateriaBoletin[]).map(m => <TarjetaMateria key={m.materia.id} m={m} />)}
                    </div>
                  )}
                </div>
              )}

              {/* Vista resumen anual */}
              {tabBoletin === 'anual' && hijoSeleccionado && (
                <ResumenAnual estudianteId={hijoSeleccionado} />
              )}
              {tabBoletin === 'anual' && !hijoSeleccionado && (
                <div className="text-center py-12 text-slate-400"><TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">Selecciona un estudiante</p></div>
              )}
            </div>
          )}

          {/* ── OBSERVACIONES ── */}
          {seccion === 'observaciones' && (
            <div className="space-y-3">
              {obsNoVistas > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                  <p className="text-sm text-orange-700">Tienes <strong>{obsNoVistas}</strong> observacion(es) nueva(s) sin leer.</p>
                </div>
              )}

              {loadingObs ? (
                <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
              ) : (observaciones as Observacion[]).length === 0 ? (
                <div className="text-center py-12 text-slate-400"><MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No hay observaciones registradas</p></div>
              ) : (
                (observaciones as Observacion[]).map(obs => (
                  <div key={obs.id} className={`bg-white rounded-2xl border shadow-sm p-4 transition-all ${obs.yaVista ? 'border-slate-200 opacity-80' : 'border-orange-200 shadow-orange-50'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${COLOR_OBS[obs.tipo]}`}>{LABEL_OBS[obs.tipo]}</span>
                          {obs.materia && <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">{obs.materia.nombre}</span>}
                          {!obs.yaVista ? (
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Nueva
                            </span>
                          ) : (
                            <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Vista</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed break-words whitespace-pre-wrap overflow-hidden">{obs.descripcion}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                          <span>Prof. {obs.profesor.nombres} {obs.profesor.apellidos}</span>
                          <span>·</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(obs.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        </div>
                      </div>
                      {!obs.yaVista ? (
                        <button onClick={() => marcarVistoMutation.mutate(obs.id)}
                          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-colors">
                          <CheckCircle className="w-4 h-4" /> Marcar visto
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── ASISTENCIA ── */}
          {seccion === 'asistencia' && hijoSeleccionado && (
            <HistorialAsistencia estudianteId={hijoSeleccionado} />
          )}
          {seccion === 'asistencia' && !hijoSeleccionado && (
            <div className="text-center py-12 text-slate-400">
              <CalendarCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Selecciona un estudiante para ver su asistencia</p>
            </div>
          )}

          {/* ── PAGOS ── */}
          {seccion === 'pagos' && hijoSeleccionado && (
            <EstadoCuenta estudianteId={hijoSeleccionado} />
          )}
          {seccion === 'pagos' && !hijoSeleccionado && (
            <div className="text-center py-12 text-slate-400">
              <Wallet className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Selecciona un estudiante para ver su estado de cuenta</p>
            </div>
          )}

          {/* ── DOCUMENTOS ── */}
          {/* ── COMUNICADOS ── */}
          {seccion === 'comunicados' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">Comunicados enviados por el colegio</p>
              {loadingComunicados ? (
                <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
              ) : (comunicados as ComunicadoRow[]).length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Mail className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No hay comunicados recibidos aún</p>
                </div>
              ) : (
                (comunicados as ComunicadoRow[]).map(c => (
                  <div key={c.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Mail className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-slate-800 text-sm">{c.titulo}</h3>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                            {c.destinatario === 'TODOS' ? 'General' : `Grado ${c.grado?.nombre}${c.grado?.grupo}`}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed break-words whitespace-pre-wrap">{c.mensaje}</p>
                        <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(c.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          {/* ── DIRECTORIO DOCENTES ── */}
          {seccion === 'directorio' && (
            <DirectorioPadre />
          )}

          {seccion === 'cuenta' && (
            <MiCuentaPadre />
          )}

          {seccion === 'matricula' && hijoSeleccionado && hijoActual && (
            <FormularioMatricula
              estudianteId={hijoSeleccionado}
              hijoNombre={`${hijoActual.nombres} ${hijoActual.apellidos}`}
            />
          )}
          {seccion === 'matricula' && !hijoSeleccionado && (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Selecciona un estudiante para ver el formulario</p>
            </div>
          )}
        </main>
      </div>
      {modalPassword && <CambiarPassword onClose={() => setModalPassword(false)} />}
    </div>
  );
}

// ─── MI CUENTA (padre actualiza correo y contraseña) ─────────────────────────
function MiCuentaPadre() {
  const { usuario } = useAuthStore();
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);
  const [modalCorreo, setModalCorreo] = useState(false);
  const [modalPass, setModalPass] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ email: string; passwordActual: string }>();

  const actualizarCorreoMutation = useMutation({
    mutationFn: (d: { email: string; passwordActual: string }) => api.put('/usuarios/mi-correo', d),
    onSuccess: () => {
      setModalCorreo(false);
      reset();
      setToast({ msg: 'Correo actualizado. Usa el nuevo correo en tu próximo login.', tipo: 'ok' });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? 'Error al actualizar';
      setToast({ msg, tipo: 'error' });
    },
  });

  return (
    <div className="space-y-4 max-w-lg">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-semibold text-slate-700 mb-4">Información de acceso</h3>

        <div className="space-y-3">
          {/* Correo actual */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Correo de acceso actual</p>
              <p className="text-sm font-medium text-slate-700 break-all">{usuario?.email}</p>
            </div>
            <button onClick={() => setModalCorreo(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex-shrink-0 ml-3">
              <Edit2 className="w-3.5 h-3.5" /> Cambiar
            </button>
          </div>

          {/* Contraseña */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Contraseña</p>
              <p className="text-sm font-medium text-slate-700">••••••••</p>
            </div>
            <button onClick={() => setModalPass(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex-shrink-0 ml-3">
              <KeyRound className="w-3.5 h-3.5" /> Cambiar
            </button>
          </div>
        </div>

        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-xs text-amber-700">
            <strong>Recomendación:</strong> Si tu correo de acceso fue generado automáticamente por el colegio, actualízalo a tu correo personal para facilitar el acceso.
          </p>
        </div>
      </div>

      {/* Modal cambiar correo */}
      {modalCorreo && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Cambiar correo de acceso</h3>
              <button onClick={() => { setModalCorreo(false); reset(); }} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit(d => actualizarCorreoMutation.mutate(d))} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Nuevo correo *</label>
                <input type="email" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="tunombre@correo.com"
                  {...register('email', { required: 'Requerido', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email inválido' } })} />
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Contraseña actual (para confirmar) *</label>
                <input type="password" className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Tu contraseña actual"
                  {...register('passwordActual', { required: 'Requerido' })} />
                {errors.passwordActual && <p className="mt-1 text-xs text-red-500">{errors.passwordActual.message}</p>}
              </div>
              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                <button type="button" onClick={() => { setModalCorreo(false); reset(); }} className="px-4 py-2 text-sm text-slate-600">Cancelar</button>
                <button type="submit" disabled={actualizarCorreoMutation.isPending}
                  className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
                  {actualizarCorreoMutation.isPending ? 'Guardando...' : 'Actualizar correo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalPass && <CambiarPassword onClose={() => setModalPass(false)} />}
    </div>
  );
}

// ─── DIRECTORIO SIMPLIFICADO PARA EL PADRE ───────────────────────────────────
function DirectorioPadre() {
  const [busqueda, setBusqueda] = useState('');

  const { data: profesores = [], isLoading } = useQuery({
    queryKey: ['directorio-profesores-padre'],
    queryFn: async () => (await api.get('/usuarios', { params: { rol: 'PROFESOR' } })).data.datos ?? [],
  });

  type UsuProf = { id: string; email: string; perfil: { nombres: string; apellidos: string; materiaGrados: { materia: { nombre: string }; grado: { nombre: string; grupo: string } }[] } | null };

  const filtrados = (profesores as UsuProf[])
    .filter(p => p.perfil)
    .filter(p => !busqueda || `${p.perfil?.nombres} ${p.perfil?.apellidos} ${p.email}`.toLowerCase().includes(busqueda.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar docente..." className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-12 text-slate-400"><Users className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No hay docentes registrados</p></div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtrados.map((u: UsuProf) => {
            const p = u.perfil!;
            const materias = [...new Set((p.materiaGrados ?? []).map(m => m.materia.nombre))];
            return (
              <div key={u.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-700 text-lg font-bold flex-shrink-0">
                  {p.nombres[0]}{p.apellidos[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800">{p.nombres} {p.apellidos}</p>
                  <p className="text-sm text-blue-600 flex items-center gap-1 mt-0.5">
                    <Mail className="w-3.5 h-3.5" /> {u.email}
                  </p>
                  {materias.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {materias.map(m => (
                        <span key={m} className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">{m}</span>
                      ))}
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