// ─── CALENDARIO ACADÉMICO ─────────────────────────────────────────────────────
// Muestra actividades con fechas de entrega en un calendario mensual
// Usar en ProfesorDashboard y AdminDashboard como nueva sección

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Calendar, BookOpen } from 'lucide-react';
import api from '../services/api';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_SEMANA = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

const LABEL_TIPO: Record<string, string> = { TAREA:'Tarea', TALLER:'Taller', EXAMEN:'Examen', QUIZ:'Quiz', PROYECTO:'Proyecto', EXPOSICION:'Exposición', PARTICIPACION:'Participación' };
const COLOR_TIPO: Record<string, string> = { TAREA:'bg-blue-100 text-blue-700', TALLER:'bg-violet-100 text-violet-700', EXAMEN:'bg-red-100 text-red-700', QUIZ:'bg-amber-100 text-amber-700', PROYECTO:'bg-emerald-100 text-emerald-700', EXPOSICION:'bg-pink-100 text-pink-700', PARTICIPACION:'bg-slate-100 text-slate-600' };

type ActividadCal = { id: string; nombre: string; tipo: string; fechaEntrega: string; materia: { nombre: string }; grado: { nombre: string; grupo: string }; porcentaje: number };

export default function CalendarioAcademico({ soloProfesor = false }: { soloProfesor?: boolean }) {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth());
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [diaSeleccionado, setDiaSeleccionado] = useState<number | null>(null);

  const { data: periodos = [] } = useQuery({ queryKey: ['periodos'], queryFn: async () => (await api.get('/periodos')).data.datos ?? [] });
  const periodoActivo = (periodos as { id: string; nombre: string; activo: boolean }[]).find(p => p.activo);

  const { data: actividades = [], isLoading } = useQuery({
    queryKey: ['actividades-calendario', periodoActivo?.id],
    queryFn: async () => {
      const endpoint = soloProfesor ? '/actividades' : '/actividades';
      const res = await api.get(endpoint, { params: { periodoId: periodoActivo?.id, conFecha: true } });
      return (res.data?.lista ?? res.data?.datos ?? []).filter((a: ActividadCal) => !!a.fechaEntrega);
    },
    enabled: !!periodoActivo?.id,
  });

  // Agrupar actividades por fecha
  const actividadesPorDia = React.useMemo(() => {
    const mapa: Record<string, ActividadCal[]> = {};
    (actividades as ActividadCal[]).forEach(act => {
      if (!act.fechaEntrega) return;
      const fecha = new Date(act.fechaEntrega);
      if (fecha.getMonth() === mes && fecha.getFullYear() === anio) {
        const dia = fecha.getDate().toString();
        if (!mapa[dia]) mapa[dia] = [];
        mapa[dia].push(act);
      }
    });
    return mapa;
  }, [actividades, mes, anio]);

  // Construir grilla del calendario
  const primerDia = new Date(anio, mes, 1).getDay();
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const celdas = [...Array(primerDia).fill(null), ...Array.from({ length: diasEnMes }, (_, i) => i + 1)];
  while (celdas.length % 7 !== 0) celdas.push(null);

  const actividadesDelDia = diaSeleccionado ? (actividadesPorDia[diaSeleccionado.toString()] ?? []) : [];

  const anterior = () => { if (mes === 0) { setMes(11); setAnio(a => a - 1); } else setMes(m => m - 1); setDiaSeleccionado(null); };
  const siguiente = () => { if (mes === 11) { setMes(0); setAnio(a => a + 1); } else setMes(m => m + 1); setDiaSeleccionado(null); };

  const esHoy = (dia: number) => dia === hoy.getDate() && mes === hoy.getMonth() && anio === hoy.getFullYear();

  return (
    <div className="space-y-4">
      {/* Header del calendario */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={anterior} className="p-2 rounded-xl hover:bg-slate-100 transition-colors"><ChevronLeft className="w-5 h-5 text-slate-500" /></button>
          <div className="text-center">
            <h2 className="text-lg font-bold text-slate-800">{MESES[mes]} {anio}</h2>
            {periodoActivo && <p className="text-xs text-blue-600 font-medium">{periodoActivo.nombre} — activo</p>}
          </div>
          <button onClick={siguiente} className="p-2 rounded-xl hover:bg-slate-100 transition-colors"><ChevronRight className="w-5 h-5 text-slate-500" /></button>
        </div>

        {/* Días de la semana */}
        <div className="grid grid-cols-7 mb-2">
          {DIAS_SEMANA.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
          ))}
        </div>

        {/* Grilla */}
        {isLoading ? (
          <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {celdas.map((dia, i) => {
              const tieneActividades = dia && actividadesPorDia[dia.toString()];
              const seleccionado = dia === diaSeleccionado;
              return (
                <div key={i}
                  onClick={() => dia && setDiaSeleccionado(seleccionado ? null : dia)}
                  className={`min-h-14 p-1.5 rounded-xl cursor-pointer transition-all border ${
                    !dia ? 'opacity-0 cursor-default' :
                    seleccionado ? 'bg-blue-600 border-blue-600' :
                    esHoy(dia) ? 'border-blue-300 bg-blue-50' :
                    'border-transparent hover:border-slate-200 hover:bg-slate-50'
                  }`}>
                  {dia && (
                    <>
                      <p className={`text-xs font-semibold text-center ${seleccionado ? 'text-white' : esHoy(dia) ? 'text-blue-600' : 'text-slate-700'}`}>{dia}</p>
                      {tieneActividades && (
                        <div className="mt-1 flex flex-wrap gap-0.5 justify-center">
                          {actividadesPorDia[dia.toString()].slice(0, 3).map((_, j) => (
                            <div key={j} className={`w-1.5 h-1.5 rounded-full ${seleccionado ? 'bg-white' : 'bg-blue-500'}`} />
                          ))}
                          {actividadesPorDia[dia.toString()].length > 3 && (
                            <span className={`text-xs ${seleccionado ? 'text-blue-200' : 'text-slate-400'}`}>+{actividadesPorDia[dia.toString()].length - 3}</span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actividades del día seleccionado */}
      {diaSeleccionado && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-700">{diaSeleccionado} de {MESES[mes]} de {anio}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{actividadesDelDia.length} actividad(es) con entrega este día</p>
          </div>
          {actividadesDelDia.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin actividades para este día</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {actividadesDelDia.map(act => (
                <div key={act.id} className="px-5 py-4 flex items-start gap-3">
                  <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0"><BookOpen className="w-4 h-4 text-blue-600" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{act.nombre}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{act.materia?.nombre} · Grado {act.grado?.nombre}{act.grado?.grupo}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${COLOR_TIPO[act.tipo] ?? 'bg-slate-100 text-slate-600'}`}>{LABEL_TIPO[act.tipo] ?? act.tipo}</span>
                      <span className="text-xs text-blue-600 font-medium">{act.porcentaje}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lista de próximas entregas */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700">Próximas entregas</h3>
          <p className="text-xs text-slate-400 mt-0.5">Actividades con fecha de entrega próxima</p>
        </div>
        {(actividades as ActividadCal[])
          .filter(a => a.fechaEntrega && new Date(a.fechaEntrega) >= hoy)
          .sort((a, b) => new Date(a.fechaEntrega).getTime() - new Date(b.fechaEntrega).getTime())
          .slice(0, 8)
          .length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Sin entregas próximas registradas</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {(actividades as ActividadCal[])
              .filter(a => a.fechaEntrega && new Date(a.fechaEntrega) >= hoy)
              .sort((a, b) => new Date(a.fechaEntrega).getTime() - new Date(b.fechaEntrega).getTime())
              .slice(0, 8)
              .map(act => {
                const diasRestantes = Math.ceil((new Date(act.fechaEntrega).getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={act.id} className="px-5 py-3 flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0 text-center ${diasRestantes <= 2 ? 'bg-red-50' : diasRestantes <= 5 ? 'bg-amber-50' : 'bg-blue-50'}`}>
                      <p className={`text-xs font-bold ${diasRestantes <= 2 ? 'text-red-600' : diasRestantes <= 5 ? 'text-amber-600' : 'text-blue-600'}`}>{new Date(act.fechaEntrega).getDate()}</p>
                      <p className={`text-xs ${diasRestantes <= 2 ? 'text-red-400' : diasRestantes <= 5 ? 'text-amber-400' : 'text-blue-400'}`}>{MESES[new Date(act.fechaEntrega).getMonth()].slice(0, 3)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{act.nombre}</p>
                      <p className="text-xs text-slate-400">{act.materia?.nombre} · Grado {act.grado?.nombre}{act.grado?.grupo} · {act.porcentaje}%</p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${diasRestantes <= 2 ? 'bg-red-100 text-red-700' : diasRestantes <= 5 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                      {diasRestantes === 0 ? '¡Hoy!' : diasRestantes === 1 ? 'Mañana' : `${diasRestantes} días`}
                    </span>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}