import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Circle, FileCheck, KeyRound, ClipboardList, FileText, Search, GraduationCap } from 'lucide-react';
import api from '../services/api';

type MatriculaProgreso = {
  estadoDocumentos: string;
  fechaSolicitud: string;
  fechaAccesoOtorgado: string;
  fechaFormularioCompletado: string | null;
  fechaDocumentosSubidos: string | null;
  fechaVerificacion: string | null;
};

const formatearFecha = (f: string | null) => f ? new Date(f).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : null;

export default function ProgresoMatricula({ estudianteId }: { estudianteId: string }) {
  const { data, isLoading } = useQuery<MatriculaProgreso>({
    queryKey: ['mi-matricula', estudianteId],
    queryFn: async () => (await api.get(`/matriculas/estudiante/${estudianteId}`)).data.datos,
    enabled: !!estudianteId,
  });

  if (isLoading || !data) return null;

  const rechazado = data.estadoDocumentos === 'RECHAZADO';

  const pasos = [
    { id: 1, label: 'Solicitud recibida', icono: ClipboardList, fecha: data.fechaSolicitud, completado: true },
    { id: 2, label: 'Acceso otorgado', icono: KeyRound, fecha: data.fechaAccesoOtorgado, completado: true },
    { id: 3, label: 'Formulario completado', icono: FileCheck, fecha: data.fechaFormularioCompletado, completado: !!data.fechaFormularioCompletado },
    { id: 4, label: 'Documentos subidos', icono: FileText, fecha: data.fechaDocumentosSubidos, completado: !!data.fechaDocumentosSubidos },
    { id: 5, label: 'En revisión', icono: Search, fecha: null, completado: data.estadoDocumentos === 'VERIFICADO' || data.estadoDocumentos === 'RECHAZADO' },
    { id: 6, label: 'Matrícula confirmada', icono: GraduationCap, fecha: data.fechaVerificacion, completado: data.estadoDocumentos === 'VERIFICADO' },
  ];

  const indiceActual = pasos.findIndex(p => !p.completado);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <p className="text-sm font-semibold text-slate-700 mb-4">Progreso de la matrícula</p>
      <div className="flex items-start justify-between overflow-x-auto pb-1 gap-1">
        {pasos.map((paso, i) => {
          const Icono = paso.icono;
          const esActual = i === indiceActual && !rechazado;
          const estado = paso.completado ? 'completado' : esActual ? 'actual' : 'pendiente';
          return (
            <div key={paso.id} className="flex-1 min-w-[88px] flex flex-col items-center text-center relative">
              {i > 0 && (
                <div className={`absolute top-4 right-1/2 w-full h-0.5 -z-0 ${pasos[i - 1].completado ? 'bg-emerald-400' : 'bg-slate-200'}`} style={{ left: '-50%' }} />
              )}
              <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                estado === 'completado' ? 'bg-emerald-500 text-white' :
                estado === 'actual' ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
                'bg-slate-100 text-slate-400'
              }`}>
                {estado === 'completado' ? <CheckCircle className="w-4 h-4" /> : <Icono className="w-4 h-4" />}
              </div>
              <p className={`text-[11px] font-medium mt-2 leading-tight ${estado === 'pendiente' ? 'text-slate-400' : 'text-slate-700'}`}>{paso.label}</p>
              {paso.fecha && <p className="text-[10px] text-slate-400 mt-0.5">{formatearFecha(paso.fecha)}</p>}
            </div>
          );
        })}
      </div>
      {rechazado && (
        <div className="mt-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
          <Circle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-700">La matrícula fue rechazada. Revisa las observaciones de secretaría más abajo.</p>
        </div>
      )}
    </div>
  );
}
