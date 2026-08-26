import { Request, Response } from 'express';
import { PrismaClient, TipoCertificado } from '@prisma/client';
import { body, param, validationResult } from 'express-validator';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { audit } from '../utils/audit';
import { logger } from '../utils/logger';
import {
  construirCertificadoEstudio, construirCertificadoNotas, generarPDFArchivo, generarPDFStream,
  DatosEstudianteCert, MateriaNotaCert,
} from '../utils/pdf.util';

const prisma = new PrismaClient();
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIPOS_AUTO_GENERABLES: TipoCertificado[] = ['ESTUDIO', 'NOTAS'];

async function calcularNotaPeriodo(estudianteId: string, materiaId: string, periodoId: string): Promise<number | null> {
  const calificaciones = await prisma.calificacion.findMany({
    where: { estudianteId, actividad: { materiaId, periodoId } },
    include: { actividad: { select: { porcentaje: true } } },
  });
  if (calificaciones.length === 0) return null;
  const nota = calificaciones.reduce((acc, c) => acc + Number(c.valor) * (Number(c.actividad.porcentaje) / 100), 0);
  return Math.round(nota * 10) / 10;
}

async function datosEstudianteCert(estudianteId: string): Promise<DatosEstudianteCert & { gradoId: string }> {
  const est = await prisma.estudiante.findUniqueOrThrow({ where: { id: estudianteId }, include: { grado: true } });
  return {
    nombres: est.nombres, apellidos: est.apellidos, tipoDocumento: est.tipoDocumento, numeroDocumento: est.numeroDocumento,
    grado: { nombre: est.grado.nombre, grupo: est.grado.grupo, anio: est.grado.anio },
    gradoId: est.gradoId,
  };
}

async function datosNotasCert(estudianteId: string, gradoId: string): Promise<{ periodoNombre: string; materias: MateriaNotaCert[] } | null> {
  const periodoActivo = await prisma.periodo.findFirst({ where: { activo: true } });
  if (!periodoActivo) return null;

  const materiaGrados = await prisma.materiaGradoProfesor.findMany({ where: { gradoId }, include: { materia: true } });
  const materiasUnicas = [...new Map(materiaGrados.map(m => [m.materia.id, m.materia])).values()];

  const materias: MateriaNotaCert[] = [];
  for (const mat of materiasUnicas) {
    const nota = await calcularNotaPeriodo(estudianteId, mat.id, periodoActivo.id);
    materias.push({ nombre: mat.nombre, nota });
  }

  return { periodoNombre: periodoActivo.nombre, materias };
}

// ─── VALIDACIONES ─────────────────────────────────────────────────────────────

export const validarSolicitud = [
  body('estudianteId').isUUID().withMessage('Estudiante inválido'),
  body('tipoCertificado').isIn(Object.values(TipoCertificado)).withMessage('Tipo de certificado inválido'),
  body('observaciones').optional({ checkFalsy: true }).trim().isLength({ max: 300 }).withMessage('Observaciones máximo 300 caracteres'),
];

export const validarId = [param('id').isUUID().withMessage('ID inválido')];

// ─── CREAR SOLICITUD (PADRE) ────────────────────────────────────────────────────

