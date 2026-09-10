import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST ?? 'smtp.gmail.com',
  port: parseInt(process.env.MAIL_PORT ?? '587'),
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

export async function enviarCorreo({
  para, asunto, html,
}: {
  para: string | string[];
  asunto: string;
  html: string;
}): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM ?? 'Portal Escolar',
      to: Array.isArray(para) ? para.join(',') : para,
      subject: asunto,
      html,
    });
    return true;
  } catch (err) {
    logger.error('Error al enviar correo', { err });
    return false;
  }
}

export function plantillaAccesoMatricula(nombreEstudiante: string, enlace: string, horasExpira = 72, colegio = 'Portal Escolar'): string {
  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#F8FAFC;font-family:Arial,sans-serif;">
    <div style="max-width:600px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#1E40AF,#3B82F6);padding:32px 40px;">
        <h1 style="margin:0;color:white;font-size:22px;font-weight:700;">${colegio}</h1>
        <p style="margin:4px 0 0;color:#BFDBFE;font-size:13px;">Proceso de matrícula</p>
      </div>
      <div style="padding:32px 40px;">
        <h2 style="margin:0 0 16px;color:#1E293B;font-size:18px;">Continúa la matrícula de ${nombreEstudiante}</h2>
        <p style="color:#475569;font-size:15px;line-height:1.7;">Hemos habilitado tu acceso al portal para completar el proceso de matrícula. Haz clic en el botón para ingresar directamente, sin necesidad de recordar contraseñas.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${enlace}" style="display:inline-block;background:#2563EB;color:white;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:12px;">Acceder a mi matrícula</a>
        </div>
        <p style="color:#94A3B8;font-size:13px;line-height:1.6;">Este enlace es de un solo uso y expira en ${horasExpira} horas. Si ya expiró o fue usado, solicita a secretaría que te envíe uno nuevo, o ingresa con tu correo y PIN de acceso.</p>
      </div>
      <div style="background:#F1F5F9;padding:20px 40px;border-top:1px solid #E2E8F0;">
        <p style="margin:0;color:#94A3B8;font-size:12px;">Este es un mensaje automático del ${colegio}. Por favor no responder este correo.</p>
      </div>
    </div>
  </body>
  </html>`;
}

export function plantillaComunicado(titulo: string, mensaje: string, colegio = 'Portal Escolar'): string {
  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#F8FAFC;font-family:Arial,sans-serif;">
    <div style="max-width:600px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#1E40AF,#3B82F6);padding:32px 40px;">
        <h1 style="margin:0;color:white;font-size:22px;font-weight:700;">${colegio}</h1>
        <p style="margin:4px 0 0;color:#BFDBFE;font-size:13px;">Comunicado oficial</p>
      </div>
      <div style="padding:32px 40px;">
        <h2 style="margin:0 0 16px;color:#1E293B;font-size:18px;">${titulo}</h2>
        <div style="color:#475569;font-size:15px;line-height:1.7;white-space:pre-wrap;">${mensaje}</div>
      </div>
      <div style="background:#F1F5F9;padding:20px 40px;border-top:1px solid #E2E8F0;">
        <p style="margin:0;color:#94A3B8;font-size:12px;">Este es un mensaje automático del ${colegio}. Por favor no responder este correo.</p>
      </div>
    </div>
  </body>
  </html>`;
}