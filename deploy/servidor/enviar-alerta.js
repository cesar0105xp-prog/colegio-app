// Envía una alerta del servidor por correo usando la misma cuenta SMTP del portal
// (variables MAIL_* de backend/.env). Destinatario: ALERTA_EMAIL si existe en ese
// .env; si no, MAIL_USER.
//
//   node enviar-alerta.js "Asunto" "Mensaje"   → envía el correo
//   node enviar-alerta.js --verificar          → solo comprueba la conexión SMTP
const APP = '/home/portal/colegio-app/backend';
require(`${APP}/node_modules/dotenv`).config({ path: `${APP}/.env` });
const nodemailer = require(`${APP}/node_modules/nodemailer`);

const transporte = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.MAIL_PORT || '587', 10),
  secure: false,
  auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
});
const destino = process.env.ALERTA_EMAIL || process.env.MAIL_USER;

(async () => {
  if (process.argv[2] === '--verificar') {
    await transporte.verify();
    console.log(`SMTP OK: las alertas llegarían a ${destino}`);
    return;
  }
  const [asunto, mensaje] = process.argv.slice(2);
  if (!asunto || !mensaje) throw new Error('uso: enviar-alerta.js "Asunto" "Mensaje"');
  await transporte.sendMail({
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    to: destino,
    subject: asunto,
    text: `${mensaje}\n\nFecha: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}\n\n— Alerta automática del servidor del Portal Escolar`,
  });
  console.log(`alerta enviada a ${destino}`);
})().catch((err) => {
  console.error(`ERROR al enviar la alerta: ${err.message}`);
  process.exit(1);
});
