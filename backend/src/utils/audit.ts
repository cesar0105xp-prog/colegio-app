import { PrismaClient, AccionAuditoria } from '@prisma/client';
import { logger } from './logger';

const prisma = new PrismaClient();

interface AuditParams {
  usuarioId?: string;
  accion: AccionAuditoria;
  entidad?: string;
  entidadId?: string;
  datosAntes?: object;
  datosDespues?: object;
  ip?: string;
  userAgent?: string;
}

export async function audit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        usuarioId: params.usuarioId ?? null,
        accion: params.accion,
        entidad: params.entidad ?? null,
        entidadId: params.entidadId ?? null,
        datosAntes: params.datosAntes ?? undefined,
        datosDespues: params.datosDespues ?? undefined,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
      },
    });
  } catch (err) {
    // El log de auditoría nunca debe romper el flujo principal
    logger.error('Error al guardar audit log', { err, params });
  }
}
