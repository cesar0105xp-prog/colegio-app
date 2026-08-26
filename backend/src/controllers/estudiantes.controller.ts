import { Request, Response } from 'express';
import { PrismaClient, TipoDocumento, Genero, EstadoEstudiante } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import { audit } from '../utils/audit';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// ─── LÍMITES POR TIPO DE DOCUMENTO (estándar colombiano) ─────────────────────
const DOC_LIMITES: Record<string, { min: number; max: number; soloNumeros: boolean }> = {
  RC:        { min: 8,  max: 11, soloNumeros: true  },
  TI:        { min: 10, max: 11, soloNumeros: true  },
  CC:        { min: 6,  max: 10, soloNumeros: true  },
  CE:        { min: 6,  max: 12, soloNumeros: true  },
  PASAPORTE: { min: 5,  max: 12, soloNumeros: false },
};

export const validarEstudiante = [
  body('nombres')
    .trim()
    .notEmpty().withMessage('Los nombres son requeridos')
    .matches(/^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s\-']+$/).withMessage('Solo letras, tildes, espacios y guión')
    .isLength({ min: 2, max: 50 }).withMessage('Nombres entre 2 y 50 caracteres'),

  body('apellidos')
    .trim()
    .notEmpty().withMessage('Los apellidos son requeridos')
    .matches(/^[a-záéíóúüñA-ZÁÉÍÓÚÜÑ\s\-']+$/).withMessage('Solo letras, tildes, espacios y guión')
    .isLength({ min: 2, max: 50 }).withMessage('Apellidos entre 2 y 50 caracteres'),

  body('tipoDocumento')
    .isIn(Object.values(TipoDocumento))
    .withMessage('Tipo de documento inválido'),

  body('numeroDocumento')
    .trim()
    .notEmpty().withMessage('El número de documento es requerido')
    .custom((valor, { req }) => {
      const tipo = req.body.tipoDocumento as string;
      const limites = DOC_LIMITES[tipo];
      if (!limites) throw new Error('Tipo de documento inválido');
      if (limites.soloNumeros && !/^\d+$/.test(valor)) throw new Error('El documento solo puede contener dígitos');
      if (valor.length < limites.min || valor.length > limites.max) {
        const nombres: Record<string, string> = { RC: 'Registro Civil', TI: 'Tarjeta de Identidad', CC: 'Cédula de Ciudadanía', CE: 'Cédula de Extranjería', PASAPORTE: 'Pasaporte' };
        throw new Error(`${nombres[tipo]}: entre ${limites.min} y ${limites.max} ${limites.soloNumeros ? 'dígitos' : 'caracteres'}`);
      }
      return true;
    }),

  body('fechaNacimiento')
    .isISO8601().withMessage('Fecha de nacimiento inválida')
    .custom((valor) => {
      const fecha = new Date(valor);
      const hoy = new Date();
      if (fecha > hoy) throw new Error('La fecha de nacimiento no puede ser futura');
      if (hoy.getFullYear() - fecha.getFullYear() > 30) throw new Error('Verifica la fecha de nacimiento');
      return true;
    }),

  body('genero').isIn(Object.values(Genero)).withMessage('Género inválido'),
  body('gradoId').isUUID().withMessage('Grado inválido'),
  body('direccion').optional().trim().isLength({ min: 5, max: 150 }).withMessage('Dirección entre 5 y 150 caracteres'),
  body('telefono').optional().trim().matches(/^[0-9]{7,10}$/).withMessage('Teléfono entre 7 y 10 dígitos'),
];

export async function listarEstudiantes(req: Request, res: Response): Promise<void> {
  const { gradoId, estado, busqueda, pagina = '1', limite = '20' } = req.query;
  try {
    const skip = (parseInt(pagina as string) - 1) * parseInt(limite as string);
    const take = parseInt(limite as string);
    const where: Record<string, unknown> = {};
    if (gradoId) where.gradoId = gradoId;
    if (estado) where.estado = estado;
    if (busqueda) {
      where.OR = [
        { nombres: { contains: busqueda as string, mode: 'insensitive' } },
        { apellidos: { contains: busqueda as string, mode: 'insensitive' } },
        { numeroDocumento: { contains: busqueda as string } },
      ];
    }
    const [estudiantes, total] = await Promise.all([
      prisma.estudiante.findMany({ where, include: { grado: true }, orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }], skip, take }),
      prisma.estudiante.count({ where }),
    ]);
    res.json({ ok: true, datos: estudiantes, meta: { pagina: parseInt(pagina as string), limite: take, total, totalPaginas: Math.ceil(total / take) } });
  } catch (err) {
    logger.error('Error al listar estudiantes', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function obtenerEstudiante(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const estudiante = await prisma.estudiante.findUnique({ where: { id }, include: { grado: true, padres: { include: { padre: true } } } });
    if (!estudiante) { res.status(404).json({ ok: false, mensaje: 'Estudiante no encontrado' }); return; }
    res.json({ ok: true, datos: estudiante });
  } catch (err) {
    logger.error('Error al obtener estudiante', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function crearEstudiante(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) { res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) }); return; }
  const { nombres, apellidos, tipoDocumento, numeroDocumento, fechaNacimiento, genero, gradoId, direccion, telefono } = req.body;
  try {
    const existe = await prisma.estudiante.findUnique({ where: { numeroDocumento } });
    if (existe) { res.status(409).json({ ok: false, mensaje: 'Ya existe un estudiante con ese número de documento' }); return; }
    const estudiante = await prisma.estudiante.create({
      data: { nombres: nombres.trim(), apellidos: apellidos.trim(), tipoDocumento, numeroDocumento: numeroDocumento.trim(), fechaNacimiento: new Date(fechaNacimiento), genero, gradoId, direccion: direccion?.trim(), telefono: telefono?.trim(), estado: 'ACTIVO' },
      include: { grado: true },
    });
    await audit({ usuarioId: req.usuario!.sub, accion: 'CREAR', entidad: 'estudiantes', entidadId: estudiante.id, datosDespues: { nombres, apellidos, numeroDocumento, gradoId }, ip: req.ip });
    res.status(201).json({ ok: true, datos: estudiante });
  } catch (err) {
    logger.error('Error al crear estudiante', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function editarEstudiante(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) { res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) }); return; }
  const { id } = req.params;
  const { nombres, apellidos, tipoDocumento, numeroDocumento, fechaNacimiento, genero, gradoId, direccion, telefono, estado } = req.body;
  try {
    const anterior = await prisma.estudiante.findUnique({ where: { id } });
    if (!anterior) { res.status(404).json({ ok: false, mensaje: 'Estudiante no encontrado' }); return; }
    if (numeroDocumento && numeroDocumento !== anterior.numeroDocumento) {
      const existe = await prisma.estudiante.findFirst({ where: { numeroDocumento, id: { not: id } } });
      if (existe) { res.status(409).json({ ok: false, mensaje: 'Ya existe un estudiante con ese número de documento' }); return; }
    }
    const estudiante = await prisma.estudiante.update({
      where: { id },
      data: { nombres: nombres?.trim(), apellidos: apellidos?.trim(), tipoDocumento, numeroDocumento: numeroDocumento?.trim(), fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : undefined, genero, gradoId, direccion: direccion?.trim(), telefono: telefono?.trim(), estado },
      include: { grado: true },
    });
    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'estudiantes', entidadId: id, datosAntes: anterior, datosDespues: estudiante, ip: req.ip });
    res.json({ ok: true, datos: estudiante });
  } catch (err) {
    logger.error('Error al editar estudiante', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function cambiarEstadoEstudiante(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { estado } = req.body;
  if (!Object.values(EstadoEstudiante).includes(estado)) { res.status(400).json({ ok: false, mensaje: 'Estado inválido' }); return; }
  try {
    const estudiante = await prisma.estudiante.update({ where: { id }, data: { estado } });
    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'estudiantes', entidadId: id, datosDespues: { estado }, ip: req.ip });
    res.json({ ok: true, datos: estudiante });
  } catch (err) {
    logger.error('Error al cambiar estado', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── AGREGAR ESTA FUNCIÓN A estudiantes.controller.ts ────────────────────────
// (Importar PrismaClient y demás ya están en el archivo existente)

// Ficha completa: datos + padres vinculados + resumen de boletín + observaciones
export async function obtenerFichaCompleta(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const estudiante = await prisma.estudiante.findUnique({
      where: { id },
      include: {
        grado: true,
        padres: {
          include: { padre: { select: { id: true, nombres: true, apellidos: true, numeroDocumento: true, telefono: true, usuario: { select: { email: true } } } } },
        },
      },
    });

    if (!estudiante) {
      res.status(404).json({ ok: false, mensaje: 'Estudiante no encontrado' });
      return;
    }

    // Período activo (o el más reciente si no hay uno activo)
    const periodoActivo = await prisma.periodo.findFirst({ where: { activo: true } })
      ?? await prisma.periodo.findFirst({ orderBy: { fechaInicio: 'desc' } });

    // Observaciones (últimas 10, con info de si fueron vistas)
    const observaciones = await prisma.observacion.findMany({
      where: { estudianteId: id },
      include: {
        profesor: { select: { nombres: true, apellidos: true } },
        vistas: true,
      },
      orderBy: { fecha: 'desc' },
      take: 10,
    });

    res.json({
      ok: true,
      datos: {
        estudiante,
        padres: estudiante.padres.map(p => ({
          parentesco: p.parentesco,
          esPrincipal: p.esPrincipal,
          ...p.padre,
        })),
        periodoActivo,
        observaciones: observaciones.map(o => ({
          id: o.id,
          tipo: o.tipo,
          descripcion: o.descripcion,
          fecha: o.fecha,
          profesor: o.profesor,
          yaVista: o.vistas.length > 0,
        })),
      },
    });
  } catch (err) {
    logger.error('Error al obtener ficha completa del estudiante', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}