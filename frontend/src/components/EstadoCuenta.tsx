import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Wallet, CheckCircle, Clock, Download, CreditCard, ExternalLink, AlertCircle } from 'lucide-react';
import api from '../services/api';

type DatosCheckoutWompi = {
  checkoutUrl: string; publicKey: string; currency: string; amountInCents: number;
  reference: string; signature: string; redirectUrl: string;
};

/** Arma y envía el formulario POST que exige el Web Checkout de Wompi. */
function redirigirAWompi(datos: DatosCheckoutWompi) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = datos.checkoutUrl;
  const campos: Record<string, string> = {
    'public-key': datos.publicKey,
    'currency': datos.currency,
    'amount-in-cents': String(datos.amountInCents),
    'reference': datos.reference,
    'signature:integrity': datos.signature,
    'redirect-url': datos.redirectUrl,
  };
  for (const [nombre, valor] of Object.entries(campos)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = nombre;
    input.value = valor;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const LABEL_METODO: Record<string, string> = { EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia', BANCO_BOGOTA: 'Banco de Bogotá', PSE: 'PSE', NEQUI: 'Nequi' };
const ESTADO_COLOR: Record<string, string> = { PENDIENTE: 'bg-red-50 text-red-600', PAGADO: 'bg-emerald-50 text-emerald-700', EXONERADO: 'bg-slate-100 text-slate-500' };
const LABEL_ESTADO: Record<string, string> = { PENDIENTE: 'Pendiente', PAGADO: 'Pagado', EXONERADO: 'Exonerado' };

const formatoCOP = (n: number) => n.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

type CobroPadre = {
  id: string; anio: number; mes: number; montoCobrado: string;
  estadoPago: 'PENDIENTE' | 'PAGADO' | 'EXONERADO'; fechaPago: string | null; metodoPago: string | null;
  concepto: { nombre: string };
};

export default function EstadoCuenta({ estudianteId }: { estudianteId: string }) {
  const [errorPago, setErrorPago] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['mi-estado-cuenta', estudianteId],
    queryFn: async () => (await api.get('/cobros/mi-estado', { params: { estudianteId } })).data.datos,
    enabled: !!estudianteId,
  });

  const pagarMutation = useMutation({
    mutationFn: (cobroId: string) => api.post(`/cobros/${cobroId}/iniciar-pago`),
    onMutate: () => setErrorPago(''),
    onSuccess: (res) => redirigirAWompi(res.data.datos as DatosCheckoutWompi),
    onError: (e: unknown) => {
      const d = (e as { response?: { data?: { mensaje?: string } } })?.response?.data;
      setErrorPago(d?.mensaje ?? 'No se pudo iniciar el pago en línea. Intenta de nuevo.');
    },
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
      {errorPago && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 print:hidden">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{errorPago}</p>
        </div>
      )}

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
                      <div className="space-y-1.5">
                        {items.map(c => (
                          <div key={c.id} className="flex items-center justify-between text-sm flex-wrap gap-y-1">
                            <span className="text-slate-600">{c.concepto.nombre}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-700">{formatoCOP(Number(c.montoCobrado))}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLOR[c.estadoPago]}`}>{LABEL_ESTADO[c.estadoPago]}</span>
                              {c.estadoPago === 'PENDIENTE' && (
                                <button
                                  onClick={() => pagarMutation.mutate(c.id)}
                                  disabled={pagarMutation.isPending}
                                  className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 min-h-[28px]">
                                  <ExternalLink className="w-3 h-3" />
                                  {pagarMutation.isPending && pagarMutation.variables === c.id ? 'Conectando...' : 'Pagar en línea'}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
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
    </div>
  );
}
