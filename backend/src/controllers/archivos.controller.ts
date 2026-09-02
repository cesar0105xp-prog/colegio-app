import { Request, Response } from 'express';
import { PrismaClient, TipoDocumentoArchivo } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { audit } from '../utils/audit';
import { logger } from '../utils/logger';
import { recomputarProgresoDocumentos } from './matriculas.controller';

const prisma = new PrismaClient();

// ─── SUBIR ARCHIVO ───────────────────────────────────────────────────────────

export async function subirArchivo(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ ok: false, mensaje: 'No se recibió ningún archivo PDF' });
    return;
  }

  const { estudianteId, tipo, descripcion, visibleParaPadre, tipoDocumentoId } = req.body;

  // Validar tipo de documento
  if (!Object.values(TipoDocumentoArchivo).includes(tipo)) {
    // Eliminar archivo subido si la validación falla
    fs.unlinkSync(req.file.path);
    res.status(400).json({ ok: false, mensaje: 'Tipo de documento inválido' });
    return;
  }

  if (descripcion && String(descripcion).length > 300) {
    fs.unlinkSync(req.file.path);
    res.status(400).json({ ok: false, mensaje: 'Descripción máximo 300 caracteres' });
    return;
  }

  try {
    let subidoPorPadreId: string | undefined;

    // Si es padre, verificar que es hijo suyo
    if (req.usuario!.rol === 'PADRE') {
      const padre = await prisma.padre.findUnique({ where: { usuarioId: req.usuario!.sub } });
      if (!padre) {
        fs.unlinkSync(req.file.path);
        res.status(403).json({ ok: false, mensaje: 'Perfil de padre no encontrado' });
        return;
      }

      const esHijo = await prisma.padreEstudiante.findFirst({
        where: { padreId: padre.id, estudianteId },
      });

      if (!esHijo) {
        fs.unlinkSync(req.file.path);
        res.status(403).json({ ok: false, mensaje: 'No puedes subir archivos para este estudiante' });
        return;
      }

      subidoPorPadreId = padre.id;
    }

    const archivo = await prisma.archivo.create({
      data: {
        estudianteId: estudianteId || undefined,
        subidoPorPadreId,
        tipo,
        nombreOriginal: req.file.originalname,
        nombreArchivo: req.file.filename,
        ruta: req.file.path,
        mimeType: req.file.mimetype,
        tamanoBytes: req.file.size,
        descripcion: descripcion?.trim(),
        tipoDocumentoId: tipoDocumentoId || null,
        visibleParaPadre: req.usuario!.rol === 'PADRE' ? true : (visibleParaPadre === 'true' || visibleParaPadre === true),
      },
    });

    await audit({
      usuarioId: req.usuario!.sub,
      accion: 'SUBIR_ARCHIVO',
      entidad: 'archivos',
      entidadId: archivo.id,
      datosDespues: { nombreOriginal: archivo.nombreOriginal, tipo, estudianteId },
      ip: req.ip,
    });

    if (estudianteId && archivo.tipoDocumentoId) {
      await recomputarProgresoDocumentos(estudianteId);
    }

    res.status(201).json({
      ok: true,
      datos: {
        id: archivo.id,
        nombreOriginal: archivo.nombreOriginal,
        tipo: archivo.tipo,
        tamanoBytes: archivo.tamanoBytes,
        createdAt: archivo.createdAt,
      },
    });
  } catch (err) {
    // Limpiar archivo si falló el guardado en BD
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    logger.error('Error al subir archivo', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── DESCARGAR ARCHIVO ───────────────────────────────────────────────────────

export async function descargarArchivo(req: Request, res: Response): Promise<void> {
  const { archivoId } = req.params;

  try {
    const archivo = await prisma.archivo.findUnique({ where: { id: archivoId } });

    if (!archivo) {
      res.status(404).json({ ok: false, mensaje: 'Archivo no encontrado' });
      return;
    }

    // Verificar acceso si es padre
    if (req.usuario!.rol === 'PADRE') {
      if (!archivo.visibleParaPadre) {
        res.status(403).json({ ok: false, mensaje: 'No tienes acceso a este archivo' });
        return;
      }

      const padre = await prisma.padre.findUnique({ where: { usuarioId: req.usuario!.sub } });
      if (archivo.estudianteId) {
        const esHijo = await prisma.padreEstudiante.findFirst({
          where: { padreId: padre!.id, estudianteId: archivo.estudianteId },
        });
        if (!esHijo) {
          res.status(403).json({ ok: false, mensaje: 'No tienes acceso a este archivo' });
          return;
        }
      }
    }

    // Verificar acceso si es estudiante
    if (req.usuario!.rol === 'ESTUDIANTE') {
      const estudiante = await prisma.estudiante.findUnique({ where: { usuarioId: req.usuario!.sub } });
      if (!estudiante || archivo.estudianteId !== estudiante.id) {
        res.status(403).json({ ok: false, mensaje: 'No tienes acceso a este archivo' });
        return;
      }
    }

    const rutaAbsoluta = path.resolve(archivo.ruta);

    if (!fs.existsSync(rutaAbsoluta)) {
      res.status(404).json({ ok: false, mensaje: 'Archivo no disponible en el servidor' });
      return;
    }

    await audit({
      usuarioId: req.usuario!.sub,
      accion: 'DESCARGAR_ARCHIVO',
      entidad: 'archivos',
      entidadId: archivoId,
      ip: req.ip,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${archivo.nombreOriginal}"`);
    res.sendFile(rutaAbsoluta);
  } catch (err) {
    logger.error('Error al descargar archivo', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── LISTAR ARCHIVOS DE UN ESTUDIANTE ────────────────────────────────────────

export async function listarArchivos(req: Request, res: Response): Promise<void> {
  const { estudianteId } = req.params;

  try {
    const esPadreOEstudiante = ['PADRE', 'ESTUDIANTE'].includes(req.usuario!.rol);

    const archivos = await prisma.archivo.findMany({
      where: {
        estudianteId,
        // Padres y estudiantes solo ven archivos marcados como visibles
        visibleParaPadre: esPadreOEstudiante ? true : undefined,
      },
      select: {
        id: true,
        nombreOriginal: true,
        tipo: true,
        descripcion: true,
        tamanoBytes: true,
        visibleParaPadre: true,
        tipoDocumentoId: true,
        tipoDocumento: { select: { id: true, nombre: true, obligatorio: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ ok: true, datos: archivos });
  } catch (err) {
    logger.error('Error al listar archivos', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}