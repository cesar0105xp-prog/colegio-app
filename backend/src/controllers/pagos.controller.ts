import { Request, Response } from 'express';
import { PrismaClient, MetodoPago } from '@prisma/client';
import { body, param, validationResult } from 'express-validator';
import { audit } from '../utils/audit';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ESTADOS_PAGO = ['PENDIENTE', 'PAGADO', 'EXONERADO'];

// ─── VALIDACIONES ─────────────────────────────────────────────────────────────

export const validarConceptoPago = [
  body('nombre').trim().notEmpty().withMessage('El nombre es requerido')
    .isLength({ min: 2, max: 100 }).withMessage('Nombre entre 2 y 100 caracteres'),
  body('descripcion').optional({ checkFalsy: true }).trim()
    .isLength({ max: 300 }).withMessage('Descripción máximo 300 caracteres'),
  body('monto').isFloat({ min: 0.01, max: 9999999.99 }).withMessage('El monto debe ser mayor a 0 y no superar 9.999.999,99'),
];

export const validarConceptoPagoEditar = [
  param('id').isUUID().withMessage('ID inválido'),
  ...validarConceptoPago,
];

export const validarIdConcepto = [param('id').isUUID().withMessage('ID inválido')];

export const validarCobro = [
  body('estudianteId').isUUID().withMessage('Estudiante inválido'),
  body('conceptoId').isUUID().withMessage('Concepto inválido'),
  body('anio').isInt({ min: 2020, max: 2030 }).withMessage('El año debe estar entre 2020 y 2030'),
  body('mes').isInt({ min: 1, max: 12 }).withMessage('El mes debe estar entre 1 y 12'),
  body('montoCobrado').optional().isFloat({ min: 0.01, max: 9999999.99 }).withMessage('El monto debe ser mayor a 0 y no superar 9.999.999,99'),
  body('observaciones').optional({ checkFalsy: true }).trim().isLength({ max: 500 }).withMessage('Observaciones máximo 500 caracteres'),
];

export const validarCobroMasivo = [
  body('gradoId').isUUID().withMessage('Grado inválido'),
  body('conceptoId').isUUID().withMessage('Concepto inválido'),
  body('anio').isInt({ min: 2020, max: 2030 }).withMessage('El año debe estar entre 2020 y 2030'),
  body('mes').isInt({ min: 1, max: 12 }).withMessage('El mes debe estar entre 1 y 12'),
  body('montoCobrado').optional().isFloat({ min: 0.01, max: 9999999.99 }).withMessage('El monto debe ser mayor a 0 y no superar 9.999.999,99'),
];

export const validarMarcarPagado = [
  param('id').isUUID().withMessage('ID inválido'),
  body('metodoPago').isIn(Object.values(MetodoPago)).withMessage('Método de pago inválido'),
  body('fechaPago').optional({ checkFalsy: true }).isISO8601().withMessage('Fecha de pago inválida'),
];

export const validarExonerar = [
  param('id').isUUID().withMessage('ID inválido'),
  body('observaciones').optional({ checkFalsy: true }).trim().isLength({ max: 500 }).withMessage('Observaciones máximo 500 caracteres'),
];

// ─── CONCEPTOS DE PAGO ─────────────────────────────────────────────────────────

