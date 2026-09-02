import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { audit } from '../utils/audit';
import { logger } from '../utils/logger';
import { generarAccessToken, generarRefreshToken } from './auth.controller';
import { enviarCorreo, plantillaAccesoMatricula } from '../services/correo.service';

const prisma = new PrismaClient();
const MAGIC_LINK_HORAS = 72;

// ─── GENERAR PIN ALEATORIO (8 caracteres alfanuméricos) ───────────────────────
function generarPin(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pin = '';
  for (let i = 0; i < 8; i++) {
    pin += chars[Math.floor(Math.random() * chars.length)];
  }
  return pin;
}

// ─── GENERAR CÓDIGO DE MATRÍCULA ──────────────────────────────────────────────
async function generarCodigoMatricula(anio: number): Promise<string> {
  const count = await prisma.estudiante.count({
    where: { codigoMatricula: { startsWith: `${anio}-` } },
  });
  const numero = String(count + 1).padStart(3, '0');
  return `${anio}-${numero}`;
}

// ─── GENERAR EMAIL DE ACCESO AUTOMÁTICO ───────────────────────────────────────
function generarEmailAcceso(nombres: string, apellidos: string, codigoMatricula: string): string {
  const limpiar = (str: string) =>
    str.trim().split(' ')[0].toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  const nombre = limpiar(nombres);
  const apellido = limpiar(apellidos);
  const codigo = codigoMatricula.replace('-', '');
  return `${nombre}${apellido}${codigo}@portalescolar.edu.co`;
}

// ─── GENERAR TOKEN DE MAGIC LINK ───────────────────────────────────────────────
function generarMagicLinkToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

async function enviarMagicLink(matriculaId: string, emailPadre: string, nombreEstudiante: string): Promise<{ token: string; enviado: boolean }> {
  const token = generarMagicLinkToken();
  const expiry = new Date(Date.now() + MAGIC_LINK_HORAS * 60 * 60 * 1000);

  await prisma.matricula.update({
    where: { id: matriculaId },
    data: { magicLinkToken: token, magicLinkExpiry: expiry, magicLinkUsedAt: null },
  });

  const enlace = `${(process.env.FRONTEND_URL ?? 'http://localhost:5173').replace(/\/$/, '')}/acceso-matricula/${token}`;
  const enviado = await enviarCorreo({
    para: emailPadre,
    asunto: `Continúa la matrícula de ${nombreEstudiante}`,
    html: plantillaAccesoMatricula(nombreEstudiante, enlace, MAGIC_LINK_HORAS),
  });

  return { token, enviado };
}

// ─── VALIDACIONES ─────────────────────────────────────────────────────────────
export const validarMatricula = [
  body('estudiante.nombres').trim().notEmpty().withMessage('Nombres del estudiante requeridos').isLength({ min: 2, max: 80 }).withMessage('Entre 2 y 80 caracteres'),
  body('estudiante.apellidos').trim().notEmpty().withMessage('Apellidos del estudiante requeridos').isLength({ min: 2, max: 80 }).withMessage('Entre 2 y 80 caracteres'),
  body('estudiante.tipoDocumento').isIn(['RC','TI','CC','CE','PASAPORTE']).withMessage('Tipo de documento inválido'),
  body('estudiante.numeroDocumento').trim().notEmpty().withMessage('Documento del estudiante requerido').isLength({ min: 4, max: 20 }).withMessage('Entre 4 y 20 caracteres'),
  body('estudiante.fechaNacimiento').isDate().withMessage('Fecha de nacimiento inválida'),
  body('estudiante.genero').isIn(['MASCULINO','FEMENINO','OTRO']).withMessage('Género inválido'),
  body('estudiante.gradoId').isUUID().withMessage('Grado inválido'),
  body('padre.nombres').trim().notEmpty().withMessage('Nombres del padre requeridos').isLength({ min: 2, max: 80 }).withMessage('Entre 2 y 80 caracteres'),
  body('padre.apellidos').trim().notEmpty().withMessage('Apellidos del padre requeridos').isLength({ min: 2, max: 80 }).withMessage('Entre 2 y 80 caracteres'),
  body('padre.tipoDocumento').isIn(['CC','CE','PASAPORTE']).withMessage('Tipo de documento del padre inválido'),
  body('padre.numeroDocumento').trim().notEmpty().withMessage('Documento del padre requerido').isLength({ min: 4, max: 20 }).withMessage('Entre 4 y 20 caracteres'),
  body('padre.email').trim().notEmpty().withMessage('El correo del padre/acudiente es requerido para enviar el acceso a matrícula').isEmail().withMessage('Email inválido').isLength({ max: 100 }).withMessage('Máximo 100 caracteres'),
  body('padre.telefono').optional().trim().isLength({ max: 15 }).withMessage('Máximo 15 caracteres'),
  body('padre.parentesco').isIn(['padre','madre','acudiente','abuelo','abuela','tio','tia','otro']).withMessage('Parentesco inválido'),
];

