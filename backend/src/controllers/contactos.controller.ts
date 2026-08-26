import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import { audit } from '../utils/audit';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// ─── VALIDACIONES ─────────────────────────────────────────────────────────────
export const validarContacto = [
  body('nombres')
    .trim()
    .notEmpty().withMessage('El nombre es requerido')
    .isLength({ min: 2, max: 50 }).withMessage('Entre 2 y 50 caracteres')
    .matches(/^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s\-']+$/).withMessage('Solo letras y espacios'),
  body('apellidos')
    .trim()
    .notEmpty().withMessage('El apellido es requerido')
    .isLength({ min: 2, max: 50 }).withMessage('Entre 2 y 50 caracteres')
    .matches(/^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s\-']+$/).withMessage('Solo letras y espacios'),
  body('parentesco')
    .trim()
    .notEmpty().withMessage('El parentesco es requerido')
    .isIn(['padre','madre','acudiente','abuelo','abuela','tio','tia','hermano','hermana','otro'])
    .withMessage('Parentesco inválido'),
  body('telefono')
    .trim()
    .notEmpty().withMessage('El teléfono es requerido')
    .matches(/^[0-9]{7,10}$/).withMessage('Entre 7 y 10 dígitos'),
  body('telefono2')
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[0-9]{7,10}$/).withMessage('Entre 7 y 10 dígitos'),
  body('orden')
    .isInt({ min: 1, max: 3 }).withMessage('El orden debe ser 1, 2 o 3'),
];

// ─── LISTAR CONTACTOS ─────────────────────────────────────────────────────────
export async function listarContactos(req: Request, res: Response): Promise<void> {
  const { estudianteId } = req.params;
  try {
    const contactos = await prisma.contactoEmergencia.findMany({
      where: { estudianteId },
      orderBy: { orden: 'asc' },
    });
    res.json({ ok: true, datos: contactos });
  } catch (err) {
    logger.error('Error al listar contactos', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── CREAR CONTACTO ───────────────────────────────────────────────────────────
export async function crearContacto(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) });
    return;
  }

  const { estudianteId } = req.params;
  const { nombres, apellidos, parentesco, telefono, telefono2, orden } = req.body;

  try {
    // Máximo 3 contactos por estudiante
    const totalContactos = await prisma.contactoEmergencia.count({ where: { estudianteId } });
    if (totalContactos >= 3) {
      res.status(400).json({ ok: false, mensaje: 'Máximo 3 contactos de emergencia por estudiante' });
      return;
    }

    const contacto = await prisma.contactoEmergencia.create({
      data: {
        estudianteId,
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        parentesco,
        telefono: telefono.trim(),
        telefono2: telefono2?.trim() || null,
        orden: parseInt(orden),
      },
    });

    await audit({ usuarioId: req.usuario!.sub, accion: 'CREAR', entidad: 'contactos_emergencia', entidadId: contacto.id, datosDespues: contacto, ip: req.ip });
    res.status(201).json({ ok: true, datos: contacto });
  } catch (err) {
    logger.error('Error al crear contacto', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── EDITAR CONTACTO ──────────────────────────────────────────────────────────
export async function editarContacto(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) });
    return;
  }

  const { id } = req.params;
  const { nombres, apellidos, parentesco, telefono, telefono2, orden } = req.body;

  try {
    const contacto = await prisma.contactoEmergencia.findUnique({ where: { id } });
    if (!contacto) { res.status(404).json({ ok: false, mensaje: 'Contacto no encontrado' }); return; }

    const actualizado = await prisma.contactoEmergencia.update({
      where: { id },
      data: {
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        parentesco,
        telefono: telefono.trim(),
        telefono2: telefono2?.trim() || null,
        orden: parseInt(orden),
      },
    });

    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'contactos_emergencia', entidadId: id, datosAntes: contacto, datosDespues: actualizado, ip: req.ip });
    res.json({ ok: true, datos: actualizado });
  } catch (err) {
    logger.error('Error al editar contacto', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── ELIMINAR CONTACTO ────────────────────────────────────────────────────────
export async function eliminarContacto(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const contacto = await prisma.contactoEmergencia.findUnique({ where: { id } });
    if (!contacto) { res.status(404).json({ ok: false, mensaje: 'Contacto no encontrado' }); return; }

    await prisma.contactoEmergencia.delete({ where: { id } });
    await audit({ usuarioId: req.usuario!.sub, accion: 'ELIMINAR', entidad: 'contactos_emergencia', entidadId: id, datosAntes: contacto, ip: req.ip });
    res.json({ ok: true, mensaje: 'Contacto eliminado' });
  } catch (err) {
    logger.error('Error al eliminar contacto', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}