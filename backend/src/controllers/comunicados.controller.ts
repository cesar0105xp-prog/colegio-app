import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import { enviarCorreo, plantillaComunicado } from '../services/correo.service';
import { audit } from '../utils/audit';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export const validarComunicado = [
  body('titulo').trim().notEmpty().withMessage('El título es requerido').isLength({ max: 150 }).withMessage('Máximo 150 caracteres'),
  body('mensaje').trim().notEmpty().withMessage('El mensaje es requerido').isLength({ min: 10, max: 2000 }).withMessage('Entre 10 y 2000 caracteres'),
  body('destinatario').isIn(['TODOS', 'GRADO']).withMessage('Destinatario inválido'),
  body('gradoId').optional().isUUID().withMessage('Grado inválido'),
];

// ─── ENVIAR COMUNICADO ────────────────────────────────────────────────────────
export async function enviarComunicado(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) });
    return;
  }

  const { titulo, mensaje, destinatario, gradoId } = req.body;

  try {
    // Obtener correos de los padres según destinatario
    let correos: string[] = [];

    if (destinatario === 'TODOS') {
      const padres = await prisma.padre.findMany({
        include: { usuario: { select: { email: true, estado: true } } },
      });
      correos = padres.filter(p => p.usuario.estado === 'ACTIVO').map(p => p.usuario.email);
    } else if (destinatario === 'GRADO' && gradoId) {
      const vinculos = await prisma.padreEstudiante.findMany({
        where: { estudiante: { gradoId } },
        include: { padre: { include: { usuario: { select: { email: true, estado: true } } } } },
      });
      // Eliminar duplicados (un padre puede tener más de un hijo en el grado)
      const emailsUnicos = new Set(
        vinculos.filter(v => v.padre.usuario.estado === 'ACTIVO').map(v => v.padre.usuario.email)
      );
      correos = Array.from(emailsUnicos);
    }

    if (correos.length === 0) {
      res.status(404).json({ ok: false, mensaje: 'No hay destinatarios para enviar el comunicado' });
      return;
    }

    // Guardar comunicado en BD
    const comunicado = await prisma.comunicado.create({
      data: {
        titulo: titulo.trim(),
        mensaje: mensaje.trim(),
        destinatario,
        gradoId: gradoId ?? null,
        creadoPorId: req.usuario!.sub,
        totalEnviados: correos.length,
      },
    });

    // Enviar correos en segundo plano (no bloqueamos la respuesta)
    const html = plantillaComunicado(titulo, mensaje);
    enviarCorreo({ para: correos, asunto: titulo, html })
      .then(ok => {
        if (!ok) logger.error('Error al enviar correos del comunicado', { comunicadoId: comunicado.id });
        else logger.info(`Comunicado enviado a ${correos.length} destinatarios`, { comunicadoId: comunicado.id });
      });

    await audit({
      usuarioId: req.usuario!.sub,
      accion: 'CREAR',
      entidad: 'comunicados',
      entidadId: comunicado.id,
      datosDespues: { titulo, destinatario, totalEnviados: correos.length },
      ip: req.ip,
    });

    res.status(201).json({
      ok: true,
      mensaje: `Comunicado enviado a ${correos.length} padre(s)`,
      datos: comunicado,
    });
  } catch (err) {
    logger.error('Error al enviar comunicado', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── LISTAR COMUNICADOS ───────────────────────────────────────────────────────
export async function listarComunicados(req: Request, res: Response): Promise<void> {
  const { pagina = '1', limite = '20' } = req.query;
  try {
    const skip = (parseInt(pagina as string) - 1) * parseInt(limite as string);
    const take = parseInt(limite as string);

    const [comunicados, total] = await Promise.all([
      prisma.comunicado.findMany({
        include: { creadoPor: { select: { email: true } }, grado: { select: { nombre: true, grupo: true } } },
        orderBy: { createdAt: 'desc' },
        skip, take,
      }),
      prisma.comunicado.count(),
    ]);

    res.json({ ok: true, datos: comunicados, meta: { total, pagina: parseInt(pagina as string), limite: take } });
  } catch (err) {
    logger.error('Error al listar comunicados', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── ARCHIVAR COMUNICADO ─────────────────────────────────────────────────────
export async function archivarComunicado(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const comunicado = await prisma.comunicado.findUnique({ where: { id } });
    if (!comunicado) { res.status(404).json({ ok: false, mensaje: 'Comunicado no encontrado' }); return; }

    const actualizado = await prisma.comunicado.update({
      where: { id },
      data: { archivado: !comunicado.archivado },
    });

    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'comunicados', entidadId: id, datosDespues: { archivado: actualizado.archivado }, ip: req.ip });
    res.json({ ok: true, mensaje: actualizado.archivado ? 'Comunicado archivado' : 'Comunicado restaurado', datos: actualizado });
  } catch (err) {
    logger.error('Error al archivar comunicado', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}
export async function comunicadosParaPadre(req: Request, res: Response): Promise<void> {
  try {
    const padre = await prisma.padre.findUnique({ where: { usuarioId: req.usuario!.sub } });
    if (!padre) { res.status(404).json({ ok: false, mensaje: 'Perfil no encontrado' }); return; }

    // Obtener los gradoIds de los hijos del padre
    const vinculos = await prisma.padreEstudiante.findMany({
      where: { padreId: padre.id },
      include: { estudiante: { select: { gradoId: true } } },
    });
    const gradoIds = [...new Set(vinculos.map(v => v.estudiante.gradoId))];

    // Comunicados para todos O para el grado de alguno de sus hijos
    const comunicados = await prisma.comunicado.findMany({
      where: {
        archivado: false,
        OR: [
          { destinatario: 'TODOS' },
          { destinatario: 'GRADO', gradoId: { in: gradoIds } },
        ],
      },
      include: { grado: { select: { nombre: true, grupo: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ ok: true, datos: comunicados });
  } catch (err) {
    logger.error('Error al obtener comunicados del padre', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}