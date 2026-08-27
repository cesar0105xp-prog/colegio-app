import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { JwtPayload, RefreshPayload, REGEX } from '../types';
import { audit } from '../utils/audit';
import { logger } from '../utils/logger';
import { SALT_ROUNDS } from '../utils/config';

const prisma = new PrismaClient();
const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;

// ─── VALIDACIONES ────────────────────────────────────────────────────────────

export const validarLogin = [
  body('email')
    .trim()
    .isEmail().withMessage('Email inválido')
    .normalizeEmail(),
  body('password')
    .trim()
    .notEmpty().withMessage('Contraseña requerida')
    .isLength({ min: 8 }).withMessage('Contraseña mínimo 8 caracteres'),
];

// ─── GENERAR TOKENS ──────────────────────────────────────────────────────────

function generarAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
  } as jwt.SignOptions);
}

function generarRefreshToken(usuarioId: string): string {
  return jwt.sign({ sub: usuarioId }, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  } as jwt.SignOptions);
}

// ─── LOGIN ───────────────────────────────────────────────────────────────────

export async function login(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) });
    return;
  }

  const { email, password } = req.body;
  const ip = req.ip;
  const userAgent = req.headers['user-agent'];

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email } });

    // Usuario no existe — mismo mensaje genérico por seguridad
    if (!usuario) {
      await audit({ accion: 'LOGIN_FALLIDO', ip, userAgent, datosAntes: { email } });
      res.status(401).json({ ok: false, mensaje: 'Credenciales inválidas' });
      return;
    }

    // Cuenta bloqueada
    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
      const minutosRestantes = Math.ceil(
        (usuario.bloqueadoHasta.getTime() - Date.now()) / 60000
      );
      res.status(423).json({
        ok: false,
        mensaje: `Cuenta bloqueada. Intenta en ${minutosRestantes} minutos`,
      });
      return;
    }

    // Cuenta inactiva
    if (usuario.estado !== 'ACTIVO') {
      res.status(403).json({ ok: false, mensaje: 'Cuenta inactiva. Contacta al administrador' });
      return;
    }

    // Verificar contraseña
    const passwordOk = await bcrypt.compare(password, usuario.passwordHash);

    if (!passwordOk) {
      const intentos = usuario.intentosFallidos + 1;
      const data: Record<string, unknown> = { intentosFallidos: intentos };

      if (intentos >= MAX_INTENTOS) {
        data.bloqueadoHasta = new Date(Date.now() + BLOQUEO_MINUTOS * 60 * 1000);
        data.intentosFallidos = 0;
        await audit({
          usuarioId: usuario.id,
          accion: 'BLOQUEO_CUENTA',
          ip,
          userAgent,
        });
      }

      await prisma.usuario.update({ where: { id: usuario.id }, data });
      await audit({ usuarioId: usuario.id, accion: 'LOGIN_FALLIDO', ip, userAgent });

      const restantes = MAX_INTENTOS - intentos;
      res.status(401).json({
        ok: false,
        mensaje: restantes > 0
          ? `Credenciales inválidas. ${restantes} intento(s) restantes`
          : `Cuenta bloqueada por ${BLOQUEO_MINUTOS} minutos`,
      });
      return;
    }

    // Login exitoso — resetear intentos fallidos
    const accessToken = generarAccessToken({ sub: usuario.id, email: usuario.email, rol: usuario.rol });
    const refreshToken = generarRefreshToken(usuario.id);
    const refreshHash = await bcrypt.hash(refreshToken, 10);

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        intentosFallidos: 0,
        bloqueadoHasta: null,
        ultimoLogin: new Date(),
        refreshToken: refreshHash,
      },
    });

    await audit({ usuarioId: usuario.id, accion: 'LOGIN', ip, userAgent });

    // Refresh token en cookie httpOnly
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    });

    res.json({
      ok: true,
      datos: {
        accessToken,
        usuario: { id: usuario.id, email: usuario.email, rol: usuario.rol },
      },
    });
  } catch (err) {
    logger.error('Error en login', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── REFRESH TOKEN ───────────────────────────────────────────────────────────

export async function refreshToken(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.refreshToken;

  if (!token) {
    res.status(401).json({ ok: false, mensaje: 'Refresh token no encontrado' });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as RefreshPayload;
    const usuario = await prisma.usuario.findUnique({ where: { id: payload.sub } });

    if (!usuario || !usuario.refreshToken) {
      res.status(401).json({ ok: false, mensaje: 'Sesión inválida' });
      return;
    }

    const tokenValido = await bcrypt.compare(token, usuario.refreshToken);
    if (!tokenValido) {
      res.status(401).json({ ok: false, mensaje: 'Sesión inválida' });
      return;
    }

    const nuevoAccess = generarAccessToken({
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
    });
    const nuevoRefresh = generarRefreshToken(usuario.id);
    const nuevoHash = await bcrypt.hash(nuevoRefresh, 10);

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { refreshToken: nuevoHash },
    });

    res.cookie('refreshToken', nuevoRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ ok: true, datos: { accessToken: nuevoAccess } });
  } catch {
    res.status(401).json({ ok: false, mensaje: 'Refresh token expirado o inválido' });
  }
}

// ─── LOGOUT ──────────────────────────────────────────────────────────────────

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    if (req.usuario) {
      await prisma.usuario.update({
        where: { id: req.usuario.sub },
        data: { refreshToken: null },
      });
      await audit({ usuarioId: req.usuario.sub, accion: 'LOGOUT', ip: req.ip });
    }

    res.clearCookie('refreshToken');
    res.json({ ok: true, mensaje: 'Sesión cerrada' });
  } catch (err) {
    logger.error('Error en logout', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── CAMBIAR CONTRASEÑA ──────────────────────────────────────────────────────

export const validarCambioPassword = [
  body('passwordActual').trim().notEmpty().withMessage('Contraseña actual requerida'),
  body('passwordNueva')
    .trim()
    .matches(REGEX.PASSWORD)
    .withMessage('La contraseña nueva debe tener mínimo 8 caracteres, una mayúscula, un número y un carácter especial'),
];

export async function cambiarPassword(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) });
    return;
  }

  const { passwordActual, passwordNueva } = req.body;

  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario!.sub } });
    if (!usuario) {
      res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' });
      return;
    }

    const ok = await bcrypt.compare(passwordActual, usuario.passwordHash);
    if (!ok) {
      res.status(401).json({ ok: false, mensaje: 'Contraseña actual incorrecta' });
      return;
    }

    const nuevoHash = await bcrypt.hash(passwordNueva, SALT_ROUNDS);
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { passwordHash: nuevoHash, refreshToken: null },
    });

    await audit({
      usuarioId: usuario.id,
      accion: 'CAMBIO_CONTRASENA',
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.clearCookie('refreshToken');
    res.json({ ok: true, mensaje: 'Contraseña actualizada. Inicia sesión de nuevo' });
  } catch (err) {
    logger.error('Error al cambiar contraseña', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}