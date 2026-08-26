import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, XCircle, Clock, FileText } from 'lucide-react';
import api from '../services/api';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const COLOR_DIA: Record<string, string> = {
  PRESENTE: 'bg-emerald-100 text-emerald-700',
  AUSENTE: 'bg-red-100 text-red-700',
  TARDE: 'bg-amber-100 text-amber-700',
  EXCUSA: 'bg-blue-100 text-blue-700',
};

type Registro = { id: string; fecha: string; estadoManana: string; estadoTarde: string; observacion: string | null; justificada: boolean; estadoDia: string };
type Contador = { presencias: number; ausencias: number; tardanzas: number; excusas: number };

function fmtFechaUTC(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function HistorialAsistencia({ estudianteId }: { estudianteId: string }) {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth()); // 0-11

  const diasEnMes = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  const desde = fmtFechaUTC(anio, mes, 1);
  const hasta = fmtFechaUTC(anio, mes, diasEnMes);

  const { data, isLoading } = useQuery({
    queryKey: ['historial-asistencia', estudianteId, anio, mes],
    queryFn: async () => (await api.get(`/asistencia/estudiante/${estudianteId}`, { params: { desde, hasta } })).data.datos,
    enabled: !!estudianteId,
  });

  const registros = (data?.registros ?? []) as Registro[];
  const contador = (data?.contador ?? { presencias: 0, ausencias: 0, tardanzas: 0, excusas: 0 }) as Contador;
  const ausenciasSinJustificar = data?.ausenciasSinJustificar ?? 0;

  const porFecha = new Map(registros.map(r => [r.fecha.split('T')[0], r]));

  // Primer día del mes: 0=domingo ... 6=sábado → convertir a lunes=0
  const primerDiaSemana = (new Date(Date.UTC(anio, mes, 1)).getUTCDay() + 6) % 7;
  const celdas: (number | null)[] = [...Array(primerDiaSemana).fill(null), ...Array.from({ length: diasEnMes }, (_, i) => i + 1)];

  const cambiarMes = (delta: number) => {
    let nuevoMes = mes + delta, nuevoAnio = anio;
    if (nuevoMes < 0) { nuevoMes = 11; nuevoAnio--; }
    if (nuevoMes > 11) { nuevoMes = 0; nuevoAnio++; }
    setMes(nuevoMes); setAnio(nuevoAnio);
  };

  return (
    <div className="space-y-4">
      {/* Contadores */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Presencias', valor: contador.presencias, color: 'text-emerald-600', icono: CheckCircle },
          { label: 'Ausencias', valor: contador.ausencias, color: 'text-red-600', icono: XCircle },
          { label: 'Tardanzas', valor: contador.tardanzas, color: 'text-amber-600', icono: Clock },
          { label: 'Excusas', valor: contador.excusas, color: 'text-blue-600', icono: FileText },
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

      {ausenciasSinJustificar > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">
            Tienes <strong>{ausenciasSinJustificar}</strong> ausencia(s) sin justificar este mes. Contacta al colegio si necesitas justificarlas.
          </p>
        </div>
      )}

      {/* Calendario */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => cambiarMes(-1)} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors min-h-[36px] min-w-[36px]"><ChevronLeft className="w-4 h-4" /></button>
          <p className="text-sm font-semibold text-slate-700">{MESES[mes]} {anio}</p>
          <button onClick={() => cambiarMes(1)} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors min-h-[36px] min-w-[36px]"><ChevronRight className="w-4 h-4" /></button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1.5 mb-1.5">
              {DIAS_SEMANA.map(d => <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {celdas.map((dia, i) => {
                if (dia === null) return <div key={`vacio-${i}`} />;
                const fechaStr = fmtFechaUTC(anio, mes, dia);
                const registro = porFecha.get(fechaStr);
                const color = registro ? COLOR_DIA[registro.estadoDia] : 'text-slate-300';
                return (
                  <div key={dia} title={registro ? `${registro.estadoDia}${registro.observacion ? ': ' + registro.observacion : ''}` : undefined}
                    className={`aspect-square flex items-center justify-center rounded-lg text-xs font-medium ${registro ? color : 'bg-slate-50'}`}>
                    {dia}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-slate-100">
              {Object.entries(COLOR_DIA).map(([estado, color]) => (
                <div key={estado} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className={`w-3 h-3 rounded ${color.split(' ')[0]}`} /> {estado === 'PRESENTE' ? 'Presente' : estado === 'AUSENTE' ? 'Ausente' : estado === 'TARDE' ? 'Tarde' : 'Excusa'}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
