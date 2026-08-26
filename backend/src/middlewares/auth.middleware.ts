import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Rol } from '@prisma/client';
import { JwtPayload } from '../types';
import { audit } from '../utils/audit';

// ─── VERIFICAR JWT ───────────────────────────────────────────────────────────

export function autenticar(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ ok: false, mensaje: 'Token de acceso requerido' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.usuario = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ ok: false, mensaje: 'Sesión expirada, inicia sesión de nuevo' });
    } else {
      res.status(401).json({ ok: false, mensaje: 'Token inválido' });
    }
  }
}

// ─── AUTORIZAR POR ROL ───────────────────────────────────────────────────────

export function autorizar(...rolesPermitidos: Rol[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.usuario) {
      res.status(401).json({ ok: false, mensaje: 'No autenticado' });
      return;
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      audit({
        usuarioId: req.usuario.sub,
        accion: 'VER',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        datosAntes: { intento: req.path, rolRequerido: rolesPermitidos, rolActual: req.usuario.rol },
      });
      res.status(403).json({ ok: false, mensaje: 'No tienes permisos para esta acción' });
      return;
    }

    next();
  };
}

// ─── VALIDAR QUE EL PADRE SOLO VEA A SUS HIJOS ──────────────────────────────
// Este middleware se usa en rutas donde el param :estudianteId debe pertenecer al padre

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function validarAccesoPadreEstudiante(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { usuario } = req;
  const estudianteId = req.params.estudianteId ?? req.body?.estudianteId;

  if (!usuario || usuario.rol !== 'PADRE') {
    next();
    return;
  }

  try {
    const padre = await prisma.padre.findUnique({ where: { usuarioId: usuario.sub } });
    if (!padre) {
      res.status(403).json({ ok: false, mensaje: 'Perfil de padre no encontrado' });
      return;
    }

    const relacion = await prisma.padreEstudiante.findFirst({
      where: { padreId: padre.id, estudianteId },
    });

    if (!relacion) {
      res.status(403).json({ ok: false, mensaje: 'No tienes acceso a la información de este estudiante' });
      return;
    }

    next();
  } catch {
    res.status(500).json({ ok: false, mensaje: 'Error al verificar acceso' });
  }
}

// ─── VALIDAR QUE EL ESTUDIANTE SOLO VEA SU PROPIO PERFIL ────────────────────

export async function validarAccesoEstudiante(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { usuario } = req;
  const estudianteId = req.params.estudianteId;

  if (!usuario || usuario.rol !== 'ESTUDIANTE') {
    next();
    return;
  }

  try {
    const estudiante = await prisma.estudiante.findUnique({ where: { usuarioId: usuario.sub } });

    if (!estudiante || estudiante.id !== estudianteId) {
      res.status(403).json({ ok: false, mensaje: 'Solo puedes ver tu propia información' });
      return;
    }

    next();
  } catch {
    res.status(500).json({ ok: false, mensaje: 'Error al verificar acceso' });
  }
}
