import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  ChevronLeft, ChevronRight, Calendar, List, Plus, X, CheckCircle, AlertCircle,
  Edit2, Trash2, BookOpen, GraduationCap,
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/auth.store';

// ─── HELPERS LOCALES ────────────────────────────────────────────────────────

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
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
      <div className={`bg-white rounded-t-2xl sm:rounded-2xl w-full ${ancho} shadow-2xl max-h-[90vh] overflow-y-auto`}>
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
  `w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white min-h-[44px] ${err ? 'border-red-400' : 'border-slate-200'}`;

function BotonesForm({ onCancel, cargando, labelGuardar = 'Guardar' }: { onCancel: () => void; cargando: boolean; labelGuardar?: string }) {
  return (
    <div className="flex gap-2 justify-end pt-4 border-t border-slate-100">
      <button type="button" onClick={onCancel} className="px-4 py-2.5 text-sm text-slate-600 hover:text-slate-800 transition min-h-[44px]">Cancelar</button>
      <button type="submit" disabled={cargando} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50 min-h-[44px]">
        {cargando ? 'Guardando...' : labelGuardar}
      </button>
    </div>
  );
}

function mensajeError(e: unknown, fallback: string): string {
  const d = (e as { response?: { data?: { mensaje?: string; errores?: string[] } } })?.response?.data;
  return d?.errores?.[0] ?? d?.mensaje ?? fallback;
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const TIPOS_EVENTO = ['EXAMEN', 'TAREA', 'EVENTO_COLEGIO', 'FESTIVO', 'REUNION', 'OTRO'];
const LABEL_TIPO: Record<string, string> = { EXAMEN: 'Examen', TAREA: 'Tarea', EVENTO_COLEGIO: 'Evento del colegio', FESTIVO: 'Festivo', REUNION: 'Reunión', OTRO: 'Otro' };
const COLOR_TIPO: Record<string, string> = {
  EXAMEN: 'bg-red-100 text-red-700', TAREA: 'bg-blue-100 text-blue-700', EVENTO_COLEGIO: 'bg-violet-100 text-violet-700',
  FESTIVO: 'bg-emerald-100 text-emerald-700', REUNION: 'bg-amber-100 text-amber-700', OTRO: 'bg-slate-100 text-slate-600',
};
const DOT_TIPO: Record<string, string> = {
  EXAMEN: 'bg-red-500', TAREA: 'bg-blue-500', EVENTO_COLEGIO: 'bg-violet-500', FESTIVO: 'bg-emerald-500', REUNION: 'bg-amber-500', OTRO: 'bg-slate-400',
};

const fmtFecha = (iso: string) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

type Grado = { id: string; nombre: string; grupo: string };
type Evento = {
  id: string; titulo: string; descripcion: string | null; fechaInicio: string; fechaFin: string | null;
  tipoEvento: string; gradoId: string | null; creadorId: string; visible: boolean;
  grado: { id: string; nombre: string; grupo: string } | null;
};
type Tarea = {
  id: string; titulo: string; descripcion: string | null; fechaEntrega: string;
  materiaId: string; gradoId: string; profesorId: string;
  materia: { id: string; nombre: string }; grado: { id: string; nombre: string; grupo: string };
};
type ItemAgenda = { tipo: 'evento' | 'tarea'; fecha: string; data: Evento | Tarea };

type FormEvento = { titulo: string; descripcion?: string; fechaInicio: string; fechaFin?: string; tipoEvento: string; gradoId?: string };
type FormTarea = { titulo: string; descripcion?: string; fechaEntrega: string; materiaId: string };

export default function AgendaCalendario({ gradoIdInicial }: { gradoIdInicial?: string } = {}) {
  const qc = useQueryClient();
  const { usuario } = useAuthStore();
  const esAdmin = usuario?.rol === 'ADMINISTRADOR';
  const esProfesor = usuario?.rol === 'PROFESOR';

  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth());
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [vista, setVista] = useState<'calendario' | 'lista'>('calendario');
  const [gradoId, setGradoId] = useState(gradoIdInicial ?? '');
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  const [modalEvento, setModalEvento] = useState<Evento | 'nuevo' | null>(null);
  const [eliminarItem, setEliminarItem] = useState<{ tipo: 'evento' | 'tarea'; id: string; titulo: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);

  const diasEnMes = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  const desde = `${anio}-${String(mes + 1).padStart(2, '0')}-01`;
  const hasta = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(diasEnMes).padStart(2, '0')}`;

  const { data: grados = [] } = useQuery({ queryKey: ['grados'], queryFn: async () => (await api.get('/grados')).data.datos ?? [] });

  const { data: perfilProfesor } = useQuery({
    queryKey: ['mi-perfil-agenda'],
    queryFn: async () => (await api.get('/usuarios/mi-perfil')).data.datos,
    enabled: esProfesor,
  });
  const materiasDelGrado = ((perfilProfesor?.perfilProfesor?.materiaGrados ?? []) as { materia: { id: string; nombre: string }; grado: { id: string } }[])
    .filter(mg => mg.grado.id === gradoId)
    .map(mg => mg.materia);

  const { data, isLoading } = useQuery({
    queryKey: ['agenda', desde, hasta, gradoId],
    queryFn: async () => (await api.get('/agenda', { params: { desde, hasta, gradoId: gradoId || undefined } })).data.datos,
    staleTime: 0,
  });

  const eventos = (data?.eventos ?? []) as Evento[];
  const tareas = (data?.tareas ?? []) as Tarea[];

  const itemsPorDia = useMemo(() => {
    const mapa = new Map<string, ItemAgenda[]>();
    for (const ev of eventos) {
      const k = ev.fechaInicio.split('T')[0];
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k)!.push({ tipo: 'evento', fecha: ev.fechaInicio, data: ev });
    }
    for (const t of tareas) {
      const k = t.fechaEntrega.split('T')[0];
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k)!.push({ tipo: 'tarea', fecha: t.fechaEntrega, data: t });
    }
    return mapa;
  }, [eventos, tareas]);

  const itemsOrdenados = useMemo(() => {
    const todos: ItemAgenda[] = [
      ...eventos.map(ev => ({ tipo: 'evento' as const, fecha: ev.fechaInicio, data: ev })),
      ...tareas.map(t => ({ tipo: 'tarea' as const, fecha: t.fechaEntrega, data: t })),
    ];
    return todos.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [eventos, tareas]);

  const cambiarMes = (delta: number) => {
    let m = mes + delta, a = anio;
    if (m < 0) { m = 11; a--; } if (m > 11) { m = 0; a++; }
    setMes(m); setAnio(a); setDiaSeleccionado(null);
  };

  const primerDiaSemana = (new Date(Date.UTC(anio, mes, 1)).getUTCDay() + 6) % 7;
  const celdas: (number | null)[] = [...Array(primerDiaSemana).fill(null), ...Array.from({ length: diasEnMes }, (_, i) => i + 1)];

  // ─── mutaciones ───────────────────────────────────────────────────────────
  const { register: regEv, handleSubmit: hEv, reset: rEv, formState: { errors: eEv } } = useForm<FormEvento>();

  React.useEffect(() => {
    if (modalEvento && modalEvento !== 'nuevo') {
      rEv({
        titulo: modalEvento.titulo, descripcion: modalEvento.descripcion ?? '',
        fechaInicio: modalEvento.fechaInicio.split('T')[0], fechaFin: modalEvento.fechaFin?.split('T')[0] ?? '',
        tipoEvento: modalEvento.tipoEvento, gradoId: modalEvento.gradoId ?? '',
      });
    } else if (modalEvento === 'nuevo') {
      rEv({ titulo: '', descripcion: '', fechaInicio: diaSeleccionado ?? '', fechaFin: '', tipoEvento: '', gradoId: gradoId || '' });
    }
  }, [modalEvento]);

  const crearEventoMutation = useMutation({
    mutationFn: (d: FormEvento) => api.post('/agenda/eventos', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agenda'] }); setModalEvento(null); setToast({ msg: 'Evento creado', tipo: 'ok' }); },
    onError: (e: unknown) => setToast({ msg: mensajeError(e, 'Error al crear el evento'), tipo: 'error' }),
  });

  const editarEventoMutation = useMutation({
    mutationFn: (d: FormEvento & { id: string }) => api.put(`/agenda/eventos/${d.id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agenda'] }); setModalEvento(null); setToast({ msg: 'Evento actualizado', tipo: 'ok' }); },
    onError: (e: unknown) => setToast({ msg: mensajeError(e, 'Error al actualizar el evento'), tipo: 'error' }),
  });

  const eliminarMutation = useMutation({
    mutationFn: (item: { tipo: 'evento' | 'tarea'; id: string }) => api.delete(`/agenda/${item.tipo === 'evento' ? 'eventos' : 'tareas'}/${item.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agenda'] }); setEliminarItem(null); setToast({ msg: 'Eliminado correctamente', tipo: 'ok' }); },
    onError: (e: unknown) => { setEliminarItem(null); setToast({ msg: mensajeError(e, 'Error al eliminar'), tipo: 'error' }); },
  });

  const { register: regTa, handleSubmit: hTa, reset: rTa, watch: wTa, formState: { errors: eTa } } = useForm<FormTarea>();
  const watchDescTarea = wTa('descripcion');

  const crearTareaMutation = useMutation({
    mutationFn: (d: FormTarea) => api.post('/agenda/tareas', { ...d, gradoId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agenda'] }); rTa({ titulo: '', descripcion: '', fechaEntrega: '', materiaId: '' }); setToast({ msg: 'Tarea publicada', tipo: 'ok' }); },
    onError: (e: unknown) => setToast({ msg: mensajeError(e, 'Error al publicar la tarea'), tipo: 'error' }),
  });

  const itemsDelDia = diaSeleccionado ? (itemsPorDia.get(diaSeleccionado) ?? []) : [];

  const puedeEditarEvento = (ev: Evento) => esAdmin || ev.creadorId === usuario?.id;
  const puedeEditarTarea = (t: Tarea) => esAdmin || t.profesorId === usuario?.id;

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      {/* Filtros y controles */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
          <button onClick={() => setVista('calendario')} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors min-h-[40px] ${vista === 'calendario' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>
            <Calendar className="w-3.5 h-3.5" /> Calendario
          </button>
          <button onClick={() => setVista('lista')} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors min-h-[40px] ${vista === 'lista' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>
            <List className="w-3.5 h-3.5" /> Lista
          </button>
        </div>
        <select value={gradoId} onChange={e => setGradoId(e.target.value)} className="py-2.5 px-3 border border-slate-200 rounded-xl text-sm bg-white min-h-[44px]">
          <option value="">Todos los grados</option>
          {(grados as Grado[]).map(g => <option key={g.id} value={g.id}>{g.nombre}{g.grupo}</option>)}
        </select>
        {(esAdmin || esProfesor) && (
          <button onClick={() => setModalEvento('nuevo')} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors min-h-[44px] ml-auto">
            <Plus className="w-4 h-4" /> Nuevo evento
          </button>
        )}
      </div>

      {/* Navegación de mes */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => cambiarMes(-1)} className="p-2 rounded-xl hover:bg-slate-100 transition-colors min-h-[40px] min-w-[40px]"><ChevronLeft className="w-5 h-5 text-slate-500" /></button>
          <h2 className="text-lg font-bold text-slate-800">{MESES[mes]} {anio}</h2>
          <button onClick={() => cambiarMes(1)} className="p-2 rounded-xl hover:bg-slate-100 transition-colors min-h-[40px] min-w-[40px]"><ChevronRight className="w-5 h-5 text-slate-500" /></button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
        ) : vista === 'calendario' ? (
          <>
            <div className="grid grid-cols-7 mb-1.5">
              {DIAS_SEMANA.map(d => <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {celdas.map((dia, i) => {
                if (dia === null) return <div key={`vacio-${i}`} />;
                const clave = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
                const items = itemsPorDia.get(clave) ?? [];
                const esHoy = dia === hoy.getDate() && mes === hoy.getMonth() && anio === hoy.getFullYear();
                const seleccionado = clave === diaSeleccionado;
                return (
                  <button key={dia} onClick={() => setDiaSeleccionado(seleccionado ? null : clave)}
                    className={`aspect-square min-h-14 p-1 rounded-xl border transition-all flex flex-col items-center ${
                      seleccionado ? 'bg-blue-600 border-blue-600' : esHoy ? 'border-blue-300 bg-blue-50' : 'border-transparent hover:border-slate-200 hover:bg-slate-50'
                    }`}>
                    <span className={`text-xs font-semibold ${seleccionado ? 'text-white' : esHoy ? 'text-blue-600' : 'text-slate-700'}`}>{dia}</span>
                    {items.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-0.5 justify-center max-w-full">
                        {items.slice(0, 4).map((it, j) => (
                          <span key={j} className={`w-1.5 h-1.5 rounded-full ${seleccionado ? 'bg-white' : DOT_TIPO[it.tipo === 'evento' ? (it.data as Evento).tipoEvento : 'TAREA']}`} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-100">
              {TIPOS_EVENTO.map(t => (
                <div key={t} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className={`w-2.5 h-2.5 rounded-full ${DOT_TIPO[t]}`} /> {LABEL_TIPO[t]}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="divide-y divide-slate-50">
            {itemsOrdenados.length === 0 ? (
              <div className="text-center py-8 text-slate-400"><Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">Sin eventos ni tareas este mes</p></div>
            ) : itemsOrdenados.map(item => {
              const esEvento = item.tipo === 'evento';
              const ev = item.data as Evento; const t = item.data as Tarea;
              return (
                <div key={`${item.tipo}-${item.data.id}`} className="py-3 flex items-center gap-3">
                  <div className="w-12 text-center flex-shrink-0">
                    <p className="text-lg font-bold text-slate-700">{new Date(item.fecha).getUTCDate()}</p>
                    <p className="text-xs text-slate-400">{MESES[new Date(item.fecha).getUTCMonth()].slice(0, 3)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COLOR_TIPO[esEvento ? ev.tipoEvento : 'TAREA']}`}>{esEvento ? LABEL_TIPO[ev.tipoEvento] : 'Tarea'}</span>
                      {esEvento && ev.grado && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{ev.grado.nombre}{ev.grado.grupo}</span>}
                      {!esEvento && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{t.grado.nombre}{t.grado.grupo} · {t.materia.nombre}</span>}
                    </div>
                    <p className="text-sm font-medium text-slate-800 truncate">{esEvento ? ev.titulo : t.titulo}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Día seleccionado */}
      {diaSeleccionado && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-700">{fmtFecha(diaSeleccionado)}</h3>
            <button onClick={() => setDiaSeleccionado(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
          {itemsDelDia.length === 0 ? (
            <div className="text-center py-8 text-slate-400"><Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">Sin eventos ni tareas este día</p></div>
          ) : (
            <div className="divide-y divide-slate-50">
              {itemsDelDia.map(item => {
                const esEvento = item.tipo === 'evento';
                const ev = item.data as Evento; const t = item.data as Tarea;
                return (
                  <div key={`${item.tipo}-${item.data.id}`} className="px-5 py-4 flex items-start gap-3">
                    <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      {esEvento ? <Calendar className="w-4 h-4 text-slate-500" /> : <BookOpen className="w-4 h-4 text-blue-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COLOR_TIPO[esEvento ? ev.tipoEvento : 'TAREA']}`}>{esEvento ? LABEL_TIPO[ev.tipoEvento] : 'Tarea'}</span>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <GraduationCap className="w-3 h-3" /> {esEvento ? (ev.grado ? `${ev.grado.nombre}${ev.grado.grupo}` : 'Todos los grados') : `${t.grado.nombre}${t.grado.grupo} · ${t.materia.nombre}`}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800">{esEvento ? ev.titulo : t.titulo}</p>
                      {(esEvento ? ev.descripcion : t.descripcion) && <p className="text-sm text-slate-500 mt-0.5 break-words whitespace-pre-wrap">{esEvento ? ev.descripcion : t.descripcion}</p>}
                    </div>
                    {esEvento && puedeEditarEvento(ev) && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => setModalEvento(ev)} className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"><Edit2 className="w-4 h-4" /></button>
                        {esAdmin && <button onClick={() => setEliminarItem({ tipo: 'evento', id: ev.id, titulo: ev.titulo })} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                    )}
                    {!esEvento && puedeEditarTarea(t) && (
                      <button onClick={() => setEliminarItem({ tipo: 'tarea', id: t.id, titulo: t.titulo })} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Formulario inline para crear tarea (profesor) */}
      {esProfesor && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-slate-700">Publicar tarea</h3>
          </div>
          {!gradoId ? (
            <p className="text-sm text-slate-400">Selecciona un grado arriba para publicar una tarea.</p>
          ) : materiasDelGrado.length === 0 ? (
            <p className="text-sm text-amber-600">No tienes materias asignadas en este grado.</p>
          ) : (
            <form onSubmit={hTa(d => crearTareaMutation.mutate(d))} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Campo label="Materia *" error={eTa.materiaId?.message}>
                  <select className={inputCls(eTa.materiaId?.message)} {...regTa('materiaId', { required: 'Selecciona la materia' })}>
                    <option value="">Seleccionar</option>
                    {materiasDelGrado.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                </Campo>
                <Campo label="Fecha de entrega *" error={eTa.fechaEntrega?.message}>
                  <input type="date" className={inputCls(eTa.fechaEntrega?.message)} {...regTa('fechaEntrega', { required: 'Requerido' })} />
                </Campo>
              </div>
              <Campo label="Título *" error={eTa.titulo?.message}>
                <input className={inputCls(eTa.titulo?.message)} placeholder="Ej: Taller de fracciones" maxLength={100}
                  {...regTa('titulo', { required: 'Requerido', minLength: { value: 3, message: 'Mínimo 3 caracteres' }, maxLength: { value: 100, message: 'Máximo 100' } })} />
              </Campo>
              <Campo label="Descripción (opcional)">
                <textarea rows={3} maxLength={800} className={`${inputCls()} resize-none`} placeholder="Instrucciones de la tarea..."
                  {...regTa('descripcion', { maxLength: { value: 800, message: 'Máximo 800 caracteres' } })} />
                <p className="mt-1 text-xs text-right text-slate-400">{watchDescTarea?.length ?? 0} / 800 caracteres</p>
              </Campo>
              <div className="flex justify-end">
                <button type="submit" disabled={crearTareaMutation.isPending} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50 min-h-[44px]">
                  {crearTareaMutation.isPending ? 'Publicando...' : 'Publicar tarea'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Modal crear/editar evento */}
      {modalEvento && (
        <Modal titulo={modalEvento === 'nuevo' ? 'Nuevo evento' : 'Editar evento'} onClose={() => setModalEvento(null)}>
          <form onSubmit={hEv(d => modalEvento === 'nuevo' ? crearEventoMutation.mutate(d) : editarEventoMutation.mutate({ ...d, id: modalEvento.id }))} className="space-y-4">
            <Campo label="Título *" error={eEv.titulo?.message}>
              <input className={inputCls(eEv.titulo?.message)} placeholder="Ej: Reunión de padres" maxLength={100}
                {...regEv('titulo', { required: 'Requerido', minLength: { value: 3, message: 'Mínimo 3 caracteres' }, maxLength: { value: 100, message: 'Máximo 100' } })} />
            </Campo>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Campo label="Tipo de evento *" error={eEv.tipoEvento?.message}>
                <select className={inputCls(eEv.tipoEvento?.message)} {...regEv('tipoEvento', { required: 'Requerido' })}>
                  <option value="">Seleccionar</option>
                  {TIPOS_EVENTO.map(t => <option key={t} value={t}>{LABEL_TIPO[t]}</option>)}
                </select>
              </Campo>
              <Campo label="Grado (opcional)" hint="Vacío = todos los grados">
                <select className={inputCls()} {...regEv('gradoId')}>
                  <option value="">Todos los grados</option>
                  {(grados as Grado[]).map(g => <option key={g.id} value={g.id}>{g.nombre}{g.grupo}</option>)}
                </select>
              </Campo>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Campo label="Fecha de inicio *" error={eEv.fechaInicio?.message}>
                <input type="date" className={inputCls(eEv.fechaInicio?.message)} {...regEv('fechaInicio', { required: 'Requerido' })} />
              </Campo>
              <Campo label="Fecha de fin (opcional)" error={eEv.fechaFin?.message}>
                <input type="date" className={inputCls(eEv.fechaFin?.message)} {...regEv('fechaFin')} />
              </Campo>
            </div>
            <Campo label="Descripción (opcional)">
              <textarea rows={3} maxLength={800} className={`${inputCls()} resize-none`} placeholder="Detalles del evento..."
                {...regEv('descripcion', { maxLength: { value: 800, message: 'Máximo 800 caracteres' } })} />
            </Campo>
            <BotonesForm onCancel={() => setModalEvento(null)} cargando={crearEventoMutation.isPending || editarEventoMutation.isPending} labelGuardar={modalEvento === 'nuevo' ? 'Crear evento' : 'Guardar cambios'} />
          </form>
        </Modal>
      )}

      {/* Confirmar eliminación */}
      {eliminarItem && (
        <Modal titulo={`Eliminar ${eliminarItem.tipo === 'evento' ? 'evento' : 'tarea'}`} onClose={() => setEliminarItem(null)} ancho="max-w-sm">
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-700">¿Eliminar <strong>{eliminarItem.titulo}</strong>? Esta acción no se puede deshacer.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEliminarItem(null)} className="px-4 py-2.5 text-sm text-slate-600 min-h-[44px]">Cancelar</button>
              <button onClick={() => eliminarMutation.mutate(eliminarItem)} disabled={eliminarMutation.isPending}
                className="px-5 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition disabled:opacity-50 min-h-[44px]">
                {eliminarMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