// ─── CREAR MATRÍCULA ──────────────────────────────────────────────────────────
export async function crearMatricula(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) });
    return;
  }

  const { estudiante: datosEst, padre: datosPadre } = req.body;

  try {
    // Verificar que el documento del estudiante no exista
    const docEstExiste = await prisma.estudiante.findFirst({
      where: { numeroDocumento: datosEst.numeroDocumento.trim() },
    });
    if (docEstExiste) {
      res.status(400).json({ ok: false, mensaje: 'Ya existe un estudiante con ese número de documento' });
      return;
    }

    const pin = generarPin();
    const anio = new Date().getFullYear();
    const codigoMatricula = await generarCodigoMatricula(anio);
    const emailAcceso = generarEmailAcceso(datosPadre.nombres, datosPadre.apellidos, codigoMatricula);
    const passwordHash = await bcrypt.hash(pin, 10);

    // Verificar que el email generado no exista
    const emailExiste = await prisma.usuario.findUnique({ where: { email: emailAcceso } });
    if (emailExiste) {
      res.status(400).json({ ok: false, mensaje: 'Error generando acceso. Intenta de nuevo.' });
      return;
    }

    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Crear usuario del padre
      const usuarioPadre = await tx.usuario.create({
        data: {
          email: emailAcceso,
          passwordHash,
          rol: 'PADRE',
          estado: 'ACTIVO',
        },
      });

      // 2. Crear perfil del padre
      const perfilPadre = await tx.padre.create({
        data: {
          usuarioId: usuarioPadre.id,
          nombres: datosPadre.nombres.trim(),
          apellidos: datosPadre.apellidos.trim(),
          tipoDocumento: datosPadre.tipoDocumento,
          numeroDocumento: datosPadre.numeroDocumento.trim(),
          telefono: datosPadre.telefono?.trim() || '',
          emailContacto: datosPadre.email?.trim() ?? null,
        },
      });

      // 3. Crear estudiante en estado INACTIVO
      const nuevoEst = await tx.estudiante.create({
        data: {
          nombres: datosEst.nombres.trim(),
          apellidos: datosEst.apellidos.trim(),
          tipoDocumento: datosEst.tipoDocumento,
          numeroDocumento: datosEst.numeroDocumento.trim(),
          fechaNacimiento: new Date(datosEst.fechaNacimiento),
          genero: datosEst.genero,
          gradoId: datosEst.gradoId,
          direccion: datosEst.direccion?.trim() ?? null,
          telefono: datosEst.telefono?.trim() ?? null,
          estado: 'INACTIVO',
          codigoMatricula,
        },
      });

      // 4. Vincular padre con estudiante
      await tx.padreEstudiante.create({
        data: {
          padreId: perfilPadre.id,
          estudianteId: nuevoEst.id,
          parentesco: datosPadre.parentesco,
          esPrincipal: true,
        },
      });

      // 5. Crear registro de matrícula
      const matricula = await tx.matricula.create({
        data: {
          estudianteId: nuevoEst.id,
          padreId: perfilPadre.id,
          pin: passwordHash,
          estadoDocumentos: 'PENDIENTE',
        },
      });

      return { usuarioPadre, perfilPadre, nuevoEst, matricula };
    });

    await audit({
      usuarioId: req.usuario!.sub,
      accion: 'CREAR',
      entidad: 'matriculas',
      entidadId: resultado.matricula.id,
      datosDespues: { codigoMatricula, emailAcceso },
      ip: req.ip,
    });

    const nombreCompleto = `${resultado.nuevoEst.nombres} ${resultado.nuevoEst.apellidos}`;
    const { enviado: magicLinkEnviado } = await enviarMagicLink(resultado.matricula.id, datosPadre.email.trim(), nombreCompleto);

    res.status(201).json({
      ok: true,
      mensaje: 'Matrícula creada exitosamente',
      datos: {
        codigoMatricula,
        emailAcceso,
        emailContacto: datosPadre.email ?? null,
        pin,
        magicLinkEnviado,
        estudiante: {
          nombres: resultado.nuevoEst.nombres,
          apellidos: resultado.nuevoEst.apellidos,
        },
        matriculaId: resultado.matricula.id,
      },
    });
  } catch (err) {
    logger.error('Error al crear matrícula', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── LISTAR MATRÍCULAS ────────────────────────────────────────────────────────
export async function listarMatriculas(req: Request, res: Response): Promise<void> {
  const { estado } = req.query;
  try {
    const matriculas = await prisma.matricula.findMany({
      where: estado ? { estadoDocumentos: estado as string } : undefined,
      include: {
        estudiante: {
          select: {
            id: true, nombres: true, apellidos: true, codigoMatricula: true,
            grado: { select: { nombre: true, grupo: true } },
          },
        },
        padre: {
          select: {
            nombres: true, apellidos: true,
            usuario: { select: { email: true } },
          },
        },
        verificador: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ ok: true, datos: matriculas });
  } catch (err) {
    logger.error('Error al listar matrículas', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── VERIFICAR MATRÍCULA ──────────────────────────────────────────────────────
export async function verificarMatricula(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { observaciones } = req.body;
  if (observaciones && String(observaciones).length > 500) {
    res.status(400).json({ ok: false, mensaje: 'Observaciones máximo 500 caracteres' });
    return;
  }
  try {
    const matricula = await prisma.matricula.findUnique({
      where: { id },
      include: { estudiante: true },
    });
    if (!matricula) { res.status(404).json({ ok: false, mensaje: 'Matrícula no encontrada' }); return; }

    await prisma.$transaction(async (tx) => {
      await tx.estudiante.update({ where: { id: matricula.estudianteId }, data: { estado: 'ACTIVO' } });
      await tx.matricula.update({
        where: { id },
        data: {
          estadoDocumentos: 'VERIFICADO',
          verificadoPor: req.usuario!.sub,
          fechaVerificacion: new Date(),
          observaciones: observaciones?.trim() ?? null,
        },
      });
    });

    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'matriculas', entidadId: id, datosDespues: { estado: 'VERIFICADO' }, ip: req.ip });
    res.json({ ok: true, mensaje: 'Matrícula verificada y estudiante activado correctamente' });
  } catch (err) {
    logger.error('Error al verificar matrícula', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── RECHAZAR MATRÍCULA ───────────────────────────────────────────────────────
export async function rechazarMatricula(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { observaciones } = req.body;
  if (observaciones && String(observaciones).length > 500) {
    res.status(400).json({ ok: false, mensaje: 'Observaciones máximo 500 caracteres' });
    return;
  }
  try {
    await prisma.matricula.update({
      where: { id },
      data: {
        estadoDocumentos: 'RECHAZADO',
        verificadoPor: req.usuario!.sub,
        fechaVerificacion: new Date(),
        observaciones: observaciones?.trim() ?? null,
      },
    });
    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'matriculas', entidadId: id, datosDespues: { estadoDocumentos: 'RECHAZADO' }, ip: req.ip });
    res.json({ ok: true, mensaje: 'Matrícula rechazada' });
  } catch (err) {
    logger.error('Error al rechazar matrícula', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── ACCEDER CON MAGIC LINK (público, sin autenticación) ──────────────────────
export async function accederConMagicLink(req: Request, res: Response): Promise<void> {
  const { token } = req.params;

  try {
    const matricula = await prisma.matricula.findUnique({
      where: { magicLinkToken: token },
      include: {
        padre: { include: { usuario: true } },
        estudiante: { select: { nombres: true, apellidos: true } },
      },
    });

    if (!matricula) {
      res.status(404).json({ ok: false, mensaje: 'Enlace de acceso inválido' });
      return;
    }

    if (matricula.magicLinkUsedAt) {
      res.status(410).json({ ok: false, mensaje: 'Este enlace ya fue utilizado. Ingresa con tu correo y PIN, o pide a secretaría que reenvíe el enlace.' });
      return;
    }

    if (!matricula.magicLinkExpiry || matricula.magicLinkExpiry < new Date()) {
      res.status(410).json({ ok: false, mensaje: 'Este enlace expiró. Ingresa con tu correo y PIN, o pide a secretaría que reenvíe el enlace.' });
      return;
    }

    const usuario = matricula.padre.usuario;
    if (usuario.estado !== 'ACTIVO') {
      res.status(403).json({ ok: false, mensaje: 'Cuenta inactiva. Contacta al colegio.' });
      return;
    }

    const accessToken = generarAccessToken({ sub: usuario.id, email: usuario.email, rol: usuario.rol });
    const refreshToken = generarRefreshToken(usuario.id);
    const refreshHash = await bcrypt.hash(refreshToken, 10);

    await prisma.$transaction([
      prisma.usuario.update({
        where: { id: usuario.id },
        data: { refreshToken: refreshHash, ultimoLogin: new Date(), intentosFallidos: 0, bloqueadoHasta: null },
      }),
      prisma.matricula.update({
        where: { id: matricula.id },
        data: { magicLinkUsedAt: new Date() },
      }),
    ]);

    await audit({ usuarioId: usuario.id, accion: 'LOGIN', ip: req.ip, userAgent: req.headers['user-agent'] });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      ok: true,
      datos: {
        accessToken,
        usuario: { id: usuario.id, email: usuario.email, rol: usuario.rol },
        matriculaId: matricula.id,
        estudiante: matricula.estudiante,
      },
    });
  } catch (err) {
    logger.error('Error al acceder con magic link', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── REENVIAR MAGIC LINK (secretario/admin) ────────────────────────────────────
export async function reenviarLink(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const matricula = await prisma.matricula.findUnique({
      where: { id },
      include: {
        padre: { include: { usuario: true } },
        estudiante: { select: { nombres: true, apellidos: true } },
      },
    });
    if (!matricula) { res.status(404).json({ ok: false, mensaje: 'Matrícula no encontrada' }); return; }

    const nombreCompleto = `${matricula.estudiante.nombres} ${matricula.estudiante.apellidos}`;
    const { enviado } = await enviarMagicLink(matricula.id, matricula.padre.usuario.email, nombreCompleto);

    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'matriculas', entidadId: id, datosDespues: { accion: 'reenviar_link' }, ip: req.ip });

    res.json({ ok: true, mensaje: enviado ? 'Enlace reenviado al correo del padre/acudiente' : 'Enlace regenerado, pero el correo no pudo enviarse. Verifica la configuración de correo.' });
  } catch (err) {
    logger.error('Error al reenviar enlace de matrícula', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}