// ─── MÓDULO DE REPORTES CON GRÁFICAS ─────────────────────────────────────────
// Reemplaza la función Reportes() en AdminDashboard.tsx

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { FileText, BarChart2, GraduationCap, AlertCircle, FileSpreadsheet, X, Trophy, TrendingUp } from 'lucide-react';
import api from '../services/api';

// Colores para gráficas
const COLORES = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#F97316','#EC4899'];
const COLOR_APROBADO = '#10B981';
const COLOR_REPROBADO = '#EF4444';
const COLOR_EN_RIESGO = '#F59E0B';

async function descargarExcel(endpoint: string, params: Record<string, string>, setToast: (t: { msg: string; tipo: 'ok' | 'error' } | null) => void) {
  try {
    const res = await api.get(endpoint, { params, responseType: 'blob' });
    const nombreArchivo = res.headers['content-disposition']?.match(/filename="(.+)"/)?.[1] ?? 'notas.xlsx';
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url; link.download = nombreArchivo;
    document.body.appendChild(link); link.click(); link.remove();
    window.URL.revokeObjectURL(url);
  } catch { setToast({ msg: 'Error al exportar. Verifica que haya notas registradas.', tipo: 'error' }); }
}

function Toast({ mensaje, tipo, onClose }: { mensaje: string; tipo: 'ok' | 'error'; onClose: () => void }) {
  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${tipo === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
      {tipo === 'ok' ? <GraduationCap className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {mensaje}
      <button onClick={onClose}><X className="w-4 h-4" /></button>
    </div>
  );
}

function TooltipNota({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const nota = payload[0].value;
  const color = nota >= 90 ? COLOR_APROBADO : nota >= 70 ? '#3B82F6' : COLOR_REPROBADO;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2">
      <p className="text-xs font-semibold text-slate-600 mb-1">{label}</p>
      <p style={{ color }} className="text-sm font-bold">{nota?.toFixed(1)} / 100</p>
      <p className="text-xs text-slate-400">{nota >= 90 ? 'Excelente' : nota >= 70 ? 'Aprobado' : 'Reprobado'}</p>
    </div>
  );
}

export default function Reportes() {
  const [gradoId, setGradoId] = useState('');
  const [periodoId, setPeriodoId] = useState('');
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);
  const [tabActiva, setTabActiva] = useState<'rendimiento' | 'boletines' | 'destacados' | 'observaciones'>('rendimiento');

  const { data: grados = [] } = useQuery({ queryKey: ['grados'], queryFn: async () => (await api.get('/grados')).data.datos ?? [] });
  const { data: periodos = [] } = useQuery({ queryKey: ['periodos'], queryFn: async () => (await api.get('/periodos')).data.datos ?? [] });

  // Rendimiento por materia
  const { data: rendimiento = [], isLoading: loadingRend } = useQuery({
    queryKey: ['reporte-rendimiento', periodoId],
    queryFn: async () => (await api.get('/reportes/rendimiento-materia', { params: { periodoId } })).data.datos ?? [],
    enabled: !!periodoId,
  });

  // Boletines por grado
  const { data: boletines = [], isLoading: loadingBol } = useQuery({
    queryKey: ['reporte-boletines', gradoId, periodoId],
    queryFn: async () => (await api.get('/reportes/boletines-grado', { params: { gradoId, periodoId } })).data.datos ?? [],
    enabled: !!(gradoId && periodoId),
  });

  // Estudiantes destacados
  const { data: destacados = [], isLoading: loadingDest } = useQuery({
    queryKey: ['reporte-destacados', periodoId],
    queryFn: async () => (await api.get('/reportes/estudiantes-destacados', { params: { periodoId } })).data.datos ?? [],
    enabled: !!periodoId,
  });

  // Observaciones pendientes
  const { data: obsPendientes = [], isLoading: loadingObs } = useQuery({
    queryKey: ['reporte-obs-pendientes'],
    queryFn: async () => (await api.get('/reportes/observaciones-pendientes')).data.datos ?? [],
  });

  // Calcular distribución de notas para el gráfico de pie
  const distribucionNotas = React.useMemo(() => {
    if (!boletines.length) return [];
    const promedios = (boletines as { promedio: number | null }[]).map(e => e.promedio).filter(Boolean) as number[];
    const excelente = promedios.filter(n => n >= 90).length;
    const aprobado = promedios.filter(n => n >= 70 && n < 4.5).length;
    const riesgo = promedios.filter(n => n < 70).length;
    return [
      { name: 'Excelente (≥90)', value: excelente, color: COLOR_APROBADO },
      { name: 'Aprobado (70–89)', value: aprobado, color: '#3B82F6' },
      { name: 'En riesgo (<70)', value: riesgo, color: COLOR_REPROBADO },
    ].filter(d => d.value > 0);
  }, [boletines]);

  const TABS = [
    { id: 'rendimiento', label: 'Por materia', icono: BarChart2 },
    { id: 'boletines', label: 'Por grado', icono: FileText },
    { id: 'destacados', label: 'Destacados', icono: Trophy },
    { id: 'observaciones', label: 'Obs. pendientes', icono: AlertCircle },
  ] as const;

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Período *</label>
            <select value={periodoId} onChange={e => setPeriodoId(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white">
              <option value="">Seleccionar período</option>
              {(periodos as { id: string; nombre: string; activo: boolean }[]).map(p => <option key={p.id} value={p.id}>{p.nombre}{p.activo ? ' ✓' : ''}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Grado (para boletín)</label>
            <select value={gradoId} onChange={e => setGradoId(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white">
              <option value="">Todos los grados</option>
              {(grados as { id: string; nombre: string; grupo: string }[]).map(g => <option key={g.id} value={g.id}>{g.nombre}{g.grupo}</option>)}
            </select>
          </div>
          {gradoId && periodoId && (
            <button onClick={() => descargarExcel('/exportar/notas-grado', { gradoId, periodoId }, setToast)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition">
              <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTabActiva(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium rounded-lg transition-colors ${tabActiva === t.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <t.icono className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── RENDIMIENTO POR MATERIA ── */}
      {tabActiva === 'rendimiento' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-semibold text-slate-700 mb-4">Promedio por materia</h3>
          {!periodoId ? (
            <p className="text-sm text-slate-400 italic text-center py-8">Selecciona un período para ver el reporte</p>
          ) : loadingRend ? (
            <div className="flex items-center justify-center h-48"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
          ) : !(rendimiento as unknown[]).length ? (
            <p className="text-sm text-slate-400 italic text-center py-8">Sin datos para este período</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={rendimiento as { materia: string; promedioGeneral: number }[]} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="materia" tick={{ fontSize: 11, fill: '#64748B' }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={v => v.toFixed(1)} />
                  <Tooltip content={<TooltipNota />} />
                  <Bar dataKey="promedioGeneral" radius={[6, 6, 0, 0]}>
                    {(rendimiento as { promedioGeneral: number }[]).map((entry, i) => (
                      <Cell key={i} fill={entry.promedioGeneral >= 90 ? COLOR_APROBADO : entry.promedioGeneral >= 70 ? '#3B82F6' : COLOR_REPROBADO} />
                    ))}
                  </Bar>
                  {/* Línea de mínimo aprobatorio */}
                  <Line type="monotone" dataKey={() => 3.0} stroke={COLOR_REPROBADO} strokeDasharray="4 4" dot={false} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-4 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Excelente (≥90)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Aprobado (≥3.0)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Reprobado (&lt;3.0)</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── BOLETINES POR GRADO ── */}
      {tabActiva === 'boletines' && (
        <div className="space-y-4">
          {!gradoId || !periodoId ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center text-slate-400">
              <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Selecciona un grado y período para ver el boletín</p>
            </div>
          ) : loadingBol ? (
            <div className="flex items-center justify-center h-48"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
          ) : (
            <>
              {/* Gráfico de distribución */}
              {distribucionNotas.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <h3 className="font-semibold text-slate-700 mb-3 text-sm">Distribución de promedios</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={distribucionNotas} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ percent }: { percent?: number }) => `${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                          {distribucionNotas.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Legend formatter={(value) => <span className="text-xs text-slate-600">{value}</span>} />
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <h3 className="font-semibold text-slate-700 mb-3 text-sm">Estadísticas del grado</h3>
                    <div className="space-y-3">
                      {[
                        { label: 'Total estudiantes', valor: (boletines as unknown[]).length, color: 'text-slate-700' },
                        { label: 'Promedio del grado', valor: ((boletines as { promedio: number | null }[]).filter(e => e.promedio).reduce((a, e) => a + (e.promedio ?? 0), 0) / (boletines as { promedio: number | null }[]).filter(e => e.promedio).length || 0).toFixed(1), color: 'text-blue-600' },
                        { label: 'Excelentes (≥90)', valor: (boletines as { promedio: number | null }[]).filter(e => (e.promedio ?? 0) >= 90).length, color: 'text-emerald-600' },
                        { label: 'En riesgo (<70)', valor: (boletines as { promedio: number | null }[]).filter(e => e.promedio !== null && (e.promedio ?? 0) < 70).length, color: 'text-red-600' },
                      ].map(s => (
                        <div key={s.label} className="flex items-center justify-between py-2 border-b border-slate-50">
                          <p className="text-xs text-slate-500">{s.label}</p>
                          <p className={`text-lg font-bold ${s.color}`}>{s.valor}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {/* Tabla de estudiantes */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">Notas por estudiante</p>
                  <p className="text-xs text-slate-400">{(boletines as unknown[]).length} estudiante(s)</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Estudiante</th>
                        <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wide px-3 py-3">Promedio</th>
                        <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wide px-3 py-3">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(boletines as { estudiante: string; documento: string; promedio: number | null }[])
                        .sort((a, b) => (b.promedio ?? 0) - (a.promedio ?? 0))
                        .map((e, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">{e.estudiante[0]}</div>
                              <div>
                                <p className="text-sm font-medium text-slate-800">{e.estudiante}</p>
                                <p className="text-xs text-slate-400">{e.documento}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`text-lg font-bold ${!e.promedio ? 'text-slate-400' : e.promedio >= 90 ? 'text-emerald-600' : e.promedio >= 70 ? 'text-blue-600' : 'text-red-600'}`}>
                              {e.promedio != null ? e.promedio.toFixed(1) : '—'}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            {e.promedio == null ? <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-lg">Sin notas</span>
                              : e.promedio >= 90 ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg font-medium">🏆 Excelente</span>
                              : e.promedio >= 70 ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg font-medium">✓ Aprobado</span>
                              : <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-lg font-medium">⚠ En riesgo</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── ESTUDIANTES DESTACADOS ── */}
      {tabActiva === 'destacados' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h3 className="font-semibold text-slate-700 mb-4">Estudiantes con promedio ≥ 90</h3>
          {!periodoId ? (
            <p className="text-sm text-slate-400 italic text-center py-8">Selecciona un período</p>
          ) : loadingDest ? (
            <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
          ) : !(destacados as unknown[]).length ? (
            <p className="text-sm text-slate-400 italic text-center py-8">No hay estudiantes destacados en este período</p>
          ) : (
            <div className="space-y-2">
              {(destacados as { estudiante: string; grado: string; promedio: number }[]).map((d, i) => (
                <div key={i} className={`flex items-center justify-between p-4 rounded-xl border ${i === 0 ? 'border-amber-200 bg-amber-50' : i === 1 ? 'border-slate-200 bg-slate-50' : i === 2 ? 'border-orange-200 bg-orange-50' : 'border-slate-100 bg-white'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-400 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'bg-blue-100 text-blue-700'}`}>
                      {i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{d.estudiante}</p>
                      <p className="text-xs text-slate-400">Grado {d.grado}</p>
                    </div>
                  </div>
                  <span className="text-xl font-bold text-emerald-600">{d.promedio.toFixed(1)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── OBSERVACIONES PENDIENTES ── */}
      {tabActiva === 'observaciones' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-700">Observaciones no vistas por los padres</h3>
            {!loadingObs && <span className="text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-lg font-medium">{(obsPendientes as unknown[]).length} pendiente(s)</span>}
          </div>
          {loadingObs ? (
            <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
          ) : !(obsPendientes as unknown[]).length ? (
            <div className="text-center py-10 text-slate-400">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">¡Todo al día! No hay observaciones pendientes</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {(obsPendientes as { estudiante: string; tipo: string; descripcion: string; profesor: string; fecha: string; diasSinVer: number }[]).map((o, i) => (
                <div key={i} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm font-semibold text-slate-800">{o.estudiante}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${{ POSITIVA:'bg-emerald-100 text-emerald-700', NEGATIVA:'bg-red-100 text-red-700', NEUTRA:'bg-slate-100 text-slate-600', DISCIPLINARIA:'bg-orange-100 text-orange-700', ACADEMICA:'bg-blue-100 text-blue-700', CONVIVENCIA:'bg-purple-100 text-purple-700' }[o.tipo] ?? 'bg-slate-100'}`}>{o.tipo}</span>
                      </div>
                      <p className="text-xs text-slate-500 break-words line-clamp-2">{o.descripcion}</p>
                      <p className="text-xs text-slate-400 mt-1">Prof. {o.profesor} · {new Date(o.fecha).toLocaleDateString('es-CO')}</p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${o.diasSinVer > 7 ? 'bg-red-100 text-red-700' : o.diasSinVer > 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                      {o.diasSinVer}d sin ver
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}