import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Rol } from '@prisma/client';
import { JwtPayload } from '../types';
import { audit } from '../utils/audit';

// ─── VERIFICAR JWT ───────────────────────────────────────────────────────────

export async function autenticar(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ ok: false, mensaje: 'Token de acceso requerido' });
    return;
  }

  const token = authHeader.split(' ')[1];

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ ok: false, mensaje: 'Sesión expirada, inicia sesión de nuevo' });
    } else {
      res.status(401).json({ ok: false, mensaje: 'Token inválido' });
    }
    return;
  }

  // El rol y el estado se confirman contra la base en cada petición: si a
  // alguien le cambian el rol o le desactivan la cuenta, su sesión abierta deja
  // de valer de inmediato y no hasta que venza el token.
  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: payload.sub }, select: { rol: true, estado: true } });
    if (!usuario || usuario.estado !== 'ACTIVO') {
      res.status(401).json({ ok: false, mensaje: 'Tu cuenta no está activa. Comunícate con el colegio' });
      return;
    }
    req.usuario = { ...payload, rol: usuario.rol };
    next();
  } catch {
    res.status(500).json({ ok: false, mensaje: 'Error al verificar la sesión' });
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

import { prisma } from '../utils/prisma';

/**
 * Datos sensibles (salud, contactos de emergencia): un profesor solo los ve de
 * estudiantes de los grados donde dicta alguna materia o es director de curso.
 * Las notas de otros cursos sí las puede consultar; esto es solo para lo sensible.
 */
export async function validarAccesoProfesorEstudiante(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { usuario } = req;
  if (!usuario || usuario.rol !== 'PROFESOR') { next(); return; }

  try {
    const estudiante = await prisma.estudiante.findUnique({
      where: { id: req.params.estudianteId },
      select: { gradoId: true, grado: { select: { directorCurso: { select: { usuarioId: true } } } } },
    });
    if (!estudiante) { res.status(404).json({ ok: false, mensaje: 'Estudiante no encontrado' }); return; }

    const esDirector = estudiante.grado.directorCurso?.usuarioId === usuario.sub;
    const dicta = esDirector || !!(await prisma.materiaGradoProfesor.findFirst({
      where: { gradoId: estudiante.gradoId, profesor: { usuarioId: usuario.sub } },
      select: { id: true },
    }));
    if (!dicta) {
      res.status(403).json({ ok: false, mensaje: 'Solo puedes ver estos datos de estudiantes de tus cursos' });
      return;
    }
    next();
  } catch {
    res.status(500).json({ ok: false, mensaje: 'Error al verificar acceso' });
  }
}

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
