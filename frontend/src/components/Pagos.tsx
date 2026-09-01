import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  CreditCard, Plus, Edit2, Power, Wallet, BarChart2, CheckCircle,
  AlertCircle, X, Search, Download, DollarSign, Ban, ChevronLeft, ChevronRight,
  Receipt, Eye, Check, XCircle,
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/auth.store';

// ─── HELPERS COMPARTIDOS (mismos patrones que el resto del panel) ─────────────

function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

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

function Badge({ texto, color }: { texto: string; color: string }) {
  return <span className={`text-xs px-2.5 py-1 rounded-lg font-medium whitespace-nowrap ${color}`}>{texto}</span>;
}

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
const METODOS_PAGO = ['EFECTIVO', 'TRANSFERENCIA', 'BANCO_BOGOTA', 'PSE', 'NEQUI'];
const LABEL_METODO: Record<string, string> = { EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia', BANCO_BOGOTA: 'Banco de Bogotá', PSE: 'PSE', NEQUI: 'Nequi' };
const ESTADO_COLOR: Record<string, string> = { PENDIENTE: 'bg-red-50 text-red-600', PAGADO: 'bg-emerald-50 text-emerald-700', EXONERADO: 'bg-slate-100 text-slate-500', EN_VERIFICACION: 'bg-amber-50 text-amber-700' };
const LABEL_ESTADO: Record<string, string> = { PENDIENTE: 'Pendiente', PAGADO: 'Pagado', EXONERADO: 'Exonerado', EN_VERIFICACION: 'En verificación' };

const formatoCOP = (n: number) => n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const anioActual = new Date().getFullYear();
const ANIOS = Array.from({ length: 5 }, (_, i) => Math.max(2020, anioActual - 2) + i).filter(a => a <= 2030);

type Grado = { id: string; nombre: string; grupo: string };
type Concepto = { id: string; nombre: string; descripcion?: string | null; monto: string; activo: boolean };
type Cobro = {
  id: string; anio: number; mes: number; montoCobrado: string; estadoPago: 'PENDIENTE' | 'PAGADO' | 'EXONERADO';
  fechaPago: string | null; metodoPago: string | null; observaciones: string | null;
  estudiante: { id: string; nombres: string; apellidos: string; grado: { id: string; nombre: string; grupo: string } };
  concepto: { id: string; nombre: string };
};

// ─── TAB: CONCEPTOS DE PAGO ────────────────────────────────────────────────────

type FormConcepto = { nombre: string; descripcion?: string; monto: number };

function TabConceptos({ esAdmin }: { esAdmin: boolean }) {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Concepto | null>(null);
  const [confirmarDesactivar, setConfirmarDesactivar] = useState<Concepto | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);

  const { data: conceptos = [], isLoading } = useQuery({
    queryKey: ['conceptos-pago'],
    queryFn: async () => (await api.get('/conceptos')).data.datos ?? [],
    staleTime: 0,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormConcepto>();
  const { register: regE, handleSubmit: hE, reset: resetE, formState: { errors: eE } } = useForm<FormConcepto>();

  useEffect(() => {
    if (editando) resetE({ nombre: editando.nombre, descripcion: editando.descripcion ?? '', monto: Number(editando.monto) });
  }, [editando]);

  const crearMutation = useMutation({
    mutationFn: (d: FormConcepto) => api.post('/conceptos', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['conceptos-pago'] }); setModal(false); reset(); setToast({ msg: 'Concepto de pago creado', tipo: 'ok' }); },
    onError: (e: unknown) => setToast({ msg: mensajeError(e, 'Error al crear'), tipo: 'error' }),
  });

  const editarMutation = useMutation({
    mutationFn: ({ id, ...d }: FormConcepto & { id: string }) => api.put(`/conceptos/${id}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['conceptos-pago'] }); setEditando(null); setToast({ msg: 'Concepto actualizado', tipo: 'ok' }); },
    onError: (e: unknown) => setToast({ msg: mensajeError(e, 'Error al actualizar'), tipo: 'error' }),
  });

  const desactivarMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/conceptos/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['conceptos-pago'] }); setConfirmarDesactivar(null); setToast({ msg: 'Concepto desactivado', tipo: 'ok' }); },
    onError: (e: unknown) => { setConfirmarDesactivar(null); setToast({ msg: mensajeError(e, 'Error al desactivar'), tipo: 'error' }); },
  });

  const FormularioConcepto = ({ reg, errs, onSubmit, cargando, onCancel, labelGuardar }: {
    reg: typeof register; errs: typeof errors; onSubmit: () => void; cargando: boolean; onCancel: () => void; labelGuardar: string;
  }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <Campo label="Nombre del concepto *" error={errs.nombre?.message} hint="Ej: Pensión, Matrícula, Uniforme">
        <input className={inputCls(errs.nombre?.message)} placeholder="Ej: Pensión mensual" maxLength={100}
          {...reg('nombre', { required: 'Requerido', minLength: { value: 2, message: 'Mínimo 2 caracteres' }, maxLength: { value: 100, message: 'Máximo 100 caracteres' } })} />
      </Campo>
      <Campo label="Descripción (opcional)" error={errs.descripcion?.message}>
        <input className={inputCls(errs.descripcion?.message)} placeholder="Ej: Cuota mensual de pensión" maxLength={300}
          {...reg('descripcion', { maxLength: { value: 300, message: 'Máximo 300 caracteres' } })} />
      </Campo>
      <Campo label="Monto (COP) *" error={errs.monto?.message}>
        <input type="number" step="0.01" min={1} max={9999999.99} className={inputCls(errs.monto?.message)} placeholder="Ej: 150000"
          {...reg('monto', { required: 'Requerido', valueAsNumber: true, min: { value: 0.01, message: 'Debe ser mayor a 0' }, max: { value: 9999999.99, message: 'Monto máximo excedido' } })} />
      </Campo>
      <BotonesForm onCancel={onCancel} cargando={cargando} labelGuardar={labelGuardar} />
    </form>
  );

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-slate-500">Conceptos de pago configurados (pensión, matrícula, uniformes, etc.)</p>
        {esAdmin && (
          <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors min-h-[44px]">
            <Plus className="w-4 h-4" /> Nuevo concepto
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
        ) : (conceptos as Concepto[]).length === 0 ? (
          <div className="text-center py-12 text-slate-400"><CreditCard className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No hay conceptos de pago configurados</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>{['Concepto', 'Descripción', 'Monto', 'Estado', esAdmin ? 'Acciones' : ''].map(h => <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(conceptos as Concepto[]).map(c => (
                  <tr key={c.id} className={`hover:bg-slate-50 transition-colors ${!c.activo ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3 text-sm font-medium text-slate-800">{c.nombre}</td>
                    <td className="px-5 py-3 text-sm text-slate-400">{c.descripcion ?? '—'}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-slate-700">{formatoCOP(Number(c.monto))}</td>
                    <td className="px-5 py-3"><Badge texto={c.activo ? 'Activo' : 'Inactivo'} color={c.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'} /></td>
                    {esAdmin && (
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setEditando(c)} title="Editar" className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"><Edit2 className="w-4 h-4" /></button>
                          {c.activo && (
                            <button onClick={() => setConfirmarDesactivar(c)} title="Desactivar" className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Power className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <Modal titulo="Nuevo concepto de pago" onClose={() => { setModal(false); reset(); }}>
          <FormularioConcepto reg={register} errs={errors} onSubmit={handleSubmit(d => crearMutation.mutate(d))} cargando={crearMutation.isPending} onCancel={() => { setModal(false); reset(); }} labelGuardar="Crear concepto" />
        </Modal>
      )}

      {editando && (
        <Modal titulo="Editar concepto de pago" onClose={() => setEditando(null)}>
          <FormularioConcepto reg={regE} errs={eE} onSubmit={hE(d => editarMutation.mutate({ ...d, id: editando.id }))} cargando={editarMutation.isPending} onCancel={() => setEditando(null)} labelGuardar="Guardar cambios" />
        </Modal>
      )}

      {confirmarDesactivar && (
        <Modal titulo="Desactivar concepto" onClose={() => setConfirmarDesactivar(null)} ancho="max-w-sm">
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-700">¿Desactivar el concepto <strong>{confirmarDesactivar.nombre}</strong>? Ya no podrá usarse para generar nuevos cobros.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmarDesactivar(null)} className="px-4 py-2.5 text-sm text-slate-600 min-h-[44px]">Cancelar</button>
              <button onClick={() => desactivarMutation.mutate(confirmarDesactivar.id)} disabled={desactivarMutation.isPending}
                className="px-5 py-2.5 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition disabled:opacity-50 min-h-[44px]">
                {desactivarMutation.isPending ? 'Desactivando...' : 'Desactivar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── TAB: GENERAR COBROS ───────────────────────────────────────────────────────

type FormGenerar = { gradoId: string; conceptoId: string; anio: number; mes: number; montoCobrado?: number };

function TabGenerar() {
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);
  const [resultado, setResultado] = useState<{ creados: number; omitidos: number } | null>(null);

  const { data: grados = [] } = useQuery({ queryKey: ['grados'], queryFn: async () => (await api.get('/grados')).data.datos ?? [] });
  const { data: conceptos = [] } = useQuery({ queryKey: ['conceptos-pago', 'activos'], queryFn: async () => (await api.get('/conceptos', { params: { activo: 'true' } })).data.datos ?? [] });

  const { register, handleSubmit, formState: { errors } } = useForm<FormGenerar>({ defaultValues: { anio: anioActual, mes: new Date().getMonth() + 1 } });

  const generarMutation = useMutation({
    mutationFn: (d: FormGenerar) => api.post('/cobros/masivo', { ...d, montoCobrado: d.montoCobrado || undefined }),
    onSuccess: (res) => { setResultado(res.data.datos); setToast({ msg: res.data.mensaje, tipo: 'ok' }); },
    onError: (e: unknown) => setToast({ msg: mensajeError(e, 'Error al generar cobros'), tipo: 'error' }),
  });

  return (
    <div className="max-w-xl space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <p className="text-sm text-slate-500 mb-4">Genera un cobro para todos los estudiantes activos de un grado. Se omiten automáticamente los estudiantes que ya tengan ese cobro registrado.</p>
        <form onSubmit={handleSubmit(d => { setResultado(null); generarMutation.mutate(d); })} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo label="Grado *" error={errors.gradoId?.message}>
              <select className={inputCls(errors.gradoId?.message)} {...register('gradoId', { required: 'Selecciona el grado' })}>
                <option value="">Seleccionar grado</option>
                {(grados as Grado[]).map(g => <option key={g.id} value={g.id}>{g.nombre}{g.grupo}</option>)}
              </select>
            </Campo>
            <Campo label="Concepto *" error={errors.conceptoId?.message}>
              <select className={inputCls(errors.conceptoId?.message)} {...register('conceptoId', { required: 'Selecciona el concepto' })}>
                <option value="">Seleccionar concepto</option>
                {(conceptos as Concepto[]).map(c => <option key={c.id} value={c.id}>{c.nombre} — {formatoCOP(Number(c.monto))}</option>)}
              </select>
            </Campo>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo label="Mes *" error={errors.mes?.message}>
              <select className={inputCls(errors.mes?.message)} {...register('mes', { required: 'Requerido', valueAsNumber: true })}>
                {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </Campo>
            <Campo label="Año *" error={errors.anio?.message}>
              <select className={inputCls(errors.anio?.message)} {...register('anio', { required: 'Requerido', valueAsNumber: true })}>
                {ANIOS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Campo>
          </div>
          <Campo label="Monto personalizado (opcional)" error={errors.montoCobrado?.message} hint="Si lo dejas vacío se usa el monto del concepto">
            <input type="number" step="0.01" min={0.01} max={9999999.99} className={inputCls(errors.montoCobrado?.message)} placeholder="Usar monto del concepto"
              {...register('montoCobrado', { valueAsNumber: true, min: { value: 0.01, message: 'Debe ser mayor a 0' }, max: { value: 9999999.99, message: 'Monto máximo excedido' } })} />
          </Campo>
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button type="submit" disabled={generarMutation.isPending} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50 min-h-[44px]">
              {generarMutation.isPending ? 'Generando...' : 'Generar para todo el grado'}
            </button>
          </div>
        </form>
      </div>

      {resultado && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Cobros generados</p>
            <p className="text-sm text-emerald-700 mt-0.5">{resultado.creados} cobro(s) creado(s), {resultado.omitidos} omitido(s) por ya existir.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TAB: ESTADO DE CARTERA ─────────────────────────────────────────────────────

function TabCartera({ esAdmin }: { esAdmin: boolean }) {
  const qc = useQueryClient();
  const [busquedaInput, setBusquedaInput] = useState('');
  const busqueda = useDebounce(busquedaInput, 300);
  const [gradoId, setGradoId] = useState('');
  const [mes, setMes] = useState('');
  const [anio, setAnio] = useState('');
  const [estado, setEstado] = useState('');
  const [pagina, setPagina] = useState(1);
  const [cobroPagar, setCobroPagar] = useState<Cobro | null>(null);
  const [cobroExonerar, setCobroExonerar] = useState<Cobro | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);

  useEffect(() => { setPagina(1); }, [busqueda, gradoId, mes, anio, estado]);

  const { data: grados = [] } = useQuery({ queryKey: ['grados'], queryFn: async () => (await api.get('/grados')).data.datos ?? [] });

  const { data, isLoading } = useQuery({
    queryKey: ['cobros', busqueda, gradoId, mes, anio, estado, pagina],
    queryFn: async () => (await api.get('/cobros', {
      params: { busqueda: busqueda || undefined, gradoId: gradoId || undefined, mes: mes || undefined, anio: anio || undefined, estado: estado || undefined, pagina, limite: 20 },
    })).data,
    staleTime: 0,
  });

  const { register: regPago, handleSubmit: hPago, reset: resetPago, formState: { errors: ePago } } = useForm<{ metodoPago: string; fechaPago: string }>();
  const { register: regExo, handleSubmit: hExo, reset: resetExo, formState: { errors: eExo } } = useForm<{ observaciones?: string }>();

  const pagarMutation = useMutation({
    mutationFn: (d: { id: string; metodoPago: string; fechaPago: string }) => api.patch(`/cobros/${d.id}/pagar`, { metodoPago: d.metodoPago, fechaPago: d.fechaPago }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cobros'] }); setCobroPagar(null); resetPago(); setToast({ msg: 'Cobro marcado como pagado', tipo: 'ok' }); },
    onError: (e: unknown) => setToast({ msg: mensajeError(e, 'Error al registrar el pago'), tipo: 'error' }),
  });

  const exonerarMutation = useMutation({
    mutationFn: (d: { id: string; observaciones?: string }) => api.patch(`/cobros/${d.id}/exonerar`, { observaciones: d.observaciones }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cobros'] }); setCobroExonerar(null); resetExo(); setToast({ msg: 'Cobro exonerado correctamente', tipo: 'ok' }); },
    onError: (e: unknown) => setToast({ msg: mensajeError(e, 'Error al exonerar'), tipo: 'error' }),
  });

  const exportarCSV = async () => {
    try {
      const res = await api.get('/cobros/exportar', {
        params: { gradoId: gradoId || undefined, mes: mes || undefined, anio: anio || undefined, estado: estado || undefined },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url; link.download = 'cartera.csv';
      document.body.appendChild(link); link.click(); link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setToast({ msg: 'Error al exportar la cartera', tipo: 'error' });
    }
  };

  const meta = data?.meta as { pagina: number; totalPaginas: number; total: number } | undefined;

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={busquedaInput} onChange={e => setBusquedaInput(e.target.value)} placeholder="Buscar estudiante..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]" />
        </div>
        <select value={gradoId} onChange={e => setGradoId(e.target.value)} className="py-2.5 px-3 border border-slate-200 rounded-xl text-sm bg-white min-h-[44px]">
          <option value="">Todos los grados</option>
          {(grados as Grado[]).map(g => <option key={g.id} value={g.id}>{g.nombre}{g.grupo}</option>)}
        </select>
        <select value={mes} onChange={e => setMes(e.target.value)} className="py-2.5 px-3 border border-slate-200 rounded-xl text-sm bg-white min-h-[44px]">
          <option value="">Todos los meses</option>
          {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={anio} onChange={e => setAnio(e.target.value)} className="py-2.5 px-3 border border-slate-200 rounded-xl text-sm bg-white min-h-[44px]">
          <option value="">Todos los años</option>
          {ANIOS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={estado} onChange={e => setEstado(e.target.value)} className="py-2.5 px-3 border border-slate-200 rounded-xl text-sm bg-white min-h-[44px]">
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="EN_VERIFICACION">En verificación</option>
          <option value="PAGADO">Pagado</option>
          <option value="EXONERADO">Exonerado</option>
        </select>
        {esAdmin && (
          <button onClick={exportarCSV} className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-xl hover:bg-slate-900 transition-colors min-h-[44px]">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
        ) : (data?.datos ?? []).length === 0 ? (
          <div className="text-center py-12 text-slate-400"><Wallet className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No hay cobros que coincidan con los filtros</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>{['Estudiante', 'Grado', 'Concepto', 'Mes', 'Monto', 'Estado', 'Fecha pago', 'Acciones'].map(h => <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(data.datos as Cobro[]).map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{c.estudiante.nombres} {c.estudiante.apellidos}</td>
                    <td className="px-4 py-3"><Badge texto={`${c.estudiante.grado.nombre}${c.estudiante.grado.grupo}`} color="bg-blue-50 text-blue-700" /></td>
                    <td className="px-4 py-3 text-sm text-slate-600">{c.concepto.nombre}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{MESES[c.mes - 1]} {c.anio}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">{formatoCOP(Number(c.montoCobrado))}</td>
                    <td className="px-4 py-3"><Badge texto={LABEL_ESTADO[c.estadoPago]} color={ESTADO_COLOR[c.estadoPago]} /></td>
                    <td className="px-4 py-3 text-xs text-slate-400">{c.fechaPago ? new Date(c.fechaPago).toLocaleDateString('es-CO', { timeZone: 'UTC' }) : '—'}</td>
                    <td className="px-4 py-3">
                      {c.estadoPago === 'PENDIENTE' ? (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => { setCobroPagar(c); resetPago({ metodoPago: '', fechaPago: new Date().toISOString().split('T')[0] }); }}
                            title="Marcar pagado" className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"><DollarSign className="w-4 h-4" /></button>
                          {esAdmin && (
                            <button onClick={() => { setCobroExonerar(c); resetExo(); }} title="Exonerar" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><Ban className="w-4 h-4" /></button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta && meta.total > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
            <span>{meta.total} cobro(s) en total</span>
            {meta.totalPaginas > 1 && (
              <div className="flex items-center gap-2">
                <button disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50 min-h-[32px] min-w-[32px]"><ChevronLeft className="w-3.5 h-3.5" /></button>
                <span>Página {meta.pagina} de {meta.totalPaginas}</span>
                <button disabled={pagina >= meta.totalPaginas} onClick={() => setPagina(p => p + 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50 min-h-[32px] min-w-[32px]"><ChevronRight className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>
        )}
      </div>

      {cobroPagar && (
        <Modal titulo="Marcar cobro como pagado" onClose={() => setCobroPagar(null)} ancho="max-w-sm">
          <div className="mb-4 bg-slate-50 rounded-xl p-3">
            <p className="text-sm font-medium text-slate-700">{cobroPagar.estudiante.nombres} {cobroPagar.estudiante.apellidos}</p>
            <p className="text-xs text-slate-400">{cobroPagar.concepto.nombre} · {MESES[cobroPagar.mes - 1]} {cobroPagar.anio} · {formatoCOP(Number(cobroPagar.montoCobrado))}</p>
          </div>
          <form onSubmit={hPago(d => pagarMutation.mutate({ id: cobroPagar.id, ...d }))} className="space-y-4">
            <Campo label="Método de pago *" error={ePago.metodoPago?.message}>
              <select className={inputCls(ePago.metodoPago?.message)} {...regPago('metodoPago', { required: 'Selecciona el método de pago' })}>
                <option value="">Seleccionar</option>
                {METODOS_PAGO.map(m => <option key={m} value={m}>{LABEL_METODO[m]}</option>)}
              </select>
            </Campo>
            <Campo label="Fecha de pago *" error={ePago.fechaPago?.message}>
              <input type="date" max={new Date().toISOString().split('T')[0]} className={inputCls(ePago.fechaPago?.message)} {...regPago('fechaPago', { required: 'Requerido' })} />
            </Campo>
            <BotonesForm onCancel={() => setCobroPagar(null)} cargando={pagarMutation.isPending} labelGuardar="Confirmar pago" />
          </form>
        </Modal>
      )}

      {cobroExonerar && (
        <Modal titulo="Exonerar cobro" onClose={() => setCobroExonerar(null)} ancho="max-w-sm">
          <div className="mb-4 bg-slate-50 rounded-xl p-3">
            <p className="text-sm font-medium text-slate-700">{cobroExonerar.estudiante.nombres} {cobroExonerar.estudiante.apellidos}</p>
            <p className="text-xs text-slate-400">{cobroExonerar.concepto.nombre} · {MESES[cobroExonerar.mes - 1]} {cobroExonerar.anio} · {formatoCOP(Number(cobroExonerar.montoCobrado))}</p>
          </div>
          <form onSubmit={hExo(d => exonerarMutation.mutate({ id: cobroExonerar.id, ...d }))} className="space-y-4">
            <Campo label="Motivo de exoneración (opcional)" error={eExo.observaciones?.message}>
              <textarea rows={3} maxLength={500} className={`${inputCls(eExo.observaciones?.message)} resize-none`} placeholder="Ej: Beca del 100%"
                {...regExo('observaciones', { maxLength: { value: 500, message: 'Máximo 500 caracteres' } })} />
            </Campo>
            <BotonesForm onCancel={() => setCobroExonerar(null)} cargando={exonerarMutation.isPending} labelGuardar="Exonerar cobro" />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── TAB: COMPROBANTES POR VERIFICAR ────────────────────────────────────────────

type Comprobante = {
  id: string; nombreOriginal: string; observaciones: string | null; estado: 'PENDIENTE_VERIFICACION' | 'APROBADO' | 'RECHAZADO';
  motivoRechazo: string | null; createdAt: string;
  cobro: { id: string; montoCobrado: string; mes: number; anio: number; estudiante: { nombres: string; apellidos: string; grado: { nombre: string; grupo: string } }; concepto: { nombre: string } };
  padre: { email: string; perfilPadre: { nombres: string; apellidos: string } | null };
};

const ESTADO_COMPROBANTE_COLOR: Record<string, string> = { PENDIENTE_VERIFICACION: 'bg-amber-50 text-amber-700', APROBADO: 'bg-emerald-50 text-emerald-700', RECHAZADO: 'bg-red-50 text-red-600' };
const LABEL_ESTADO_COMPROBANTE: Record<string, string> = { PENDIENTE_VERIFICACION: 'Pendiente', APROBADO: 'Aprobado', RECHAZADO: 'Rechazado' };

function TabComprobantes() {
  const qc = useQueryClient();
  const [estado, setEstado] = useState('PENDIENTE_VERIFICACION');
  const [gradoId, setGradoId] = useState('');
  const [fecha, setFecha] = useState('');
  const [pagina, setPagina] = useState(1);
  const [rechazando, setRechazando] = useState<Comprobante | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);

  useEffect(() => { setPagina(1); }, [estado, gradoId, fecha]);

  const { data: grados = [] } = useQuery({ queryKey: ['grados'], queryFn: async () => (await api.get('/grados')).data.datos ?? [] });

  const { data, isLoading } = useQuery({
    queryKey: ['comprobantes', estado, gradoId, fecha, pagina],
    queryFn: async () => (await api.get('/cobros/comprobantes', { params: { estado: estado || undefined, grado: gradoId || undefined, fecha: fecha || undefined, pagina, limite: 20 } })).data,
    staleTime: 0,
  });

  const verArchivo = async (id: string) => {
    try {
      const res = await api.get(`/cobros/comprobantes/${id}/archivo`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch {
      setToast({ msg: 'No se pudo abrir el comprobante', tipo: 'error' });
    }
  };

  const aprobarMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/cobros/comprobantes/${id}/aprobar`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comprobantes'] }); qc.invalidateQueries({ queryKey: ['cobros'] }); setToast({ msg: 'Pago aprobado correctamente', tipo: 'ok' }); },
    onError: (e: unknown) => setToast({ msg: mensajeError(e, 'Error al aprobar el pago'), tipo: 'error' }),
  });

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<{ motivoRechazo: string }>();
  const watchMotivo = watch('motivoRechazo');

  const rechazarMutation = useMutation({
    mutationFn: (d: { id: string; motivoRechazo: string }) => api.patch(`/cobros/comprobantes/${d.id}/rechazar`, { motivoRechazo: d.motivoRechazo }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comprobantes'] }); qc.invalidateQueries({ queryKey: ['cobros'] }); setRechazando(null); reset(); setToast({ msg: 'Comprobante rechazado', tipo: 'ok' }); },
    onError: (e: unknown) => setToast({ msg: mensajeError(e, 'Error al rechazar el comprobante'), tipo: 'error' }),
  });

  const meta = data?.meta as { pagina: number; totalPaginas: number; total: number } | undefined;

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      <div className="flex flex-wrap items-center gap-3">
        <select value={estado} onChange={e => setEstado(e.target.value)} className="py-2.5 px-3 border border-slate-200 rounded-xl text-sm bg-white min-h-[44px]">
          <option value="PENDIENTE_VERIFICACION">Pendientes</option>
          <option value="APROBADO">Aprobados</option>
          <option value="RECHAZADO">Rechazados</option>
          <option value="">Todos los estados</option>
        </select>
        <select value={gradoId} onChange={e => setGradoId(e.target.value)} className="py-2.5 px-3 border border-slate-200 rounded-xl text-sm bg-white min-h-[44px]">
          <option value="">Todos los grados</option>
          {(grados as Grado[]).map(g => <option key={g.id} value={g.id}>{g.nombre}{g.grupo}</option>)}
        </select>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="py-2.5 px-3 border border-slate-200 rounded-xl text-sm bg-white min-h-[44px]" />
        {fecha && <button onClick={() => setFecha('')} className="text-xs text-slate-400 hover:text-slate-600">Limpiar fecha</button>}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
        ) : (data?.datos ?? []).length === 0 ? (
          <div className="text-center py-12 text-slate-400"><Receipt className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No hay comprobantes que coincidan con los filtros</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>{['Estudiante', 'Grado', 'Concepto', 'Monto', 'Padre/Acudiente', 'Enviado', 'Estado', 'Acciones'].map(h => <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(data.datos as Comprobante[]).map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 whitespace-nowrap">{c.cobro.estudiante.nombres} {c.cobro.estudiante.apellidos}</td>
                    <td className="px-4 py-3"><Badge texto={`${c.cobro.estudiante.grado.nombre}${c.cobro.estudiante.grado.grupo}`} color="bg-blue-50 text-blue-700" /></td>
                    <td className="px-4 py-3 text-sm text-slate-600">{c.cobro.concepto.nombre} · {MESES[c.cobro.mes - 1]} {c.cobro.anio}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">{formatoCOP(Number(c.cobro.montoCobrado))}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      <p>{c.padre.perfilPadre ? `${c.padre.perfilPadre.nombres} ${c.padre.perfilPadre.apellidos}` : '—'}</p>
                      <p className="text-xs text-slate-400">{c.padre.email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{new Date(c.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="px-4 py-3"><Badge texto={LABEL_ESTADO_COMPROBANTE[c.estado]} color={ESTADO_COMPROBANTE_COLOR[c.estado]} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => verArchivo(c.id)} title="Ver comprobante" className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Eye className="w-4 h-4" /></button>
                        {c.estado === 'PENDIENTE_VERIFICACION' && (
                          <>
                            <button onClick={() => aprobarMutation.mutate(c.id)} title="Aprobar pago" className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"><Check className="w-4 h-4" /></button>
                            <button onClick={() => { setRechazando(c); reset(); }} title="Rechazar" className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><XCircle className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta && meta.total > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
            <span>{meta.total} comprobante(s) en total</span>
            {meta.totalPaginas > 1 && (
              <div className="flex items-center gap-2">
                <button disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50 min-h-[32px] min-w-[32px]"><ChevronLeft className="w-3.5 h-3.5" /></button>
                <span>Página {meta.pagina} de {meta.totalPaginas}</span>
                <button disabled={pagina >= meta.totalPaginas} onClick={() => setPagina(p => p + 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-50 min-h-[32px] min-w-[32px]"><ChevronRight className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>
        )}
      </div>

      {rechazando && (
        <Modal titulo="Rechazar comprobante" onClose={() => setRechazando(null)} ancho="max-w-sm">
          <div className="mb-4 bg-slate-50 rounded-xl p-3">
            <p className="text-sm font-medium text-slate-700">{rechazando.cobro.estudiante.nombres} {rechazando.cobro.estudiante.apellidos}</p>
            <p className="text-xs text-slate-400">{rechazando.cobro.concepto.nombre} · {formatoCOP(Number(rechazando.cobro.montoCobrado))}</p>
          </div>
          <form onSubmit={handleSubmit(d => rechazarMutation.mutate({ id: rechazando.id, ...d }))} className="space-y-4">
            <Campo label="Motivo del rechazo *" error={errors.motivoRechazo?.message}>
              <textarea rows={4} maxLength={300} className={`${inputCls(errors.motivoRechazo?.message)} resize-none`}
                placeholder="Ej: El comprobante no coincide con el monto del cobro..."
                {...register('motivoRechazo', { required: 'El motivo es requerido', minLength: { value: 5, message: 'Mínimo 5 caracteres' }, maxLength: { value: 300, message: 'Máximo 300 caracteres' } })} />
              <p className="mt-1 text-xs text-right text-slate-400">{watchMotivo?.length ?? 0} / 300 caracteres</p>
            </Campo>
            <BotonesForm onCancel={() => setRechazando(null)} cargando={rechazarMutation.isPending} labelGuardar="Rechazar comprobante" />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── TAB: REPORTE DE CARTERA ────────────────────────────────────────────────────

type ResumenGrado = { gradoId: string; nombre: string; totalCobrado: number; totalPagado: number; totalPendiente: number; totalExonerado: number; cantidadCobros: number };

function TabReporte() {
  const [gradoId, setGradoId] = useState('');
  const [mes, setMes] = useState('');
  const [anio, setAnio] = useState(String(anioActual));

  const { data: grados = [] } = useQuery({ queryKey: ['grados'], queryFn: async () => (await api.get('/grados')).data.datos ?? [] });

  const { data: resumen = [], isLoading } = useQuery({
    queryKey: ['reporte-cartera', gradoId, mes, anio],
    queryFn: async () => (await api.get('/cobros/reporte', { params: { gradoId: gradoId || undefined, mes: mes || undefined, anio: anio || undefined } })).data.datos ?? [],
  });

  const totales = (resumen as ResumenGrado[]).reduce((acc, r) => ({
    totalCobrado: acc.totalCobrado + r.totalCobrado,
    totalPagado: acc.totalPagado + r.totalPagado,
    totalPendiente: acc.totalPendiente + r.totalPendiente,
    totalExonerado: acc.totalExonerado + r.totalExonerado,
  }), { totalCobrado: 0, totalPagado: 0, totalPendiente: 0, totalExonerado: 0 });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={gradoId} onChange={e => setGradoId(e.target.value)} className="py-2.5 px-3 border border-slate-200 rounded-xl text-sm bg-white min-h-[44px]">
          <option value="">Todos los grados</option>
          {(grados as Grado[]).map(g => <option key={g.id} value={g.id}>{g.nombre}{g.grupo}</option>)}
        </select>
        <select value={mes} onChange={e => setMes(e.target.value)} className="py-2.5 px-3 border border-slate-200 rounded-xl text-sm bg-white min-h-[44px]">
          <option value="">Todos los meses</option>
          {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={anio} onChange={e => setAnio(e.target.value)} className="py-2.5 px-3 border border-slate-200 rounded-xl text-sm bg-white min-h-[44px]">
          <option value="">Todos los años</option>
          {ANIOS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total cobrado', valor: totales.totalCobrado, color: 'text-slate-800' },
          { label: 'Total pagado', valor: totales.totalPagado, color: 'text-emerald-600' },
          { label: 'Total pendiente', valor: totales.totalPendiente, color: 'text-red-600' },
          { label: 'Total exonerado', valor: totales.totalExonerado, color: 'text-slate-500' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <p className="text-xs text-slate-400 mb-1">{s.label}</p>
            <p className={`text-lg font-bold ${s.color}`}>{formatoCOP(s.valor)}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
        ) : (resumen as ResumenGrado[]).length === 0 ? (
          <div className="text-center py-12 text-slate-400"><BarChart2 className="w-10 h-10 mx-auto mb-2 opacity-30" /><p className="text-sm">No hay datos de cartera para estos filtros</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>{['Grado', 'Cobrado', 'Pagado', 'Pendiente', 'Exonerado', '# Cobros'].map(h => <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(resumen as ResumenGrado[]).map(r => (
                  <tr key={r.gradoId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3"><Badge texto={r.nombre} color="bg-blue-50 text-blue-700" /></td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">{formatoCOP(r.totalCobrado)}</td>
                    <td className="px-4 py-3 text-sm text-emerald-600 font-medium">{formatoCOP(r.totalPagado)}</td>
                    <td className="px-4 py-3 text-sm text-red-600 font-medium">{formatoCOP(r.totalPendiente)}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{formatoCOP(r.totalExonerado)}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{r.cantidadCobros}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ───────────────────────────────────────────────────────

type Tab = 'conceptos' | 'generar' | 'cartera' | 'comprobantes' | 'reporte';

export default function Pagos() {
  const { usuario } = useAuthStore();
  const esAdmin = usuario?.rol === 'ADMINISTRADOR';
  const [tab, setTab] = useState<Tab>('cartera');

  const TABS: { id: Tab; label: string; icono: typeof CreditCard }[] = [
    { id: 'conceptos', label: 'Conceptos', icono: CreditCard },
    { id: 'generar', label: 'Generar cobros', icono: Plus },
    { id: 'cartera', label: 'Estado de cartera', icono: Wallet },
    // La verificación operativa de comprobantes vive en Secretaría; el admin
    // solo necesita ver el estado de cartera y los reportes agregados.
    ...(esAdmin ? [] : [{ id: 'comprobantes' as Tab, label: 'Comprobantes', icono: Receipt }]),
    { id: 'reporte', label: 'Reporte', icono: BarChart2 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto scrollbar-none">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-medium rounded-lg transition-colors whitespace-nowrap min-h-[44px] ${tab === t.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <t.icono className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'conceptos' && <TabConceptos esAdmin={esAdmin} />}
      {tab === 'generar' && <TabGenerar />}
      {tab === 'cartera' && <TabCartera esAdmin={esAdmin} />}
      {tab === 'comprobantes' && !esAdmin && <TabComprobantes />}
      {tab === 'reporte' && <TabReporte />}
    </div>
  );
}
