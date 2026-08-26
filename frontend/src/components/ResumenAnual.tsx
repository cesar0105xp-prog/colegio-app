import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Trophy, AlertCircle, Minus } from 'lucide-react';
import api from '../services/api';

type Periodo = { id: string; nombre: string; numero: number; activo: boolean };
type FilaResumen = {
  materia: { id: string; nombre: string };
  profesor: string;
  notasPorPeriodo: Record<string, number | null>;
  promedioAnual: number | null;
};

const colorNota = (n: number | null): string => {
  if (n === null) return 'text-slate-300';
  if (n >= 90) return 'text-emerald-600 font-bold';
  if (n >= 70) return 'text-blue-600 font-semibold';
  return 'text-red-600 font-bold';
};

const bgNota = (n: number | null): string => {
  if (n === null) return 'bg-slate-50';
  if (n >= 90) return 'bg-emerald-50';
  if (n >= 70) return 'bg-blue-50';
  return 'bg-red-50';
};

export default function ResumenAnual({ estudianteId }: { estudianteId: string }) {
  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = useState(anioActual);

  const { data, isLoading } = useQuery({
    queryKey: ['resumen-anual', estudianteId, anio],
    queryFn: async () => (await api.get(`/boletin/${estudianteId}/resumen-anual`, { params: { anio } })).data.datos,
    enabled: !!estudianteId,
    staleTime: 0,
  });

  const periodos: Periodo[] = data?.periodos ?? [];
  const resumen: FilaResumen[] = data?.resumen ?? [];
  const promediosPorPeriodo: Record<string, number | null> = data?.promediosPorPeriodo ?? {};

  // Calcular promedio general del año
  const promediosValidos = resumen.map(r => r.promedioAnual).filter(n => n !== null) as number[];
  const promedioAnualGeneral = promediosValidos.length > 0
    ? (promediosValidos.reduce((a, b) => a + b, 0) / promediosValidos.length).toFixed(1)
    : '--';

  return (
    <div className="space-y-4">
      {/* Selector de año y resumen general */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">Año escolar:</label>
          <select value={anio} onChange={e => setAnio(parseInt(e.target.value))}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {[anioActual, anioActual - 1, anioActual - 2].map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        {promedioAnualGeneral !== '--' && (
          <div className={`flex items-center gap-3 px-4 py-2 rounded-xl ${parseFloat(promedioAnualGeneral) >= 90 ? 'bg-emerald-50 border border-emerald-200' : parseFloat(promedioAnualGeneral) >= 70 ? 'bg-blue-50 border border-blue-200' : 'bg-red-50 border border-red-200'}`}>
            {parseFloat(promedioAnualGeneral) >= 90 ? <Trophy className="w-5 h-5 text-emerald-600" /> : <TrendingUp className="w-5 h-5 text-blue-600" />}
            <div>
              <p className="text-xs text-slate-500">Promedio anual general</p>
              <p className={`text-xl font-bold ${colorNota(parseFloat(promedioAnualGeneral))}`}>{promedioAnualGeneral}</p>
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
      ) : periodos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center py-12 text-slate-400">
          <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay períodos registrados para {anio}</p>
        </div>
      ) : resumen.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center py-12 text-slate-400">
          <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Sin materias asignadas para este año</p>
        </div>
      ) : (
        <>
          {/* Tabla comparativa */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700">Notas por período — {anio}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Escala 0 – 100 · Mínimo aprobatorio: 70</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3 min-w-48 sticky left-0 bg-slate-50">Materia</th>
                    {periodos.map(p => (
                      <th key={p.id} className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 min-w-20">
                        <div>{p.nombre}</div>
                        {p.activo && <div className="text-blue-500 font-normal normal-case text-xs">Activo</div>}
                      </th>
                    ))}
                    <th className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3 min-w-24 bg-amber-50">Promedio año</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {resumen.map(fila => (
                    <tr key={fila.materia.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 sticky left-0 bg-white">
                        <p className="text-sm font-medium text-slate-800">{fila.materia.nombre}</p>
                        <p className="text-xs text-slate-400">Prof. {fila.profesor}</p>
                      </td>
                      {periodos.map(p => {
                        const nota = fila.notasPorPeriodo[p.id];
                        return (
                          <td key={p.id} className={`px-4 py-3 text-center ${bgNota(nota)}`}>
                            {nota !== null ? (
                              <span className={`text-base ${colorNota(nota)}`}>{nota.toFixed(1)}</span>
                            ) : (
                              <Minus className="w-4 h-4 text-slate-300 mx-auto" />
                            )}
                          </td>
                        );
                      })}
                      <td className={`px-4 py-3 text-center bg-amber-50 ${bgNota(fila.promedioAnual)}`}>
                        {fila.promedioAnual !== null ? (
                          <span className={`text-base font-bold ${colorNota(fila.promedioAnual)}`}>{fila.promedioAnual.toFixed(1)}</span>
                        ) : (
                          <Minus className="w-4 h-4 text-slate-300 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                  {/* Fila de promedios por período */}
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td className="px-5 py-3 sticky left-0 bg-slate-50">
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Promedio general</p>
                    </td>
                    {periodos.map(p => {
                      const prom = promediosPorPeriodo[p.id];
                      return (
                        <td key={p.id} className="px-4 py-3 text-center">
                          {prom !== null ? (
                            <span className={`text-base font-bold ${colorNota(prom)}`}>{prom.toFixed(1)}</span>
                          ) : (
                            <Minus className="w-4 h-4 text-slate-300 mx-auto" />
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center bg-amber-50">
                      <span className={`text-base font-bold ${colorNota(parseFloat(promedioAnualGeneral) || null)}`}>
                        {promedioAnualGeneral}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Leyenda */}
          <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 inline-block border border-emerald-200" /> Excelente (≥90)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-100 inline-block border border-blue-200" /> Aprobado (70–89)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 inline-block border border-red-200" /> En riesgo (&lt;70)</span>
            <span className="flex items-center gap-1.5"><Minus className="w-3 h-3 text-slate-300" /> Sin notas</span>
          </div>
        </>
      )}
    </div>
  );
}