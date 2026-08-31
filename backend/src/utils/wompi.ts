import crypto from 'crypto';

export const WOMPI_PUBLIC_KEY = process.env.WOMPI_PUBLIC_KEY ?? '';
const WOMPI_INTEGRITY_SECRET = process.env.WOMPI_INTEGRITY_SECRET ?? '';
const WOMPI_EVENTS_SECRET = process.env.WOMPI_EVENTS_SECRET ?? '';
export const WOMPI_CHECKOUT_URL = 'https://checkout.wompi.co/p/';
const MONEDA = 'COP';

/**
 * Referencia única por intento de pago: permite que un mismo cobro se
 * reintente (Wompi exige una referencia distinta por transacción) y a la
 * vez queda codificado el cobroId para poder generar/loguear sin ambigüedad.
 */
export function generarReferenciaPago(cobroId: string): string {
  return `cobro-${cobroId}-${Date.now()}`;
}

/**
 * Firma de integridad del checkout (Wompi): SHA256("referencia" + "montoEnCentavos" + "moneda" + "secretoIntegridad").
 * Debe calcularse siempre en el servidor — nunca en el frontend.
 */
export function firmarIntegridadCheckout(referencia: string, montoEnCentavos: number): string {
  const cadena = `${referencia}${montoEnCentavos}${MONEDA}${WOMPI_INTEGRITY_SECRET}`;
  return crypto.createHash('sha256').update(cadena).digest('hex');
}

export function montoACentavos(monto: number): number {
  return Math.round(monto * 100);
}

interface EventoWompi {
  event: string;
  data: { transaction: Record<string, unknown> };
  signature: { properties: string[]; checksum: string };
  timestamp: number;
}

/**
 * Verifica el checksum de un evento (webhook) de Wompi: concatena, en el
 * orden indicado por signature.properties, los valores de esos campos
 * (rutas dentro de "data"), les agrega el timestamp y el secreto de eventos,
 * y compara el SHA256 resultante contra signature.checksum.
 */
export function verificarFirmaEvento(evento: EventoWompi): boolean {
  if (!evento?.signature?.properties || !evento.signature.checksum) return false;

  const valores = evento.signature.properties.map(ruta => {
    const partes = ruta.split('.');
    let valor: unknown = evento.data;
    for (const parte of partes) {
      valor = (valor as Record<string, unknown> | undefined)?.[parte];
    }
    return valor ?? '';
  });

  const cadena = `${valores.join('')}${evento.timestamp}${WOMPI_EVENTS_SECRET}`;
  const checksumCalculado = crypto.createHash('sha256').update(cadena).digest('hex').toLowerCase();
  const checksumRecibido = evento.signature.checksum.toLowerCase();

  const bufCalculado = Buffer.from(checksumCalculado, 'hex');
  const bufRecibido = Buffer.from(checksumRecibido, 'hex');
  if (bufCalculado.length !== bufRecibido.length) return false;
  return crypto.timingSafeEqual(bufCalculado, bufRecibido);
}

export function metodoPagoDesdeWompi(tipo: string | undefined): 'PSE' | 'NEQUI' {
  return tipo === 'NEQUI' ? 'NEQUI' : 'PSE';
}
