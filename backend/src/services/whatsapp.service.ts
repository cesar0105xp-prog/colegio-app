import twilio from 'twilio';
import { logger } from '../utils/logger';

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? '';
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? '';
const FROM = process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886';

const credencialesReales = ACCOUNT_SID.startsWith('AC') && AUTH_TOKEN.length > 0;
const cliente = credencialesReales ? twilio(ACCOUNT_SID, AUTH_TOKEN) : null;

/** Normaliza un número de Colombia a formato E.164 (+57...) si no viene ya con indicativo. */
function normalizarNumeroCO(numero: string): string {
  const digitos = numero.replace(/\D/g, '');
  if (digitos.startsWith('57') && digitos.length === 12) return `+${digitos}`;
  if (digitos.length === 10) return `+57${digitos}`;
  return `+${digitos}`;
}

/**
 * Envía un mensaje de WhatsApp al acudiente. En modo desarrollo (sin credenciales
 * reales de Twilio) solo registra el mensaje en el log en vez de enviarlo.
 */
export async function enviarWhatsApp(numero: string | null | undefined, mensaje: string): Promise<boolean> {
  if (!numero) {
    logger.warn('WhatsApp no enviado: el destinatario no tiene teléfono registrado');
    return false;
  }

  const destino = `whatsapp:${normalizarNumeroCO(numero)}`;

  if (!cliente) {
    logger.info('[WhatsApp - modo desarrollo] No hay credenciales reales de Twilio configuradas', { destino, mensaje });
    return true;
  }

  try {
    await cliente.messages.create({ from: FROM, to: destino, body: mensaje });
    return true;
  } catch (err) {
    logger.error('Error al enviar WhatsApp', { err, destino });
    return false;
  }
}

export const PlantillasWhatsApp = {
  documentoAprobado: (nombreEstudiante: string, documento: string) =>
    `Portal Escolar: el documento "${documento}" de ${nombreEstudiante} fue aprobado. Sigue así con el proceso de matrícula.`,
  documentoRechazado: (nombreEstudiante: string, documento: string, motivo: string) =>
    `Portal Escolar: el documento "${documento}" de ${nombreEstudiante} fue rechazado. Motivo: ${motivo}. Ingresa al portal para volver a subirlo.`,
  matriculaConfirmada: (nombreEstudiante: string) =>
    `Portal Escolar: ¡la matrícula de ${nombreEstudiante} fue confirmada! Ya puedes ver toda la información en el portal.`,
  cobroPendiente: (nombreEstudiante: string, concepto: string, monto: string) =>
    `Portal Escolar: tienes un cobro pendiente de ${concepto} (${monto}) para ${nombreEstudiante}. Ingresa al portal para pagarlo.`,
  comprobanteAprobado: (nombreEstudiante: string, concepto: string) =>
    `Portal Escolar: tu comprobante de pago de ${concepto} para ${nombreEstudiante} fue aprobado. Gracias por tu pago.`,
};
