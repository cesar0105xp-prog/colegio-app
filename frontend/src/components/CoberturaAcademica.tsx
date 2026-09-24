import { useQuery } from '@tanstack/react-query';
import { CheckCircle, AlertTriangle, LayoutGrid } from 'lucide-react';
import api from '../services/api';

// Matriz de grados por materias: verde donde hay docente asignado y rojo donde
// falta, para ver de un vistazo qué queda por asignar.
type Celda = { materiaId: string; profesor: string | null };
type Fila = { gradoId: string; grado: string; nivel: string; celdas: Celda[]; conDocente: number };
type Cobertura = {
  materias: { id: string; nombre: string }[];
  filas: Fila[];
  meta: { anio: number; totalCeldas: number; cubiertas: number; sinDocente: number };
};

export default function CoberturaAcademica() {
  const { data, isLoading } = useQuery({
    queryKey: ['cobertura-academica'],
    queryFn: async () => (await api.get('/reportes/cobertura')).data.datos as Cobertura,
  });

  if (isLoading) return <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;
  if (!data || data.filas.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm text-center py-12 text-slate-400">
        <LayoutGrid className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Todavía no hay grados ni materias para mostrar</p>
      </div>
    );
  }

  const { materias, filas, meta } = data;
  const porcentaje = meta.totalCeldas > 0 ? Math.round((meta.cubiertas / meta.totalCeldas) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Con docente asignado', valor: meta.cubiertas, color: 'text-emerald-600', icono: CheckCircle },
          { label: 'Sin docente', valor: meta.sinDocente, color: 'text-red-600', icono: AlertTriangle },
          { label: 'Cobertura', valor: `${porcentaje}%`, color: 'text-blue-600', icono: LayoutGrid },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <s.icono className={`w-4 h-4 ${s.color}`} />
              <p className="text-xs text-slate-400">{s.label}</p>
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.valor}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700">Grados y materias — {meta.anio}</h3>
          <p className="text-xs text-slate-400 mt-0.5">Verde: hay docente. Rojo: falta asignar. Toca una casilla para ver el nombre.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left font-semibold text-slate-500 uppercase tracking-wide px-3 py-3 sticky left-0 bg-slate-50 z-10">Grado</th>
                {materias.map(m => (
                  <th key={m.id} className="px-2 py-3 font-semibold text-slate-500 text-center align-bottom">
                    <span className="block whitespace-nowrap">{m.nombre}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filas.map(f => (
                <tr key={f.gradoId} className="hover:bg-slate-50">
                  <td className="px-3 py-2 sticky left-0 bg-white font-medium text-slate-800 whitespace-nowrap">
                    {f.grado}
                    <span className="block text-[11px] font-normal text-slate-400">{f.conDocente} de {materias.length}</span>
                  </td>
                  {f.celdas.map(c => (
                    <td key={c.materiaId} className="px-2 py-2 text-center">
                      <span title={c.profesor ?? 'Sin docente asignado'}
                        className={`inline-block w-full min-w-[34px] min-h-[28px] leading-7 rounded-lg font-semibold ${c.profesor ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                        {c.profesor ? '✓' : '—'}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {meta.sinDocente > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-sm font-semibold text-slate-700 mb-2">Qué falta por asignar</p>
          <div className="space-y-1.5">
            {filas.filter(f => f.conDocente < materias.length).map(f => (
              <p key={f.gradoId} className="text-xs text-slate-600">
                <span className="font-medium">{f.grado}:</span>{' '}
                {f.celdas.filter(c => !c.profesor).map(c => materias.find(m => m.id === c.materiaId)?.nombre).join(' · ')}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
