import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export async function listarAuditoria(req: Request, res: Response): Promise<void> {
  const { accion, entidad, usuarioId, pagina = '1', limite = '30' } = req.query;
  try {
    const skip = (parseInt(pagina as string) - 1) * parseInt(limite as string);
    const take = parseInt(limite as string);

    const where: Record<string, unknown> = {};
    if (accion) where.accion = accion;
    if (entidad) where.entidad = entidad;
    if (usuarioId) where.usuarioId = usuarioId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { usuario: { select: { email: true, rol: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      ok: true,
      datos: logs,
      meta: { pagina: parseInt(pagina as string), limite: take, total, totalPaginas: Math.ceil(total / take) },
    });
  } catch (err) {
    logger.error('Error al listar auditoría', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}