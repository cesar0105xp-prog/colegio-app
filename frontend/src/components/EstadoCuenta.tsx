import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, CheckCircle, Clock, Download, CreditCard, Upload, AlertCircle, X, Landmark } from 'lucide-react';
import api from '../services/api';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const LABEL_METODO: Record<string, string> = { EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia', BANCO_BOGOTA: 'Banco de Bogotá', PSE: 'PSE', NEQUI: 'Nequi' };
const ESTADO_COLOR: Record<string, string> = { PENDIENTE: 'bg-red-50 text-red-600', PAGADO: 'bg-emerald-50 text-emerald-700', EXONERADO: 'bg-slate-100 text-slate-500', EN_VERIFICACION: 'bg-amber-50 text-amber-700' };
const LABEL_ESTADO: Record<string, string> = { PENDIENTE: 'Pendiente', PAGADO: 'Pagado', EXONERADO: 'Exonerado', EN_VERIFICACION: 'En verificación' };

const formatoCOP = (n: number) => n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const MAX_COMPROBANTE_MB = 5;
const TIPOS_COMPROBANTE_ACEPTADOS = ['image/jpeg', 'image/png', 'application/pdf'];

type UltimoComprobante = { estado: 'PENDIENTE_VERIFICACION' | 'APROBADO' | 'RECHAZADO'; motivoRechazo: string | null; createdAt: string } | null;

type CobroPadre = {
  id: string; anio: number; mes: number; montoCobrado: string;
  estadoPago: 'PENDIENTE' | 'PAGADO' | 'EXONERADO' | 'EN_VERIFICACION'; fechaPago: string | null; metodoPago: string | null;
  concepto: { nombre: string };
  comprobantes: UltimoComprobante[];
};

function Toast({ mensaje, tipo, onClose }: { mensaje: string; tipo: 'ok' | 'error'; onClose: () => void }) {
  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${tipo === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
      {tipo === 'ok' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {mensaje}
      <button onClick={onClose}><X className="w-4 h-4" /></button>
    </div>
  );
}

function ModalReportarPago({ cobro, onClose, onExito }: { cobro: CobroPadre; onClose: () => void; onExito: (msg: string) => void }) {
  const qc = useQueryClient();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [observaciones, setObservaciones] = useState('');
  const [referencia, setReferencia] = useState('');
  const [error, setError] = useState('');

  const enviarMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('archivo', archivo!);
      if (observaciones.trim()) fd.append('observaciones', observaciones.trim());
      if (referencia.trim()) fd.append('referencia', referencia.trim());
      return api.post(`/cobros/${cobro.id}/comprobante`, fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mi-estado-cuenta'] });
      onExito('Comprobante enviado. Secretaría lo verificará pronto.');
      onClose();
    },
    onError: (e: unknown) => {
      const d = (e as { response?: { data?: { mensaje?: string; errores?: string[] } } })?.response?.data;
      setError(d?.errores?.[0] ?? d?.mensaje ?? 'No se pudo enviar el comprobante. Intenta de nuevo.');
    },
  });

  const manejarArchivo = (file: File | null) => {
    setError('');
    if (!file) { setArchivo(null); return; }
    if (!TIPOS_COMPROBANTE_ACEPTADOS.includes(file.type)) { setError('Solo se aceptan archivos JPG, PNG o PDF'); return; }
    if (file.size > MAX_COMPROBANTE_MB * 1024 * 1024) { setError(`El archivo no puede superar ${MAX_COMPROBANTE_MB} MB`); return; }
    setArchivo(file);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-slate-800">Reportar pago</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-sm font-medium text-slate-700">{cobro.concepto.nombre} — {MESES[cobro.mes - 1]} {cobro.anio}</p>
            <p className="text-lg font-bold text-slate-800 mt-0.5">{formatoCOP(Number(cobro.montoCobrado))}</p>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <img src="/qr-nequi.svg" alt="Código QR para pago con Nequi" className="w-32 h-32 rounded-xl border border-slate-200" />
            <p className="text-xs text-slate-400">Escanea con Nequi para pagar</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Landmark className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-semibold text-blue-800">Datos bancarios del colegio</p>
            </div>
            <div className="text-sm text-blue-800 space-y-0.5">
              <p><strong>Nequi</strong> · 300 123 4567</p>
              <p><strong>Banco de Bogotá</strong> · Cuenta 606173664</p>
              <p>Titular: Marcela Rodríguez · CC 52841783</p>
              <p className="mt-1.5 text-xs text-blue-700">Concepto: {cobro.concepto.nombre} — nombre del estudiante</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Comprobante de pago *</label>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl p-6 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors">
              <Upload className="w-6 h-6 text-slate-400" />
              <span className="text-sm text-slate-500 text-center">{archivo ? archivo.name : 'Sube una foto o PDF del comprobante'}</span>
              <span className="text-xs text-slate-400">JPG, PNG o PDF · máximo {MAX_COMPROBANTE_MB} MB</span>
              <input type="file" accept="image/jpeg,image/png,application/pdf" className="hidden"
                onChange={e => manejarArchivo(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Referencia de la transacción (opcional)</label>
            <input value={referencia} onChange={e => setReferencia(e.target.value)} maxLength={50}
              placeholder="Número de referencia o comprobante"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Observaciones (opcional)</label>
            <textarea rows={3} maxLength={200} value={observaciones} onChange={e => setObservaciones(e.target.value)}
              placeholder="Ej: Pago realizado desde la cuenta de mi esposo..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            <p className="mt-1 text-xs text-right text-slate-400">{observaciones.length} / 200 caracteres</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
            <button onClick={onClose} className="px-4 py-2.5 text-sm text-slate-600 min-h-[44px]">Cancelar</button>
            <button onClick={() => enviarMutation.mutate()} disabled={!archivo || enviarMutation.isPending}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50 min-h-[44px]">
              {enviarMutation.isPending ? 'Enviando...' : 'Enviar comprobante'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EstadoCuenta({ estudianteId }: { estudianteId: string }) {
  const [reportando, setReportando] = useState<CobroPadre | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['mi-estado-cuenta', estudianteId],
    queryFn: async () => (await api.get('/cobros/mi-estado', { params: { estudianteId } })).data.datos,
    enabled: !!estudianteId,
  });

  const cobros = (data?.cobros ?? []) as CobroPadre[];

  const porAnio = new Map<number, Map<number, CobroPadre[]>>();
  for (const c of cobros) {
    if (!porAnio.has(c.anio)) porAnio.set(c.anio, new Map());
    const porMes = porAnio.get(c.anio)!;
    if (!porMes.has(c.mes)) porMes.set(c.mes, []);
    porMes.get(c.mes)!.push(c);
  }

  const pagos = cobros.filter(c => c.estadoPago === 'PAGADO' && c.fechaPago);

  if (isLoading) {
    return <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>;
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Wallet className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No se pudo cargar el estado de cuenta</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      {/* Saldo pendiente */}
      <div className={`rounded-2xl p-6 text-white ${data.saldoPendiente > 0 ? 'bg-gradient-to-r from-red-600 to-red-700' : 'bg-gradient-to-r from-emerald-600 to-emerald-700'}`}>
        <p className="text-white/80 text-sm mb-1">Saldo pendiente</p>
        <p className="text-4xl font-bold">{formatoCOP(data.saldoPendiente)}</p>
        <p className="text-white/80 text-sm mt-2">Total pagado: {formatoCOP(data.totalPagado)}</p>
      </div>

      <div className="flex justify-end print:hidden">
        <button onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors min-h-[44px]">
          <Download className="w-4 h-4" /> Descargar resumen (PDF)
        </button>
      </div>

      {/* Cobros agrupados por mes */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><CreditCard className="w-4 h-4 text-blue-600" /> Cobros del año</h3>
        {cobros.length === 0 ? (
          <div className="text-center py-8 text-slate-400"><Wallet className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No hay cobros registrados aún</p></div>
        ) : (
          <div className="space-y-5">
            {Array.from(porAnio.entries()).sort((a, b) => b[0] - a[0]).map(([anio, porMes]) => (
              <div key={anio}>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{anio}</p>
                <div className="space-y-3">
                  {Array.from(porMes.entries()).sort((a, b) => b[0] - a[0]).map(([mes, items]) => (
                    <div key={mes} className="bg-slate-50 rounded-xl p-3">
                      <p className="text-sm font-medium text-slate-700 mb-2">{MESES[mes - 1]}</p>
                      <div className="space-y-2">
                        {items.map(c => {
                          const ultimoComprobante = c.comprobantes[0] ?? null;
                          const rechazado = c.estadoPago === 'PENDIENTE' && ultimoComprobante?.estado === 'RECHAZADO';
                          return (
                            <div key={c.id}>
                              <div className="flex items-center justify-between text-sm flex-wrap gap-y-1">
                                <span className="text-slate-600">{c.concepto.nombre}</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-700">{formatoCOP(Number(c.montoCobrado))}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLOR[c.estadoPago]}`}>{LABEL_ESTADO[c.estadoPago]}</span>
                                  {c.estadoPago === 'PENDIENTE' && (
                                    <button
                                      onClick={() => setReportando(c)}
                                      className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition min-h-[28px]">
                                      <Upload className="w-3 h-3" /> Reportar pago
                                    </button>
                                  )}
                                </div>
                              </div>
                              {rechazado && (
                                <p className="text-xs text-red-600 mt-1">Tu comprobante fue rechazado: {ultimoComprobante!.motivoRechazo}. Puedes reportar el pago de nuevo.</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historial de pagos */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-600" /> Historial de pagos</h3>
        {pagos.length === 0 ? (
          <div className="text-center py-8 text-slate-400"><Clock className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">Aún no se han registrado pagos</p></div>
        ) : (
          <div className="space-y-2">
            {pagos.map(c => (
              <div key={c.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-700">{c.concepto.nombre} — {MESES[c.mes - 1]} {c.anio}</p>
                  <p className="text-xs text-slate-400">{new Date(c.fechaPago!).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })} · {c.metodoPago ? LABEL_METODO[c.metodoPago] : '—'}</p>
                </div>
                <span className="text-sm font-semibold text-emerald-600">{formatoCOP(Number(c.montoCobrado))}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {reportando && (
        <ModalReportarPago cobro={reportando} onClose={() => setReportando(null)} onExito={msg => setToast({ msg, tipo: 'ok' })} />
      )}
    </div>
  );
}