export async function listarConceptos(req: Request, res: Response): Promise<void> {
  const { activo } = req.query;
  try {
    const conceptos = await prisma.conceptoPago.findMany({
      where: activo !== undefined ? { activo: activo === 'true' } : undefined,
      orderBy: { nombre: 'asc' },
    });
    res.json({ ok: true, datos: conceptos });
  } catch (err) {
    logger.error('Error al listar conceptos de pago', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function crearConcepto(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) { res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) }); return; }

  const { nombre, descripcion, monto } = req.body;
  try {
    const concepto = await prisma.conceptoPago.create({
      data: { nombre: nombre.trim(), descripcion: descripcion?.trim() || null, monto },
    });

    await audit({
      usuarioId: req.usuario!.sub, accion: 'CREAR', entidad: 'conceptos_pago', entidadId: concepto.id,
      datosDespues: { nombre: concepto.nombre, monto: concepto.monto.toString() }, ip: req.ip,
    });

    res.status(201).json({ ok: true, mensaje: 'Concepto de pago creado correctamente', datos: concepto });
  } catch (err) {
    logger.error('Error al crear concepto de pago', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function editarConcepto(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) { res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) }); return; }

  const { id } = req.params;
  const { nombre, descripcion, monto } = req.body;
  try {
    const existente = await prisma.conceptoPago.findUnique({ where: { id } });
    if (!existente) { res.status(404).json({ ok: false, mensaje: 'Concepto de pago no encontrado' }); return; }

    const concepto = await prisma.conceptoPago.update({
      where: { id },
      data: { nombre: nombre.trim(), descripcion: descripcion?.trim() || null, monto },
    });

    await audit({
      usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'conceptos_pago', entidadId: id,
      datosDespues: { nombre: concepto.nombre, monto: concepto.monto.toString() }, ip: req.ip,
    });

    res.json({ ok: true, mensaje: 'Concepto de pago actualizado correctamente', datos: concepto });
  } catch (err) {
    logger.error('Error al editar concepto de pago', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function desactivarConcepto(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) { res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) }); return; }

  const { id } = req.params;
  try {
    const existente = await prisma.conceptoPago.findUnique({ where: { id } });
    if (!existente) { res.status(404).json({ ok: false, mensaje: 'Concepto de pago no encontrado' }); return; }

    await prisma.conceptoPago.update({ where: { id }, data: { activo: false } });

    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'conceptos_pago', entidadId: id, datosDespues: { activo: false }, ip: req.ip });
    res.json({ ok: true, mensaje: 'Concepto de pago desactivado correctamente' });
  } catch (err) {
    logger.error('Error al desactivar concepto de pago', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── COBROS ────────────────────────────────────────────────────────────────────

export async function listarCobros(req: Request, res: Response): Promise<void> {
  const { gradoId, mes, anio, estado, busqueda, pagina = '1', limite = '20' } = req.query;
  try {
    const paginaNum = Math.max(1, parseInt(pagina as string) || 1);
    const limiteNum = Math.min(100, Math.max(1, parseInt(limite as string) || 20));
    const skip = (paginaNum - 1) * limiteNum;

    const filtroEstudiante: Record<string, unknown> = {};
    if (gradoId && UUID_REGEX.test(gradoId as string)) filtroEstudiante.gradoId = gradoId as string;
    if (busqueda) {
      filtroEstudiante.OR = [
        { nombres: { contains: busqueda as string, mode: 'insensitive' } },
        { apellidos: { contains: busqueda as string, mode: 'insensitive' } },
      ];
    }

    const where: Record<string, unknown> = {};
    if (mes) where.mes = parseInt(mes as string);
    if (anio) where.anio = parseInt(anio as string);
    if (estado && ESTADOS_PAGO.includes(estado as string)) where.estadoPago = estado;
    if (Object.keys(filtroEstudiante).length > 0) where.estudiante = filtroEstudiante;

    const [cobros, total] = await Promise.all([
      prisma.cobro.findMany({
        where,
        select: {
          id: true, anio: true, mes: true, montoCobrado: true, estadoPago: true,
          fechaPago: true, metodoPago: true, observaciones: true, createdAt: true,
          estudiante: { select: { id: true, nombres: true, apellidos: true, grado: { select: { id: true, nombre: true, grupo: true } } } },
          concepto: { select: { id: true, nombre: true } },
        },
        orderBy: [{ anio: 'desc' }, { mes: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limiteNum,
      }),
      prisma.cobro.count({ where }),
    ]);

    res.json({ ok: true, datos: cobros, meta: { pagina: paginaNum, limite: limiteNum, total, totalPaginas: Math.ceil(total / limiteNum) } });
  } catch (err) {
    logger.error('Error al listar cobros', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function crearCobro(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) { res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) }); return; }

  const { estudianteId, conceptoId, anio, mes, montoCobrado, observaciones } = req.body;
  try {
    const [estudiante, concepto] = await Promise.all([
      prisma.estudiante.findUnique({ where: { id: estudianteId } }),
      prisma.conceptoPago.findUnique({ where: { id: conceptoId } }),
    ]);
    if (!estudiante) { res.status(404).json({ ok: false, mensaje: 'Estudiante no encontrado' }); return; }
    if (!concepto || !concepto.activo) { res.status(404).json({ ok: false, mensaje: 'Concepto de pago no encontrado o inactivo' }); return; }

    const duplicado = await prisma.cobro.findFirst({ where: { estudianteId, conceptoId, mes: Number(mes), anio: Number(anio) } });
    if (duplicado) { res.status(400).json({ ok: false, mensaje: 'Ya existe un cobro para este estudiante, concepto, mes y año' }); return; }

    const cobro = await prisma.cobro.create({
      data: {
        estudianteId,
        conceptoId,
        anio: Number(anio),
        mes: Number(mes),
        montoCobrado: montoCobrado != null ? montoCobrado : concepto.monto,
        observaciones: observaciones?.trim() || null,
        registradoPor: req.usuario!.sub,
      },
    });

    await audit({ usuarioId: req.usuario!.sub, accion: 'CREAR', entidad: 'cobros', entidadId: cobro.id, datosDespues: { estudianteId, conceptoId, mes, anio }, ip: req.ip });
    res.status(201).json({ ok: true, mensaje: 'Cobro registrado correctamente', datos: cobro });
  } catch (err) {
    logger.error('Error al crear cobro', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function generarCobrosMasivo(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) { res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) }); return; }

  const { gradoId, conceptoId, anio, mes, montoCobrado } = req.body;
  try {
    const [grado, concepto] = await Promise.all([
      prisma.grado.findUnique({ where: { id: gradoId } }),
      prisma.conceptoPago.findUnique({ where: { id: conceptoId } }),
    ]);
    if (!grado) { res.status(404).json({ ok: false, mensaje: 'Grado no encontrado' }); return; }
    if (!concepto || !concepto.activo) { res.status(404).json({ ok: false, mensaje: 'Concepto de pago no encontrado o inactivo' }); return; }

    const estudiantes = await prisma.estudiante.findMany({ where: { gradoId, estado: 'ACTIVO' }, select: { id: true } });
    if (estudiantes.length === 0) { res.status(400).json({ ok: false, mensaje: 'No hay estudiantes activos en este grado' }); return; }

    const existentes = await prisma.cobro.findMany({
      where: { conceptoId, mes: Number(mes), anio: Number(anio), estudianteId: { in: estudiantes.map(e => e.id) } },
      select: { estudianteId: true },
    });
    const yaTienenCobro = new Set(existentes.map(e => e.estudianteId));
    const pendientes = estudiantes.filter(e => !yaTienenCobro.has(e.id));

    if (pendientes.length === 0) {
      res.json({ ok: true, mensaje: 'Todos los estudiantes del grado ya tienen este cobro generado', datos: { creados: 0, omitidos: estudiantes.length } });
      return;
    }

    const monto = montoCobrado != null ? montoCobrado : concepto.monto;
    await prisma.$transaction(
      pendientes.map(e => prisma.cobro.create({
        data: {
          estudianteId: e.id,
          conceptoId,
          anio: Number(anio),
          mes: Number(mes),
          montoCobrado: monto,
          registradoPor: req.usuario!.sub,
        },
      }))
    );

    await audit({
      usuarioId: req.usuario!.sub, accion: 'CREAR', entidad: 'cobros',
      datosDespues: { gradoId, conceptoId, mes, anio, cantidad: pendientes.length }, ip: req.ip,
    });

    res.status(201).json({
      ok: true,
      mensaje: `Se generaron ${pendientes.length} cobro(s) correctamente`,
      datos: { creados: pendientes.length, omitidos: yaTienenCobro.size },
    });
  } catch (err) {
    logger.error('Error al generar cobros masivos', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function marcarPagado(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) { res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) }); return; }

  const { id } = req.params;
  const { metodoPago, fechaPago } = req.body;
  try {
    const cobro = await prisma.cobro.findUnique({ where: { id } });
    if (!cobro) { res.status(404).json({ ok: false, mensaje: 'Cobro no encontrado' }); return; }
    if (cobro.estadoPago !== 'PENDIENTE') { res.status(400).json({ ok: false, mensaje: 'Este cobro ya fue procesado (pagado o exonerado)' }); return; }

    const actualizado = await prisma.cobro.update({
      where: { id },
      data: { estadoPago: 'PAGADO', metodoPago, fechaPago: fechaPago ? new Date(fechaPago) : new Date() },
    });

    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'cobros', entidadId: id, datosDespues: { estadoPago: 'PAGADO', metodoPago }, ip: req.ip });
    res.json({ ok: true, mensaje: 'Cobro marcado como pagado', datos: actualizado });
  } catch (err) {
    logger.error('Error al marcar cobro como pagado', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function exonerarCobro(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) { res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) }); return; }

  const { id } = req.params;
  const { observaciones } = req.body;
  try {
    const cobro = await prisma.cobro.findUnique({ where: { id } });
    if (!cobro) { res.status(404).json({ ok: false, mensaje: 'Cobro no encontrado' }); return; }
    if (cobro.estadoPago === 'PAGADO') { res.status(400).json({ ok: false, mensaje: 'No se puede exonerar un cobro que ya fue pagado' }); return; }

    const actualizado = await prisma.cobro.update({
      where: { id },
      data: { estadoPago: 'EXONERADO', observaciones: observaciones?.trim() || cobro.observaciones },
    });

    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'cobros', entidadId: id, datosDespues: { estadoPago: 'EXONERADO' }, ip: req.ip });
    res.json({ ok: true, mensaje: 'Cobro exonerado correctamente', datos: actualizado });
  } catch (err) {
    logger.error('Error al exonerar cobro', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── REPORTE DE CARTERA ─────────────────────────────────────────────────────────

export async function reporteCartera(req: Request, res: Response): Promise<void> {
  const { gradoId, mes, anio } = req.query;
  try {
    const filtroEstudiante: Record<string, unknown> = {};
    if (gradoId && UUID_REGEX.test(gradoId as string)) filtroEstudiante.gradoId = gradoId as string;

    const where: Record<string, unknown> = {};
    if (mes) where.mes = parseInt(mes as string);
    if (anio) where.anio = parseInt(anio as string);
    if (Object.keys(filtroEstudiante).length > 0) where.estudiante = filtroEstudiante;

    const cobros = await prisma.cobro.findMany({
      where,
      select: {
        montoCobrado: true,
        estadoPago: true,
        estudiante: { select: { gradoId: true, grado: { select: { nombre: true, grupo: true } } } },
      },
    });

    type ResumenGrado = { gradoId: string; nombre: string; totalCobrado: number; totalPagado: number; totalPendiente: number; totalExonerado: number; cantidadCobros: number };
    const porGrado = new Map<string, ResumenGrado>();

    for (const c of cobros) {
      const key = c.estudiante.gradoId;
      if (!porGrado.has(key)) {
        porGrado.set(key, {
          gradoId: key,
          nombre: `${c.estudiante.grado.nombre}${c.estudiante.grado.grupo}`,
          totalCobrado: 0, totalPagado: 0, totalPendiente: 0, totalExonerado: 0, cantidadCobros: 0,
        });
      }
      const item = porGrado.get(key)!;
      const monto = Number(c.montoCobrado);
      item.totalCobrado += monto;
      item.cantidadCobros += 1;
      if (c.estadoPago === 'PAGADO') item.totalPagado += monto;
      else if (c.estadoPago === 'PENDIENTE') item.totalPendiente += monto;
      else if (c.estadoPago === 'EXONERADO') item.totalExonerado += monto;
    }

    res.json({ ok: true, datos: Array.from(porGrado.values()).sort((a, b) => a.nombre.localeCompare(b.nombre)) });
  } catch (err) {
    logger.error('Error al generar reporte de cartera', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function exportarCarteraCSV(req: Request, res: Response): Promise<void> {
  const { gradoId, mes, anio, estado } = req.query;
  try {
    const filtroEstudiante: Record<string, unknown> = {};
    if (gradoId && UUID_REGEX.test(gradoId as string)) filtroEstudiante.gradoId = gradoId as string;

    const where: Record<string, unknown> = {};
    if (mes) where.mes = parseInt(mes as string);
    if (anio) where.anio = parseInt(anio as string);
    if (estado && ESTADOS_PAGO.includes(estado as string)) where.estadoPago = estado;
    if (Object.keys(filtroEstudiante).length > 0) where.estudiante = filtroEstudiante;

    const cobros = await prisma.cobro.findMany({
      where,
      select: {
        anio: true, mes: true, montoCobrado: true, estadoPago: true, fechaPago: true, metodoPago: true,
        estudiante: { select: { nombres: true, apellidos: true, numeroDocumento: true, grado: { select: { nombre: true, grupo: true } } } },
        concepto: { select: { nombre: true } },
      },
      orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
    });

    const escapar = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const filas = [
      ['Estudiante', 'Documento', 'Grado', 'Concepto', 'Mes', 'Año', 'Monto', 'Estado', 'Fecha pago', 'Método pago'].join(','),
      ...cobros.map(c => [
        escapar(`${c.estudiante.nombres} ${c.estudiante.apellidos}`),
        c.estudiante.numeroDocumento,
        escapar(`${c.estudiante.grado.nombre}${c.estudiante.grado.grupo}`),
        escapar(c.concepto.nombre),
        c.mes,
        c.anio,
        c.montoCobrado.toString(),
        c.estadoPago,
        c.fechaPago ? c.fechaPago.toISOString().split('T')[0] : '',
        c.metodoPago ?? '',
      ].join(',')),
    ];

    await audit({ usuarioId: req.usuario!.sub, accion: 'DESCARGAR_ARCHIVO', entidad: 'cobros', ip: req.ip });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="cartera.csv"');
    res.send('﻿' + filas.join('\n'));
  } catch (err) {
    logger.error('Error al exportar cartera', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── ESTADO DE CUENTA DEL PADRE ─────────────────────────────────────────────────

export async function miEstadoCuenta(req: Request, res: Response): Promise<void> {
  const { estudianteId } = req.query;
  try {
    const padre = await prisma.padre.findUnique({ where: { usuarioId: req.usuario!.sub } });
    if (!padre) { res.status(403).json({ ok: false, mensaje: 'Perfil de padre no encontrado' }); return; }

    let estudianteFinal = estudianteId as string | undefined;

    if (estudianteFinal) {
      if (!UUID_REGEX.test(estudianteFinal)) { res.status(400).json({ ok: false, mensaje: 'Estudiante inválido' }); return; }
      const vinculo = await prisma.padreEstudiante.findFirst({ where: { padreId: padre.id, estudianteId: estudianteFinal } });
      if (!vinculo) { res.status(403).json({ ok: false, mensaje: 'No tienes acceso a la información de este estudiante' }); return; }
    } else {
      const primerHijo = await prisma.padreEstudiante.findFirst({ where: { padreId: padre.id }, orderBy: { createdAt: 'asc' } });
      if (!primerHijo) { res.status(404).json({ ok: false, mensaje: 'No tienes estudiantes vinculados' }); return; }
      estudianteFinal = primerHijo.estudianteId;
    }

    const cobros = await prisma.cobro.findMany({
      where: { estudianteId: estudianteFinal },
      select: {
        id: true, anio: true, mes: true, montoCobrado: true, estadoPago: true, fechaPago: true, metodoPago: true,
        concepto: { select: { nombre: true } },
      },
      orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
    });

    const saldoPendiente = cobros.filter(c => c.estadoPago === 'PENDIENTE').reduce((acc, c) => acc + Number(c.montoCobrado), 0);
    const totalPagado = cobros.filter(c => c.estadoPago === 'PAGADO').reduce((acc, c) => acc + Number(c.montoCobrado), 0);

    res.json({ ok: true, datos: { estudianteId: estudianteFinal, saldoPendiente, totalPagado, cobros } });
  } catch (err) {
    logger.error('Error al obtener estado de cuenta', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}
