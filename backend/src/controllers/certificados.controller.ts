import { Request, Response } from 'express';
import { PrismaClient, Prisma, TipoCertificado, EstadoCertificado } from '@prisma/client';
import { body, param, validationResult } from 'express-validator';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { audit } from '../utils/audit';
import { logger } from '../utils/logger';
import { calcularNotaPeriodo } from './calificaciones.controller';
import {
  construirCertificadoEstudio, construirCertificadoNotas, generarPDFArchivo, generarPDFStream,
  DatosEstudianteCert, MateriaNotaCert,
} from '../utils/pdf.util';

const prisma = new PrismaClient();
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIPOS_AUTO_GENERABLES: TipoCertificado[] = ['ESTUDIO', 'NOTAS'];
// Colombia no observa horario de verano: desfase fijo UTC-5 todo el año.
const OFFSET_BOGOTA_MS = 5 * 60 * 60 * 1000;

interface NotasSnapshot { periodoNombre: string; materias: MateriaNotaCert[] }
interface DatosSnapshot { datosEst: DatosEstudianteCert & { gradoId: string }; notas?: NotasSnapshot }

/** Borra un archivo previamente asociado a una solicitud, sin interrumpir el flujo si falla. */
function eliminarArchivoAnterior(ruta: string | null): void {
  if (!ruta) return;
  fs.unlink(ruta, err => { if (err && err.code !== 'ENOENT') logger.error('No se pudo eliminar el archivo anterior del certificado', { err, ruta }); });
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
    if (estado && Object.values(EstadoCertificado).includes(estado as EstadoCertificado)) where.estado = estado;
    if (fecha && FECHA_REGEX.test(fecha as string)) {
      // Los límites del día se calculan en hora de Bogotá (UTC-5), no en UTC,
      // para que "hoy" coincida con el día calendario real del usuario.
      const inicio = new Date(new Date(`${fecha}T00:00:00.000Z`).getTime() + OFFSET_BOGOTA_MS);
      const fin = new Date(inicio.getTime() + 24 * 60 * 60 * 1000 - 1);
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
      let snapshot: DatosSnapshot;

      if (solicitud.tipoCertificado === 'ESTUDIO') {
        await generarPDFArchivo(rutaDestino, doc => construirCertificadoEstudio(doc, datosEst, false));
        snapshot = { datosEst };
      } else {
        const notas = await datosNotasCert(solicitud.estudianteId, datosEst.gradoId);
        if (!notas) {
          res.status(400).json({ ok: false, mensaje: 'No hay un período académico activo para generar el certificado de notas' });
          return;
        }
        await generarPDFArchivo(rutaDestino, doc => construirCertificadoNotas(doc, { ...datosEst, ...notas }, false));
        snapshot = { datosEst, notas };
      }

      // Se guarda una foto exacta de los datos usados para el PDF original: si el
      // padre vuelve a descargarlo después de que cambie el período activo o el
      // grado del estudiante, la "copia" reproduce lo que realmente se certificó
      // en vez de regenerarse con datos que ya cambiaron.
      const actualizada = await prisma.solicitudCertificado.update({
        where: { id },
        data: { archivoUrl: rutaDestino, datosSnapshot: snapshot as object, estado: 'LISTO', procesadoPor: req.usuario!.sub, fechaProcesado: new Date() },
      });
      eliminarArchivoAnterior(solicitud.archivoUrl);
      await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'solicitudes_certificado', entidadId: id, datosDespues: { estado: 'LISTO', origen: 'automatico' }, ip: req.ip });
      res.json({ ok: true, mensaje: 'Certificado generado correctamente', datos: actualizada });
      return;
    }

    // ── Subida manual de PDF ──
    if (req.file) {
      const actualizada = await prisma.solicitudCertificado.update({
        where: { id },
        data: { archivoUrl: req.file.path, datosSnapshot: Prisma.JsonNull, estado: 'LISTO', procesadoPor: req.usuario!.sub, fechaProcesado: new Date() },
      });
      eliminarArchivoAnterior(solicitud.archivoUrl);
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
      // Se reproduce la "foto" de los datos guardada al generar el original
      // (no se vuelve a consultar el grado/período actuales), para que la copia
      // sea idéntica a lo que realmente se certificó la primera vez.
      const snapshot = solicitud.datosSnapshot as unknown as DatosSnapshot | null;
      const datosEst = snapshot?.datosEst ?? await datosEstudianteCert(solicitud.estudianteId);

      if (solicitud.tipoCertificado === 'ESTUDIO') {
        generarPDFStream(res, doc => construirCertificadoEstudio(doc, datosEst, true), 'certificado.pdf');
      } else {
        const notas = snapshot?.notas ?? await datosNotasCert(solicitud.estudianteId, datosEst.gradoId);
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
