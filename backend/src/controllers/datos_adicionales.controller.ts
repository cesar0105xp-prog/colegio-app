import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import { audit } from '../utils/audit';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

const GRUPOS_SANGUINEOS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

export const validarDatosAdicionales = [
  body('eps').optional({ checkFalsy: true }).trim().isLength({ max: 100 }).withMessage('Máximo 100 caracteres'),
  body('grupoSanguineo').optional({ checkFalsy: true }).isIn(GRUPOS_SANGUINEOS).withMessage('Grupo sanguíneo inválido'),
  body('alergias').optional({ checkFalsy: true }).trim().isLength({ max: 500 }).withMessage('Máximo 500 caracteres'),
  body('condicionesMedicas').optional({ checkFalsy: true }).trim().isLength({ max: 500 }).withMessage('Máximo 500 caracteres'),
  body('medicamentos').optional({ checkFalsy: true }).trim().isLength({ max: 500 }).withMessage('Máximo 500 caracteres'),
  body('contactoMedico').optional({ checkFalsy: true }).trim().isLength({ max: 100 }).withMessage('Máximo 100 caracteres'),
  body('telefonoMedico').optional({ checkFalsy: true }).trim().matches(/^[0-9]{7,10}$/).withMessage('Entre 7 y 10 dígitos'),
];

export const validarDatosPadre = [
  body('direccion').optional({ checkFalsy: true }).trim().isLength({ min: 5, max: 150 }).withMessage('Entre 5 y 150 caracteres'),
  body('ocupacion').optional({ checkFalsy: true }).trim().isLength({ max: 80 }).withMessage('Máximo 80 caracteres'),
  body('emailContacto').optional({ checkFalsy: true }).isEmail().withMessage('Email inválido'),
  body('telefono').optional({ checkFalsy: true }).trim().matches(/^[0-9]{7,10}$/).withMessage('Entre 7 y 10 dígitos'),
  body('telefonoAlt').optional({ checkFalsy: true }).trim().matches(/^[0-9]{7,10}$/).withMessage('Entre 7 y 10 dígitos'),
];

// ─── OBTENER DATOS ADICIONALES ────────────────────────────────────────────────
export async function obtenerDatosAdicionales(req: Request, res: Response): Promise<void> {
  const { estudianteId } = req.params;
  try {
    const datos = await prisma.datosAdicionales.findUnique({ where: { estudianteId } });
    res.json({ ok: true, datos });
  } catch (err) {
    logger.error('Error al obtener datos adicionales', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── GUARDAR DATOS ADICIONALES (upsert) ───────────────────────────────────────
export async function guardarDatosAdicionales(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) });
    return;
  }

  const { estudianteId } = req.params;
  const { eps, grupoSanguineo, alergias, condicionesMedicas, medicamentos, contactoMedico, telefonoMedico } = req.body;

  try {
    const datos = await prisma.datosAdicionales.upsert({
      where: { estudianteId },
      create: {
        estudianteId,
        eps: eps?.trim() || null,
        grupoSanguineo: grupoSanguineo || null,
        alergias: alergias?.trim() || null,
        condicionesMedicas: condicionesMedicas?.trim() || null,
        medicamentos: medicamentos?.trim() || null,
        contactoMedico: contactoMedico?.trim() || null,
        telefonoMedico: telefonoMedico?.trim() || null,
      },
      update: {
        eps: eps?.trim() || null,
        grupoSanguineo: grupoSanguineo || null,
        alergias: alergias?.trim() || null,
        condicionesMedicas: condicionesMedicas?.trim() || null,
        medicamentos: medicamentos?.trim() || null,
        contactoMedico: contactoMedico?.trim() || null,
        telefonoMedico: telefonoMedico?.trim() || null,
      },
    });

    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'datos_adicionales', entidadId: estudianteId, datosDespues: datos, ip: req.ip });
    res.json({ ok: true, datos, mensaje: 'Datos guardados correctamente' });
  } catch (err) {
    logger.error('Error al guardar datos adicionales', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── ACTUALIZAR DATOS DEL PADRE ───────────────────────────────────────────────
export async function actualizarDatosPadre(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) });
    return;
  }

  const { direccion, ocupacion, emailContacto, telefono, telefonoAlt } = req.body;

  try {
    const padre = await prisma.padre.findUnique({ where: { usuarioId: req.usuario!.sub } });
    if (!padre) { res.status(404).json({ ok: false, mensaje: 'Perfil no encontrado' }); return; }

    const actualizado = await prisma.padre.update({
      where: { id: padre.id },
      data: {
        direccion: direccion?.trim() || null,
        ocupacion: ocupacion?.trim() || null,
        emailContacto: emailContacto?.trim() || null,
        telefono: telefono?.trim() || padre.telefono,
        telefonoAlt: telefonoAlt?.trim() || null,
      },
    });

    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'padres', entidadId: padre.id, datosDespues: actualizado, ip: req.ip });
    res.json({ ok: true, datos: actualizado, mensaje: 'Datos actualizados correctamente' });
  } catch (err) {
    logger.error('Error al actualizar datos del padre', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── TIPOS DE DOCUMENTOS REQUERIDOS ──────────────────────────────────────────
export async function listarTiposDocumento(_req: Request, res: Response): Promise<void> {
  try {
    const tipos = await prisma.tipoDocumentoRequerido.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
    });
    res.json({ ok: true, datos: tipos });
  } catch (err) {
    logger.error('Error al listar tipos de documento', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export const validarTipoDocumento = [
  body('nombre').trim().notEmpty().withMessage('Nombre requerido').isLength({ max: 100 }).withMessage('Máximo 100 caracteres'),
  body('descripcion').optional({ checkFalsy: true }).trim().isLength({ max: 300 }).withMessage('Máximo 300 caracteres'),
  body('obligatorio').optional().isBoolean().withMessage('Valor inválido'),
  body('orden').optional().isInt({ min: 1 }).withMessage('Orden inválido'),
];

export async function crearTipoDocumento(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) });
    return;
  }

  const { nombre, descripcion, obligatorio, orden } = req.body;
  try {
    const tipo = await prisma.tipoDocumentoRequerido.create({
      data: {
        nombre: nombre.trim(),
        descripcion: descripcion?.trim() || null,
        obligatorio: obligatorio ?? true,
        orden: orden ?? 1,
      },
    });
    res.status(201).json({ ok: true, datos: tipo });
  } catch (err) {
    logger.error('Error al crear tipo de documento', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function editarTipoDocumento(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) });
    return;
  }

  const { id } = req.params;
  const { nombre, descripcion, obligatorio, activo, orden } = req.body;
  try {
    const tipo = await prisma.tipoDocumentoRequerido.update({
      where: { id },
      data: { nombre: nombre?.trim(), descripcion: descripcion?.trim() || null, obligatorio, activo, orden },
    });
    res.json({ ok: true, datos: tipo });
  } catch (err) {
    logger.error('Error al editar tipo de documento', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}