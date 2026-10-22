import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { audit } from '../utils/audit';
import { logger } from '../utils/logger';
import { REGEX } from '../types';

import { prisma } from '../utils/prisma';

// ─── GRADOS ───────────────────────────────────────────────────────────────────

export const validarGrado = [
  body('nombre').trim().notEmpty().withMessage('Nombre del grado requerido'),
  body('grupo').trim().notEmpty().withMessage('Grupo requerido')
    .matches(/^[A-Za-z]$/).withMessage('El grupo debe ser una sola letra'),
  body('nivel').isIn(['primaria', 'secundaria', 'media']).withMessage('Nivel inválido'),
  body('anio').isInt({ min: 2020, max: 2099 }).withMessage('Año inválido'),
  body('tipoAsistencia').optional().isIn(['DIRECTOR_FIJO', 'ROTATIVO_HORARIO']).withMessage('Tipo de asistencia inválido'),
  body('directorCursoId').optional({ checkFalsy: true }).isUUID().withMessage('Director de curso inválido'),
];

export async function listarGrados(req: Request, res: Response): Promise<void> {
  const { anio } = req.query;
  try {
    const grados = await prisma.grado.findMany({
      where: { anio: anio ? parseInt(anio as string) : undefined },
      include: {
        _count: { select: { estudiantes: true } },
        materiaGrados: { include: { materia: true, profesor: true } },
        directorCurso: { select: { id: true, nombres: true, apellidos: true } },
        planEstudio: { include: { materia: { select: { id: true, nombre: true } } } },
      },
      orderBy: [{ nivel: 'asc' }, { nombre: 'asc' }, { grupo: 'asc' }],
    });
    res.json({ ok: true, datos: grados });
  } catch (err) {
    logger.error('Error al listar grados', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

/**
 * Nombres de grado para el formulario público de solicitud de cupo. Se leen de
 * la base: cuando administración cree 8° a 11°, aparecen solos.
 */
export async function listarGradosPublicos(_req: Request, res: Response): Promise<void> {
  try {
    const grados = await prisma.grado.findMany({
      distinct: ['nombre'],
      select: { nombre: true, nivel: true },
      orderBy: [{ anio: 'desc' }, { nivel: 'asc' }, { nombre: 'asc' }],
    });
    res.json({ ok: true, datos: grados.map(g => g.nombre) });
  } catch (err) {
    logger.error('Error al listar los grados públicos', { err });
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
    // Toda materia con docente forma parte del plan de estudios del grado
    await prisma.planEstudio.upsert({
      where: { gradoId_materiaId: { gradoId, materiaId } },
      update: {},
      create: { gradoId, materiaId },
    });
    await audit({ usuarioId: req.usuario!.sub, accion: 'CREAR', entidad: 'materia_grado_profesor', entidadId: asignacion.id, ip: req.ip });
    res.json({ ok: true, datos: asignacion });
  } catch (err) {
    logger.error('Error al asignar materia', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── PLAN DE ESTUDIOS DEL GRADO ──────────────────────────────────────────────
// Materias que se ven en el grado aunque todavía no tengan docente. El boletín
// se arma desde aquí.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function agregarMateriaAlPlan(req: Request, res: Response): Promise<void> {
  const { id: gradoId } = req.params;
  const { materiaId } = req.body;
  if (!UUID.test(gradoId) || !materiaId || !UUID.test(materiaId)) {
    res.status(400).json({ ok: false, mensaje: 'Grado o materia inválidos' });
    return;
  }
  try {
    const [grado, materia] = await Promise.all([
      prisma.grado.findUnique({ where: { id: gradoId }, select: { id: true } }),
      prisma.materia.findUnique({ where: { id: materiaId }, select: { id: true, nombre: true } }),
    ]);
    if (!grado || !materia) { res.status(404).json({ ok: false, mensaje: 'Grado o materia no encontrados' }); return; }

    const existe = await prisma.planEstudio.findUnique({ where: { gradoId_materiaId: { gradoId, materiaId } } });
    if (existe) { res.status(409).json({ ok: false, mensaje: `${materia.nombre} ya está en el plan de estudios de este grado` }); return; }

    const item = await prisma.planEstudio.create({ data: { gradoId, materiaId } });
    await audit({ usuarioId: req.usuario!.sub, accion: 'CREAR', entidad: 'plan_estudio', entidadId: item.id, datosDespues: { gradoId, materiaId }, ip: req.ip });
    res.status(201).json({ ok: true, mensaje: `${materia.nombre} agregada al plan de estudios`, datos: item });
  } catch (err) {
    logger.error('Error al agregar materia al plan de estudios', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function quitarMateriaDelPlan(req: Request, res: Response): Promise<void> {
  const { id: gradoId, materiaId } = req.params;
  if (!UUID.test(gradoId) || !UUID.test(materiaId)) {
    res.status(400).json({ ok: false, mensaje: 'Grado o materia inválidos' });
    return;
  }
  try {
    // Si ya tiene docente asignado, seguiría saliendo en el boletín: se exige
    // resolver primero la asignación para no dejar el plan inconsistente.
    const asignada = await prisma.materiaGradoProfesor.findFirst({ where: { gradoId, materiaId }, select: { id: true } });
    if (asignada) {
      res.status(409).json({ ok: false, mensaje: 'Esta materia tiene docente asignado en el grado; no se puede quitar del plan de estudios' });
      return;
    }
    const borrados = await prisma.planEstudio.deleteMany({ where: { gradoId, materiaId } });
    if (borrados.count === 0) { res.status(404).json({ ok: false, mensaje: 'La materia no está en el plan de estudios de este grado' }); return; }
    await audit({ usuarioId: req.usuario!.sub, accion: 'ELIMINAR', entidad: 'plan_estudio', datosAntes: { gradoId, materiaId }, ip: req.ip });
    res.json({ ok: true, mensaje: 'Materia quitada del plan de estudios' });
  } catch (err) {
    logger.error('Error al quitar materia del plan de estudios', { err });
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
  const { nombre, grupo, nivel, anio, tipoAsistencia, directorCursoId } = req.body;
  try {
    // Quién llama a lista: director de curso fijo, o el profesor de la primera clase
    if (tipoAsistencia === 'DIRECTOR_FIJO' && !directorCursoId) {
      res.status(400).json({ ok: false, mensaje: 'Indica el director de curso que tomará la asistencia' });
      return;
    }
    if (tipoAsistencia === 'ROTATIVO_HORARIO') {
      const primerasClases = await prisma.horarioClase.count({ where: { gradoId: id, esPrimeraClase: true } });
      if (primerasClases === 0) {
        res.status(400).json({ ok: false, mensaje: 'Antes de pasar a horario rotativo, marca la primera clase de al menos un día en el horario del grado' });
        return;
      }
    }

    const grado = await prisma.grado.update({
      where: { id },
      data: {
        nombre: nombre?.trim(), grupo: grupo?.toUpperCase(), nivel, anio: parseInt(anio),
        tipoAsistencia: tipoAsistencia ?? undefined,
        // En rotativo no hay director de curso tomando asistencia
        directorCursoId: tipoAsistencia === 'ROTATIVO_HORARIO' ? null : (directorCursoId ?? undefined),
      },
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