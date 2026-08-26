import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen, MessageSquare, CheckCircle, ChevronDown, ChevronUp,
  FileText, Download, AlertTriangle, Star, Clock
} from 'lucide-react';
import api from '../../services/api';
import {
  Boletin, Observacion, Archivo, MateriaBoletin,
  COLOR_NOTA, COLOR_OBSERVACION, LABEL_TIPO_OBSERVACION, LABEL_TIPO_ACTIVIDAD,
  TipoObservacion
} from '../../types';

interface Props {
  estudianteId: string;
  periodoId?: string;
}

// ─── COMPONENTE MATERIA ───────────────────────────────────────────────────────

function TarjetaMateria({ materia }: { materia: MateriaBoletin }) {
  const [expandida, setExpandida] = useState(false);

  const notaColor = COLOR_NOTA(materia.notaPeriodo);
  const porcentajeFaltante = 100 - materia.porcentajeTotal;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Encabezado */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer"
        onClick={() => setExpandida(!expandida)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">{materia.materia.nombre}</h3>
            <p className="text-xs text-slate-500">Prof. {materia.profesor}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Nota del período */}
          <div className="text-right">
            <p className="text-xs text-slate-500 mb-0.5">Nota período</p>
            <p className={`text-2xl ${notaColor}`}>
              {materia.notaPeriodo !== null ? materia.notaPeriodo.toFixed(1) : '--'}
            </p>
          </div>
          {expandida ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </div>

      {/* Barra de progreso de porcentaje */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${materia.porcentajeTotal}%` }}
            />
          </div>
          <span className="text-xs text-slate-500">{materia.porcentajeTotal}%</span>
        </div>
        {porcentajeFaltante > 0 && (
          <p className="text-xs text-slate-400 mt-0.5">
            Faltan actividades por {porcentajeFaltante}%
          </p>
        )}
      </div>

      {/* Actividades desplegables */}
      {expandida && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
            Actividades
          </p>
          {materia.actividades.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Sin actividades registradas</p>
          ) : (
            materia.actividades.map((act) => (
              <div
                key={act.id}
                className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-medium">
                      {LABEL_TIPO_ACTIVIDAD[act.tipo]}
                    </span>
                    <span className="text-sm font-medium text-slate-700 truncate">{act.nombre}</span>
                  </div>
                  {act.observacion && (
                    <p className="text-xs text-slate-500 mt-1 truncate">{act.observacion}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 ml-3">
                  <span className="text-xs text-slate-400">{act.porcentaje}%</span>
                  <span className={`text-base font-bold ${COLOR_NOTA(act.nota)}`}>
                    {act.nota !== null ? act.nota.toFixed(1) : '--'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── COMPONENTE OBSERVACIÓN ───────────────────────────────────────────────────

function TarjetaObservacion({
  obs,
  onMarcarVisto,
}: {
  obs: Observacion;
  onMarcarVisto: (id: string) => void;
}) {
  return (
    <div
      className={`bg-white border rounded-xl p-4 shadow-sm transition-all ${
        obs.yaVista ? 'border-slate-200 opacity-75' : 'border-orange-200 shadow-orange-100'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${COLOR_OBSERVACION[obs.tipo as TipoObservacion]}`}>
              {LABEL_TIPO_OBSERVACION[obs.tipo as TipoObservacion]}
            </span>
            {!obs.yaVista && (
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Nueva
              </span>
            )}
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{obs.descripcion}</p>
          <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
            <span>Prof. {obs.profesor.nombres} {obs.profesor.apellidos}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(obs.fecha).toLocaleDateString('es-CO', {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </span>
          </div>
        </div>

        {/* Botón visto */}
        {!obs.yaVista ? (
          <button
            onClick={() => onMarcarVisto(obs.id)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            Marcar visto
          </button>
        ) : (
          <div className="flex-shrink-0 flex items-center gap-1 text-emerald-600 text-xs font-medium">
            <CheckCircle className="w-4 h-4" />
            Vista
          </div>
        )}
      </div>
    </div>
  );
}

// ─── VISTA PRINCIPAL ─────────────────────────────────────────────────────────

export default function BoletinPadre({ estudianteId, periodoId }: Props) {
  const [tab, setTab] = useState<'boletin' | 'observaciones' | 'archivos'>('boletin');
  const queryClient = useQueryClient();

  const { data: boletinData, isLoading: loadingBoletin } = useQuery({
    queryKey: ['boletin', estudianteId, periodoId],
    queryFn: async () => {
      const res = await api.get(`/boletin/${estudianteId}`, { params: { periodoId } });
      return res.data.datos as Boletin;
    },
    enabled: !!estudianteId,
  });

  const { data: observaciones = [], isLoading: loadingObs } = useQuery({
    queryKey: ['observaciones', estudianteId],
    queryFn: async () => {
      const res = await api.get(`/observaciones/${estudianteId}`);
      return res.data.datos as Observacion[];
    },
    enabled: !!estudianteId,
  });

  const { data: archivos = [] } = useQuery({
    queryKey: ['archivos', estudianteId],
    queryFn: async () => {
      const res = await api.get(`/archivos/estudiante/${estudianteId}`);
      return res.data.datos as Archivo[];
    },
    enabled: !!estudianteId,
  });

  const marcarVistoMutation = useMutation({
    mutationFn: (observacionId: string) =>
      api.post(`/observaciones/${observacionId}/visto`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['observaciones', estudianteId] });
    },
  });

  const obsNoVistas = observaciones.filter((o) => !o.yaVista).length;

  if (loadingBoletin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  const estudiante = boletinData?.estudiante;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Encabezado del estudiante */}
      {estudiante && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 mb-6 text-white shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-bold">
              {estudiante.nombres[0]}{estudiante.apellidos[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold">
                {estudiante.nombres} {estudiante.apellidos}
              </h1>
              <p className="text-blue-200 text-sm mt-0.5">{estudiante.grado}</p>
            </div>
          </div>

          {/* Promedio general */}
          {boletinData && (
            <div className="mt-5 pt-5 border-t border-white/20">
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-blue-200 text-xs mb-1">Promedio general</p>
                  <p className="text-3xl font-bold">
                    {(
                      boletinData.boletin
                        .filter((m) => m.notaPeriodo !== null)
                        .reduce((acc, m) => acc + (m.notaPeriodo ?? 0), 0) /
                      (boletinData.boletin.filter((m) => m.notaPeriodo !== null).length || 1)
                    ).toFixed(1)}
                  </p>
                </div>
                <div>
                  <p className="text-blue-200 text-xs mb-1">Materias</p>
                  <p className="text-3xl font-bold">{boletinData.boletin.length}</p>
                </div>
                {obsNoVistas > 0 && (
                  <div>
                    <p className="text-orange-200 text-xs mb-1">Observaciones nuevas</p>
                    <p className="text-3xl font-bold text-orange-300">{obsNoVistas}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6">
        {[
          { id: 'boletin', label: 'Boletín', icon: Star },
          { id: 'observaciones', label: `Observaciones${obsNoVistas > 0 ? ` (${obsNoVistas})` : ''}`, icon: MessageSquare },
          { id: 'archivos', label: 'Documentos', icon: FileText },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as typeof tab)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
              tab === id
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Contenido del tab */}
      {tab === 'boletin' && (
        <div className="space-y-3">
          {boletinData?.boletin.map((materia) => (
            <TarjetaMateria key={materia.materia.id} materia={materia} />
          ))}
        </div>
      )}

      {tab === 'observaciones' && (
        <div className="space-y-3">
          {loadingObs ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : observaciones.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay observaciones registradas</p>
            </div>
          ) : (
            observaciones.map((obs) => (
              <TarjetaObservacion
                key={obs.id}
                obs={obs}
                onMarcarVisto={(id) => marcarVistoMutation.mutate(id)}
              />
            ))
          )}
        </div>
      )}

      {tab === 'archivos' && (
        <div className="space-y-3">
          {archivos.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No hay documentos disponibles</p>
            </div>
          ) : (
            archivos.map((archivo) => (
              <div
                key={archivo.id}
                className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-800 text-sm">{archivo.nombreOriginal}</p>
                    <p className="text-xs text-slate-500">
                      {archivo.tipo} · {(archivo.tamanoBytes / 1024).toFixed(1)} KB ·{' '}
                      {new Date(archivo.createdAt).toLocaleDateString('es-CO')}
                    </p>
                    {archivo.descripcion && (
                      <p className="text-xs text-slate-400 mt-0.5">{archivo.descripcion}</p>
                    )}
                  </div>
                </div>
                <a
                  href={`/api/archivos/${archivo.id}/descargar`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 text-xs font-medium rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Ver
                </a>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
