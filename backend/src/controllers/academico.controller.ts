import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import { audit } from '../utils/audit';
import { logger } from '../utils/logger';
import { REGEX } from '../types';

const prisma = new PrismaClient();

// ─── GRADOS ───────────────────────────────────────────────────────────────────

export const validarGrado = [
  body('nombre').trim().notEmpty().withMessage('Nombre del grado requerido'),
  body('grupo').trim().notEmpty().withMessage('Grupo requerido')
    .matches(/^[A-Za-z]$/).withMessage('El grupo debe ser una sola letra'),
  body('nivel').isIn(['primaria', 'secundaria', 'media']).withMessage('Nivel inválido'),
  body('anio').isInt({ min: 2020, max: 2099 }).withMessage('Año inválido'),
];

export async function listarGrados(req: Request, res: Response): Promise<void> {
  const { anio } = req.query;
  try {
    const grados = await prisma.grado.findMany({
      where: { anio: anio ? parseInt(anio as string) : undefined },
      include: {
        _count: { select: { estudiantes: true } },
        materiaGrados: { include: { materia: true, profesor: true } },
      },
      orderBy: [{ nivel: 'asc' }, { nombre: 'asc' }, { grupo: 'asc' }],
    });
    res.json({ ok: true, datos: grados });
  } catch (err) {
    logger.error('Error al listar grados', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function crearGrado(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) });
    return;
  }
  const { nombre, grupo, nivel, anio } = req.body;
  try {
    const existe = await prisma.grado.findUnique({ where: { nombre_grupo_anio: { nombre, grupo: grupo.toUpperCase(), anio: parseInt(anio) } } });
    if (existe) {
      res.status(409).json({ ok: false, mensaje: 'Ya existe ese grado y grupo para ese año' });
      return;
    }
    const grado = await prisma.grado.create({
      data: { nombre: nombre.trim(), grupo: grupo.toUpperCase(), nivel, anio: parseInt(anio) },
    });
    await audit({ usuarioId: req.usuario!.sub, accion: 'CREAR', entidad: 'grados', entidadId: grado.id, ip: req.ip });
    res.status(201).json({ ok: true, datos: grado });
  } catch (err) {
    logger.error('Error al crear grado', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── MATERIAS ─────────────────────────────────────────────────────────────────

export const validarMateria = [
  body('nombre').trim().notEmpty().withMessage('Nombre de materia requerido')
    .matches(REGEX.SOLO_LETRAS).withMessage('El nombre solo puede contener letras'),
  body('codigo').optional().trim(),
];

export async function listarMaterias(_req: Request, res: Response): Promise<void> {
  try {
    const materias = await prisma.materia.findMany({ orderBy: { nombre: 'asc' } });
    res.json({ ok: true, datos: materias });
  } catch (err) {
    logger.error('Error al listar materias', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function crearMateria(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) });
    return;
  }
  const { nombre, codigo } = req.body;
  try {
    const materia = await prisma.materia.create({
      data: { nombre: nombre.trim(), codigo: codigo?.trim() },
    });
    await audit({ usuarioId: req.usuario!.sub, accion: 'CREAR', entidad: 'materias', entidadId: materia.id, ip: req.ip });
    res.status(201).json({ ok: true, datos: materia });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      res.status(409).json({ ok: false, mensaje: 'Ya existe una materia con ese nombre' });
      return;
    }
    logger.error('Error al crear materia', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── ASIGNAR MATERIA A GRADO CON PROFESOR ────────────────────────────────────

export async function asignarMateriaGrado(req: Request, res: Response): Promise<void> {
  const { materiaId, gradoId, profesorId, anio } = req.body;
  try {
    const asignacion = await prisma.materiaGradoProfesor.upsert({
      where: { materiaId_gradoId_anio: { materiaId, gradoId, anio: parseInt(anio) } },
      update: { profesorId },
      create: { materiaId, gradoId, profesorId, anio: parseInt(anio) },
      include: { materia: true, grado: true, profesor: true },
    });
    await audit({ usuarioId: req.usuario!.sub, accion: 'CREAR', entidad: 'materia_grado_profesor', entidadId: asignacion.id, ip: req.ip });
    res.json({ ok: true, datos: asignacion });
  } catch (err) {
    logger.error('Error al asignar materia', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── PERÍODOS ─────────────────────────────────────────────────────────────────

export const validarPeriodo = [
  body('nombre').trim().notEmpty().withMessage('Nombre del período requerido'),
  body('numero').isInt({ min: 1, max: 4 }).withMessage('Número de período entre 1 y 4'),
  body('anio').isInt({ min: 2020, max: 2099 }).withMessage('Año inválido'),
  body('fechaInicio').isISO8601().withMessage('Fecha de inicio inválida'),
  body('fechaFin').isISO8601().withMessage('Fecha de fin inválida'),
];

export async function listarPeriodos(req: Request, res: Response): Promise<void> {
  const { anio } = req.query;
  try {
    const periodos = await prisma.periodo.findMany({
      where: { anio: anio ? parseInt(anio as string) : undefined },
      orderBy: [{ anio: 'desc' }, { numero: 'asc' }],
    });
    res.json({ ok: true, datos: periodos });
  } catch (err) {
    logger.error('Error al listar períodos', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function crearPeriodo(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) });
    return;
  }
  const { nombre, numero, anio, fechaInicio, fechaFin } = req.body;
  try {
    const periodo = await prisma.periodo.create({
      data: {
        nombre: nombre.trim(),
        numero: parseInt(numero),
        anio: parseInt(anio),
        fechaInicio: new Date(fechaInicio),
        fechaFin: new Date(fechaFin),
        activo: false,
      },
    });
    await audit({ usuarioId: req.usuario!.sub, accion: 'CREAR', entidad: 'periodos', entidadId: periodo.id, ip: req.ip });
    res.status(201).json({ ok: true, datos: periodo });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      res.status(409).json({ ok: false, mensaje: 'Ya existe ese período para ese año' });
      return;
    }
    logger.error('Error al crear período', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function activarPeriodo(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    // Desactivar todos primero
    await prisma.periodo.updateMany({ data: { activo: false } });
    const periodo = await prisma.periodo.update({ where: { id }, data: { activo: true } });
    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'periodos', entidadId: id, ip: req.ip });
    res.json({ ok: true, datos: periodo });
  } catch (err) {
    logger.error('Error al activar período', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── STATS DEL DASHBOARD ──────────────────────────────────────────────────────

export async function obtenerStats(_req: Request, res: Response): Promise<void> {
  try {
    const [totalEstudiantes, totalProfesores, totalPadres, totalGrados, periodoActivo] =
      await Promise.all([
        prisma.estudiante.count({ where: { estado: 'ACTIVO' } }),
        prisma.profesor.count(),
        prisma.padre.count(),
        prisma.grado.count(),
        prisma.periodo.findFirst({ where: { activo: true } }),
      ]);

    res.json({
      ok: true,
      datos: { totalEstudiantes, totalProfesores, totalPadres, totalGrados, periodoActivo },
    });
  } catch (err) {
    logger.error('Error al obtener stats', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── EDITAR PERÍODO ───────────────────────────────────────────────────────────
export async function editarPeriodo(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) { res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) }); return; }
  const { id } = req.params;
  const { nombre, numero, anio, fechaInicio, fechaFin } = req.body;
  try {
    const periodo = await prisma.periodo.update({
      where: { id },
      data: { nombre: nombre?.trim(), numero: parseInt(numero), anio: parseInt(anio), fechaInicio: new Date(fechaInicio), fechaFin: new Date(fechaFin) },
    });
    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'periodos', entidadId: id, ip: req.ip });
    res.json({ ok: true, datos: periodo });
  } catch (err) {
    logger.error('Error al editar período', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── EDITAR GRADO ─────────────────────────────────────────────────────────────
export async function editarGrado(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { nombre, grupo, nivel, anio } = req.body;
  try {
    const grado = await prisma.grado.update({
      where: { id },
      data: { nombre: nombre?.trim(), grupo: grupo?.toUpperCase(), nivel, anio: parseInt(anio) },
    });
    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'grados', entidadId: id, ip: req.ip });
    res.json({ ok: true, datos: grado });
  } catch (err) {
    logger.error('Error al editar grado', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function editarMateria(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { nombre, codigo } = req.body;
  try {
    const materia = await prisma.materia.findUnique({ where: { id } });
    if (!materia) { res.status(404).json({ ok: false, mensaje: 'Materia no encontrada' }); return; }

    const actualizada = await prisma.materia.update({
      where: { id },
      data: { 
        nombre: nombre.trim(),
        codigo: codigo?.trim() || null,
      },
    });
    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'materias', entidadId: id, datosAntes: materia, datosDespues: actualizada, ip: req.ip });
    res.json({ ok: true, datos: actualizada });
  } catch (err) {
    logger.error('Error al editar materia', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── ELIMINAR MATERIA ─────────────────────────────────────────────────────────
export async function eliminarMateria(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const materia = await prisma.materia.findUnique({
      where: { id },
      include: {
        _count: { select: { materiaGrados: true, actividades: true } },
      },
    });
    if (!materia) { res.status(404).json({ ok: false, mensaje: 'Materia no encontrada' }); return; }

    if (materia._count.materiaGrados > 0) {
      res.status(400).json({ ok: false, mensaje: `No se puede eliminar: está asignada a ${materia._count.materiaGrados} grado(s)` });
      return;
    }
    if (materia._count.actividades > 0) {
      res.status(400).json({ ok: false, mensaje: `No se puede eliminar: tiene ${materia._count.actividades} actividad(es) asociada(s)` });
      return;
    }

    await prisma.materia.delete({ where: { id } });
    await audit({ usuarioId: req.usuario!.sub, accion: 'ELIMINAR', entidad: 'materias', entidadId: id, datosAntes: materia, ip: req.ip });
    res.json({ ok: true, mensaje: 'Materia eliminada' });
  } catch (err) {
    logger.error('Error al eliminar materia', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}