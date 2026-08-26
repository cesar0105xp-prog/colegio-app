import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Plus, Save, AlertCircle, CheckCircle, BarChart2,
  BookOpen, Users, Percent
} from 'lucide-react';
import api from '../../services/api';
import { Actividad, TipoActividad, LABEL_TIPO_ACTIVIDAD } from '../../types';

interface FormActividad {
  nombre: string;
  tipo: TipoActividad;
  porcentaje: number;
  descripcion?: string;
  fechaEntrega?: string;
  materiaId: string;
  gradoId: string;
  periodoId: string;
}

const TIPOS_ACTIVIDAD = Object.keys(LABEL_TIPO_ACTIVIDAD) as TipoActividad[];

export default function ProfesorNotas() {
  const [materiaSeleccionada, setMateriaSeleccionada] = useState<string>('');
  const [gradoSeleccionado, setGradoSeleccionado] = useState<string>('');
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<string>('');
  const [mostrarFormActividad, setMostrarFormActividad] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const queryClient = useQueryClient();

  const { data: actividades = [], isLoading } = useQuery({
    queryKey: ['actividades', materiaSeleccionada, gradoSeleccionado, periodoSeleccionado],
    queryFn: async () => {
      const res = await api.get('/actividades', {
        params: { materiaId: materiaSeleccionada, gradoId: gradoSeleccionado, periodoId: periodoSeleccionado },
      });
      return { lista: res.data.datos as Actividad[], meta: res.data.meta };
    },
    enabled: !!(materiaSeleccionada && gradoSeleccionado && periodoSeleccionado),
  });

  const {
    register: regActividad,
    handleSubmit: handleActividad,
    reset: resetActividad,
    formState: { errors: errActividad },
  } = useForm<FormActividad>();

  const crearActividadMutation = useMutation({
    mutationFn: (data: FormActividad) => api.post('/actividades', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actividades'] });
      resetActividad();
      setMostrarFormActividad(false);
      setMensaje({ tipo: 'ok', texto: 'Actividad creada correctamente' });
      setTimeout(() => setMensaje(null), 3000);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? 'Error al crear actividad';
      setMensaje({ tipo: 'error', texto: msg });
    },
  });

  const porcentajeTotal = Array.isArray(actividades)
    ? 0
    : (actividades as { lista: Actividad[]; meta: { totalPorcentaje: number } }).meta?.totalPorcentaje ?? 0;

  const actividadesList = Array.isArray(actividades)
    ? actividades
    : (actividades as { lista: Actividad[] }).lista ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Registro de notas</h1>

      {/* Mensaje de estado */}
      {mensaje && (
        <div
          className={`mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
            mensaje.tipo === 'ok'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {mensaje.tipo === 'ok' ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          {mensaje.texto}
        </div>
      )}

      {/* Filtros */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">Grado</label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={gradoSeleccionado}
              onChange={(e) => setGradoSeleccionado(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar grado</option>
              {/* Se llenarán desde la API */}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">Materia</label>
          <div className="relative">
            <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={materiaSeleccionada}
              onChange={(e) => setMateriaSeleccionada(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar materia</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">Período</label>
          <select
            value={periodoSeleccionado}
            onChange={(e) => setPeriodoSeleccionado(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleccionar período</option>
            <option value="p1">Período 1</option>
            <option value="p2">Período 2</option>
            <option value="p3">Período 3</option>
            <option value="p4">Período 4</option>
          </select>
        </div>
      </div>

      {/* Barra de porcentaje */}
      {materiaSeleccionada && gradoSeleccionado && periodoSeleccionado && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex items-center gap-4">
          <Percent className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-slate-600 font-medium">Porcentaje asignado</span>
              <span className={`font-bold ${porcentajeTotal === 100 ? 'text-emerald-600' : 'text-blue-600'}`}>
                {porcentajeTotal}% / 100%
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  porcentajeTotal === 100 ? 'bg-emerald-500' : porcentajeTotal > 100 ? 'bg-red-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(porcentajeTotal, 100)}%` }}
              />
            </div>
          </div>
          {porcentajeTotal < 100 && (
            <span className="text-sm text-slate-400">Faltan {100 - porcentajeTotal}%</span>
          )}
        </div>
      )}

      {/* Lista de actividades */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-slate-400" />
            <h2 className="font-semibold text-slate-700">Actividades</h2>
          </div>
          <button
            onClick={() => setMostrarFormActividad(!mostrarFormActividad)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva actividad
          </button>
        </div>

        {/* Formulario nueva actividad */}
        {mostrarFormActividad && (
          <form
            onSubmit={handleActividad((data) =>
              crearActividadMutation.mutate({
                ...data,
                materiaId: materiaSeleccionada,
                gradoId: gradoSeleccionado,
                periodoId: periodoSeleccionado,
              })
            )}
            className="p-4 border-b border-slate-100 bg-blue-50/50"
          >
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="col-span-2 md:col-span-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre de la actividad</label>
                <input
                  placeholder="Ej: Taller de fracciones"
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errActividad.nombre ? 'border-red-400' : 'border-slate-200'
                  }`}
                  {...regActividad('nombre', {
                    required: 'Requerido',
                    maxLength: { value: 100, message: 'Máximo 100 caracteres' },
                  })}
                />
                {errActividad.nombre && (
                  <p className="text-xs text-red-500 mt-0.5">{errActividad.nombre.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  {...regActividad('tipo', { required: 'Requerido' })}
                >
                  <option value="">Seleccionar</option>
                  {TIPOS_ACTIVIDAD.map((t) => (
                    <option key={t} value={t}>{LABEL_TIPO_ACTIVIDAD[t]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Porcentaje (%) — Disponible: {100 - porcentajeTotal}%
                </label>
                <input
                  type="number"
                  min={1}
                  max={100 - porcentajeTotal}
                  placeholder="Ej: 20"
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errActividad.porcentaje ? 'border-red-400' : 'border-slate-200'
                  }`}
                  {...regActividad('porcentaje', {
                    required: 'Requerido',
                    min: { value: 1, message: 'Mínimo 1%' },
                    max: { value: 100 - porcentajeTotal, message: `Máximo disponible: ${100 - porcentajeTotal}%` },
                    valueAsNumber: true,
                  })}
                />
                {errActividad.porcentaje && (
                  <p className="text-xs text-red-500 mt-0.5">{errActividad.porcentaje.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de entrega (opcional)</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  {...regActividad('fechaEntrega')}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Descripción (opcional)</label>
                <textarea
                  rows={2}
                  placeholder="Descripción de la actividad..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  {...regActividad('descripcion')}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setMostrarFormActividad(false); resetActividad(); }}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={crearActividadMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {crearActividadMutation.isPending ? 'Guardando...' : 'Guardar actividad'}
              </button>
            </div>
          </form>
        )}

        {/* Tabla de actividades */}
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : actividadesList.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <BarChart2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">
              {materiaSeleccionada
                ? 'No hay actividades para este período'
                : 'Selecciona grado, materia y período para ver las actividades'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {actividadesList.map((act) => (
              <div key={act.id} className="px-4 py-3 flex items-center gap-4 hover:bg-slate-50 transition">
                <div className="w-20 text-center">
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded font-medium">
                    {LABEL_TIPO_ACTIVIDAD[act.tipo]}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-800 text-sm">{act.nombre}</p>
                  {act.descripcion && (
                    <p className="text-xs text-slate-400 mt-0.5">{act.descripcion}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-blue-600">{act.porcentaje}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