export async function crearSolicitud(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) { res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) }); return; }

  const { estudianteId, tipoCertificado, observaciones } = req.body;
  const padreId = req.usuario!.sub;

  try {
    const solicitud = await prisma.solicitudCertificado.create({
      data: { estudianteId, padreId, tipoCertificado, observaciones: observaciones?.trim() || null },
    });
    await audit({ usuarioId: padreId, accion: 'CREAR', entidad: 'solicitudes_certificado', entidadId: solicitud.id, ip: req.ip });
    res.status(201).json({ ok: true, mensaje: 'Solicitud de certificado enviada correctamente', datos: solicitud });
  } catch (err) {
    logger.error('Error al crear solicitud de certificado', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── MIS SOLICITUDES (PADRE) ────────────────────────────────────────────────────

export async function misSolicitudes(req: Request, res: Response): Promise<void> {
  try {
    const solicitudes = await prisma.solicitudCertificado.findMany({
      where: { padreId: req.usuario!.sub },
      include: { estudiante: { select: { id: true, nombres: true, apellidos: true, grado: { select: { nombre: true, grupo: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ ok: true, datos: solicitudes });
  } catch (err) {
    logger.error('Error al listar mis solicitudes de certificado', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── LISTAR TODAS (ADMIN/SECRETARIO) ───────────────────────────────────────────

export async function listarSolicitudes(req: Request, res: Response): Promise<void> {
  const { tipo, estado, fecha } = req.query;
  try {
    const where: Record<string, unknown> = {};
    if (tipo && Object.values(TipoCertificado).includes(tipo as TipoCertificado)) where.tipoCertificado = tipo;
    if (estado) where.estado = estado;
    if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha as string)) {
      const inicio = new Date(`${fecha}T00:00:00.000Z`);
      const fin = new Date(`${fecha}T23:59:59.999Z`);
      where.createdAt = { gte: inicio, lte: fin };
    }

    const solicitudes = await prisma.solicitudCertificado.findMany({
      where,
      include: {
        estudiante: { select: { id: true, nombres: true, apellidos: true, grado: { select: { nombre: true, grupo: true } } } },
        padre: { select: { email: true, perfilPadre: { select: { nombres: true, apellidos: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ ok: true, datos: solicitudes });
  } catch (err) {
    logger.error('Error al listar solicitudes de certificado', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── PROCESAR (SECRETARIO) ──────────────────────────────────────────────────────

export async function procesarSolicitud(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!UUID_REGEX.test(id)) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(400).json({ ok: false, mensaje: 'ID inválido' });
    return;
  }

  try {
    const solicitud = await prisma.solicitudCertificado.findUnique({ where: { id } });
    if (!solicitud) {
      if (req.file) fs.unlinkSync(req.file.path);
      res.status(404).json({ ok: false, mensaje: 'Solicitud no encontrada' });
      return;
    }

    const { generarAutomatico, estado: estadoBody } = req.body;

    // ── Generación automática (solo Estudio / Notas) ──
    if (generarAutomatico === 'true' || generarAutomatico === true) {
      if (req.file) fs.unlinkSync(req.file.path);
      if (!TIPOS_AUTO_GENERABLES.includes(solicitud.tipoCertificado)) {
        res.status(400).json({ ok: false, mensaje: 'La generación automática solo está disponible para certificados de estudio o de notas' });
        return;
      }

      const datosEst = await datosEstudianteCert(solicitud.estudianteId);
      const nombreArchivo = `${uuidv4()}.pdf`;
      const rutaDestino = path.join(UPLOAD_DIR, nombreArchivo);

      if (solicitud.tipoCertificado === 'ESTUDIO') {
        await generarPDFArchivo(rutaDestino, doc => construirCertificadoEstudio(doc, datosEst, false));
      } else {
        const notas = await datosNotasCert(solicitud.estudianteId, datosEst.gradoId);
        if (!notas) {
          res.status(400).json({ ok: false, mensaje: 'No hay un período académico activo para generar el certificado de notas' });
          return;
        }
        await generarPDFArchivo(rutaDestino, doc => construirCertificadoNotas(doc, { ...datosEst, ...notas }, false));
      }

      const actualizada = await prisma.solicitudCertificado.update({
        where: { id },
        data: { archivoUrl: rutaDestino, estado: 'LISTO', procesadoPor: req.usuario!.sub, fechaProcesado: new Date() },
      });
      await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'solicitudes_certificado', entidadId: id, datosDespues: { estado: 'LISTO', origen: 'automatico' }, ip: req.ip });
      res.json({ ok: true, mensaje: 'Certificado generado correctamente', datos: actualizada });
      return;
    }

    // ── Subida manual de PDF ──
    if (req.file) {
      const actualizada = await prisma.solicitudCertificado.update({
        where: { id },
        data: { archivoUrl: req.file.path, estado: 'LISTO', procesadoPor: req.usuario!.sub, fechaProcesado: new Date() },
      });
      await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'solicitudes_certificado', entidadId: id, datosDespues: { estado: 'LISTO', origen: 'manual' }, ip: req.ip });
      res.json({ ok: true, mensaje: 'Certificado cargado correctamente', datos: actualizada });
      return;
    }

    // ── Solo cambio de estado (ej. marcar en proceso) ──
    if (estadoBody === 'EN_PROCESO') {
      const actualizada = await prisma.solicitudCertificado.update({
        where: { id },
        data: { estado: 'EN_PROCESO', procesadoPor: req.usuario!.sub },
      });
      await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'solicitudes_certificado', entidadId: id, datosDespues: { estado: 'EN_PROCESO' }, ip: req.ip });
      res.json({ ok: true, mensaje: 'Solicitud marcada en proceso', datos: actualizada });
      return;
    }

    res.status(400).json({ ok: false, mensaje: 'Debes generar el certificado automáticamente, subir un archivo PDF, o marcarlo en proceso' });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    logger.error('Error al procesar solicitud de certificado', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── DESCARGAR (PADRE) ──────────────────────────────────────────────────────────

export async function descargarCertificado(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!UUID_REGEX.test(id)) { res.status(400).json({ ok: false, mensaje: 'ID inválido' }); return; }

  try {
    const solicitud = await prisma.solicitudCertificado.findUnique({ where: { id } });
    if (!solicitud) { res.status(404).json({ ok: false, mensaje: 'Solicitud no encontrada' }); return; }
    if (solicitud.padreId !== req.usuario!.sub) { res.status(403).json({ ok: false, mensaje: 'No tienes acceso a este certificado' }); return; }
    if (!['LISTO', 'ENTREGADO'].includes(solicitud.estado)) { res.status(400).json({ ok: false, mensaje: 'El certificado aún no está listo para descargar' }); return; }
    if (!solicitud.archivoUrl) { res.status(404).json({ ok: false, mensaje: 'El archivo no está disponible' }); return; }

    await audit({ usuarioId: req.usuario!.sub, accion: 'DESCARGAR_ARCHIVO', entidad: 'solicitudes_certificado', entidadId: id, ip: req.ip });

    const esCopia = solicitud.estado === 'ENTREGADO';

    if (esCopia && TIPOS_AUTO_GENERABLES.includes(solicitud.tipoCertificado)) {
      const datosEst = await datosEstudianteCert(solicitud.estudianteId);
      if (solicitud.tipoCertificado === 'ESTUDIO') {
        generarPDFStream(res, doc => construirCertificadoEstudio(doc, datosEst, true), 'certificado.pdf');
      } else {
        const notas = await datosNotasCert(solicitud.estudianteId, datosEst.gradoId);
        if (!notas) { res.status(400).json({ ok: false, mensaje: 'No hay un período académico activo para regenerar el certificado' }); return; }
        generarPDFStream(res, doc => construirCertificadoNotas(doc, { ...datosEst, ...notas }, true), 'certificado.pdf');
      }
      return;
    }

    const rutaAbsoluta = path.resolve(solicitud.archivoUrl);
    if (!fs.existsSync(rutaAbsoluta)) { res.status(404).json({ ok: false, mensaje: 'Archivo no disponible en el servidor' }); return; }

    if (solicitud.estado === 'LISTO') {
      await prisma.solicitudCertificado.update({ where: { id }, data: { estado: 'ENTREGADO' } });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="certificado.pdf"');
    res.sendFile(rutaAbsoluta);
  } catch (err) {
    logger.error('Error al descargar certificado', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}
