import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// Obtener los hijos vinculados al padre autenticado
export async function misHijos(req: Request, res: Response): Promise<void> {
  try {
    const padre = await prisma.padre.findUnique({
      where: { usuarioId: req.usuario!.sub },
    });
    if (!padre) {
      res.status(404).json({ ok: false, mensaje: 'Perfil de padre no encontrado' });
      return;
    }
    const relaciones = await prisma.padreEstudiante.findMany({
      where: { padreId: padre.id },
      include: {
        estudiante: {
          include: { grado: true },
        },
      },
      orderBy: { esPrincipal: 'desc' },
    });
    const hijos = relaciones.map(r => ({
      ...r.estudiante,
      parentesco: r.parentesco,
      esPrincipal: r.esPrincipal,
    }));
    res.json({ ok: true, datos: hijos });
  } catch (err) {
    logger.error('Error al obtener hijos del padre', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// Vincular un estudiante a un padre
export async function vincularHijo(req: Request, res: Response): Promise<void> {
  const { padreId, estudianteId, parentesco, esPrincipal } = req.body;
  try {
    const vinculo = await prisma.padreEstudiante.upsert({
      where: { padreId_estudianteId: { padreId, estudianteId } },
      update: { parentesco, esPrincipal: esPrincipal ?? false },
      create: { padreId, estudianteId, parentesco, esPrincipal: esPrincipal ?? false },
      include: { estudiante: { include: { grado: true } }, padre: true },
    });
    res.json({ ok: true, datos: vinculo });
  } catch (err) {
    logger.error('Error al vincular hijo', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// Obtener el perfil del estudiante autenticado
export async function miPerfilEstudiante(req: Request, res: Response): Promise<void> {
  try {
    const estudiante = await prisma.estudiante.findUnique({
      where: { usuarioId: req.usuario!.sub },
      include: { grado: true },
    });
    if (!estudiante) {
      res.status(404).json({ ok: false, mensaje: 'Perfil de estudiante no encontrado' });
      return;
    }
    res.json({ ok: true, datos: estudiante });
  } catch (err) {
    logger.error('Error al obtener perfil del estudiante', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}