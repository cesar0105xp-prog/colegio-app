import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { body, query, validationResult } from 'express-validator';
import { calcularPeriodos } from '../utils/periodos.util';
import { audit } from '../utils/audit';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function esFechaValida(valor: string): boolean {
  if (!FECHA_REGEX.test(valor)) return false;
  const [y, m, d] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d));
  return fecha.getUTCFullYear() === y && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d;
}

function parseFechaUTC(valor: string): Date {
  const [y, m, d] = valor.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// ─── VALIDACIONES ─────────────────────────────────────────────────────────────

export const validarPreview = [
  query('anio').isInt({ min: 2020, max: 2099 }).withMessage('Año inválido'),
  query('inicio').custom(esFechaValida).withMessage('Fecha de inicio inválida (formato YYYY-MM-DD)'),
  query('fin').custom(esFechaValida).withMessage('Fecha de fin inválida (formato YYYY-MM-DD)'),
];

export const validarConfirmar = [
  body('anio').isInt({ min: 2020, max: 2099 }).withMessage('Año inválido'),
  body('fechaInicio').custom(esFechaValida).withMessage('Fecha de inicio inválida (formato YYYY-MM-DD)'),
  body('fechaFin').custom(esFechaValida).withMessage('Fecha de fin inválida (formato YYYY-MM-DD)'),
];

function validarRango(anio: number, fechaInicio: Date, fechaFin: Date): string | null {
  if (fechaInicio.getUTCFullYear() !== anio) return 'La fecha de inicio debe pertenecer al año indicado';
  if (fechaFin.getTime() <= fechaInicio.getTime()) return 'La fecha de fin debe ser posterior a la fecha de inicio';
  return null;
}

// ─── PREVIEW (no guarda en BD) ─────────────────────────────────────────────────

export async function previewPeriodos(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) { res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) }); return; }

  const anio = parseInt(req.query.anio as string);
  const fechaInicio = parseFechaUTC(req.query.inicio as string);
  const fechaFin = parseFechaUTC(req.query.fin as string);

  const errorRango = validarRango(anio, fechaInicio, fechaFin);
  if (errorRango) { res.status(400).json({ ok: false, mensaje: errorRango }); return; }

  try {
    const periodos = calcularPeriodos(fechaInicio, fechaFin);
    res.json({ ok: true, datos: { anio, fechaInicio, fechaFin, periodos } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al calcular los períodos';
    res.status(400).json({ ok: false, mensaje: msg });
  }
}

// ─── CONFIRMAR (calcula de nuevo en servidor y guarda) ─────────────────────────

export async function confirmarPeriodos(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) { res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) }); return; }

  const anio = parseInt(req.body.anio);
  const fechaInicio = parseFechaUTC(req.body.fechaInicio);
  const fechaFin = parseFechaUTC(req.body.fechaFin);

  const errorRango = validarRango(anio, fechaInicio, fechaFin);
  if (errorRango) { res.status(400).json({ ok: false, mensaje: errorRango }); return; }

  try {
    const existente = await prisma.configuracionAcademica.findUnique({ where: { anio } });
    if (existente) {
      res.status(409).json({ ok: false, mensaje: `Ya existe una configuración académica para el año ${anio}. Ajusta los períodos manualmente si necesitas cambiarlos.` });
      return;
    }

    const periodosCalculados = calcularPeriodos(fechaInicio, fechaFin);

    const resultado = await prisma.$transaction(async (tx) => {
      const config = await tx.configuracionAcademica.create({ data: { anio, fechaInicio, fechaFin } });

      const periodos = [];
      for (const p of periodosCalculados) {
        const periodo = await tx.periodo.create({
          data: {
            nombre: p.nombre,
            numero: p.numero,
            anio,
            fechaInicio: p.fechaInicio,
            fechaFin: p.fechaFin,
            peso: p.peso,
            configId: config.id,
            activo: false,
          },
        });
        periodos.push(periodo);
      }

      return { config, periodos };
    });

    await audit({
      usuarioId: req.usuario!.sub, accion: 'CREAR', entidad: 'configuraciones_academicas', entidadId: resultado.config.id,
      datosDespues: { anio, cantidad: resultado.periodos.length }, ip: req.ip,
    });

    res.status(201).json({ ok: true, mensaje: `Se generaron ${resultado.periodos.length} períodos para el año ${anio}`, datos: resultado });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      res.status(409).json({ ok: false, mensaje: 'Ya existe una configuración académica o período para ese año' });
      return;
    }
    if (err instanceof Error && err.message.startsWith('El rango')) {
      res.status(400).json({ ok: false, mensaje: err.message });
      return;
    }
    logger.error('Error al confirmar períodos académicos', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── LISTAR CONFIGURACIONES GUARDADAS ──────────────────────────────────────────

export async function listarConfiguraciones(_req: Request, res: Response): Promise<void> {
  try {
    const configuraciones = await prisma.configuracionAcademica.findMany({
      include: { periodos: { orderBy: { numero: 'asc' } } },
      orderBy: { anio: 'desc' },
    });
    res.json({ ok: true, datos: configuraciones });
  } catch (err) {
    logger.error('Error al listar configuraciones académicas', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}
