import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// Colores institucionales
const COLOR_HEADER = 'FF1E40AF';      // azul oscuro
const COLOR_HEADER_TEXT = 'FFFFFFFF'; // blanco
const COLOR_APROBADO = 'FFD1FAE5';    // verde claro
const COLOR_REPROBADO = 'FFFEE2E2';   // rojo claro
const COLOR_PROMEDIO_BG = 'FFFEF3C7'; // amarillo claro

function estiloEncabezado(cell: ExcelJS.Cell) {
  cell.font = { name: 'Arial', bold: true, color: { argb: COLOR_HEADER_TEXT }, size: 11 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER } };
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
}

function estiloCelda(cell: ExcelJS.Cell, centrado = false) {
  cell.font = { name: 'Arial', size: 10 };
  cell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
  if (centrado) cell.alignment = { horizontal: 'center', vertical: 'middle' };
}

const LABEL_TIPO: Record<string, string> = { TAREA:'Tarea', TALLER:'Taller', EXAMEN:'Examen', QUIZ:'Quiz', PROYECTO:'Proyecto', EXPOSICION:'Exposición', PARTICIPACION:'Participación' };

async function construirHojaMateria(
  workbook: ExcelJS.Workbook,
  nombreHoja: string,
  materiaId: string,
  gradoId: string,
  periodoId: string,
  nombreProfesor: string,
  nombreGrado: string,
  nombrePeriodo: string,
) {
  const sheet = workbook.addWorksheet(nombreHoja.slice(0, 31)); // Excel limita a 31 caracteres

  const actividades = await prisma.actividad.findMany({
    where: { materiaId, gradoId, periodoId },
    orderBy: { createdAt: 'asc' },
  });

  const estudiantes = await prisma.estudiante.findMany({
    where: { gradoId, estado: 'ACTIVO' },
    orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
  });

  const calificaciones = await prisma.calificacion.findMany({
    where: { actividad: { materiaId, gradoId, periodoId } },
  });

  // ── Encabezado institucional ──
  const colsTotal = 3 + actividades.length + 1; // documento+nombre+apellido + actividades + promedio
  sheet.mergeCells(1, 1, 1, colsTotal);
  const tituloCell = sheet.getCell(1, 1);
  tituloCell.value = `PORTAL ESCOLAR — Boletín de notas`;
  tituloCell.font = { name: 'Arial', bold: true, size: 14, color: { argb: COLOR_HEADER } };
  tituloCell.alignment = { horizontal: 'center' };

  sheet.mergeCells(2, 1, 2, colsTotal);
  const subCell = sheet.getCell(2, 1);
  subCell.value = `Materia: ${nombreHoja}   |   Grado: ${nombreGrado}   |   Período: ${nombrePeriodo}   |   Profesor: ${nombreProfesor}`;
  subCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF64748B' } };
  subCell.alignment = { horizontal: 'center' };

  sheet.addRow([]); // fila vacía espaciadora

  // ── Encabezados de columnas (fila 4) ──
  const filaHeader = 4;
  const headers = ['Documento', 'Nombres', 'Apellidos', ...actividades.map(a => `${a.nombre}\n(${LABEL_TIPO[a.tipo]} ${Number(a.porcentaje)}%)`), 'Promedio período'];
  headers.forEach((h, i) => {
    const cell = sheet.getCell(filaHeader, i + 1);
    cell.value = h;
    estiloEncabezado(cell);
  });
  sheet.getRow(filaHeader).height = 32;

  // ── Filas de estudiantes ──
  let filaActual = filaHeader + 1;
  for (const est of estudiantes) {
    let col = 1;
    estiloCelda(sheet.getCell(filaActual, col), true); sheet.getCell(filaActual, col++).value = est.numeroDocumento;
    estiloCelda(sheet.getCell(filaActual, col)); sheet.getCell(filaActual, col++).value = est.nombres;
    estiloCelda(sheet.getCell(filaActual, col)); sheet.getCell(filaActual, col++).value = est.apellidos;

    let sumaPonderada = 0;
    let porcentajeConNota = 0;

    for (const act of actividades) {
      const cal = calificaciones.find(c => c.actividadId === act.id && c.estudianteId === est.id);
      const cell = sheet.getCell(filaActual, col++);
      estiloCelda(cell, true);
      if (cal) {
        const valor = Number(cal.valor);
        cell.value = valor;
        cell.numFmt = '0.0';
        sumaPonderada += valor * (Number(act.porcentaje) / 100);
        porcentajeConNota += Number(act.porcentaje);
        if (valor < 70) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_REPROBADO } };
      } else {
        cell.value = '—';
        cell.font = { name: 'Arial', size: 10, color: { argb: 'FFAAAAAA' } };
      }
    }

    const cellPromedio = sheet.getCell(filaActual, col);
    estiloCelda(cellPromedio, true);
    if (porcentajeConNota > 0) {
      const promedio = Math.round(sumaPonderada * 10) / 10;
      cellPromedio.value = promedio;
      cellPromedio.numFmt = '0.0';
      cellPromedio.font = { name: 'Arial', size: 11, bold: true };
      cellPromedio.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: promedio >= 70 ? COLOR_APROBADO : COLOR_REPROBADO } };
    } else {
      cellPromedio.value = '—';
    }

    filaActual++;
  }

  // ── Fila de estadísticas ──
  filaActual += 1;
  const promCol = String.fromCharCode(64 + colsTotal);
  sheet.mergeCells(`A${filaActual}:C${filaActual}`);
  const labelStats = sheet.getCell(`A${filaActual}`);
  labelStats.value = 'Promedio del grupo:';
  labelStats.font = { name: 'Arial', bold: true, size: 10 };

  const rangoPromedios = `${promCol}${filaHeader + 1}:${promCol}${filaActual - 2}`;
  const cellPromGrupo = sheet.getCell(filaActual, colsTotal);
  cellPromGrupo.value = { formula: `=ROUND(AVERAGE(${rangoPromedios}),1)` };
  cellPromGrupo.numFmt = '0.0';
  cellPromGrupo.font = { name: 'Arial', bold: true, size: 11 };
  cellPromGrupo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_PROMEDIO_BG } };
  cellPromGrupo.alignment = { horizontal: 'center' };

  // ── Anchos de columna ──
  sheet.getColumn(1).width = 16;
  sheet.getColumn(2).width = 18;
  sheet.getColumn(3).width = 18;
  for (let i = 4; i <= colsTotal; i++) sheet.getColumn(i).width = 16;

  sheet.views = [{ state: 'frozen', xSplit: 3, ySplit: filaHeader }];
}

// ─── EXPORTAR NOTAS DEL PROFESOR (sus materias asignadas en un grado/período) ──
export async function exportarNotasProfesor(req: Request, res: Response): Promise<void> {
  const { gradoId, periodoId } = req.query;
  if (!gradoId || !periodoId) { res.status(400).json({ ok: false, mensaje: 'gradoId y periodoId son requeridos' }); return; }

  try {
    const profesor = await prisma.profesor.findUnique({ where: { usuarioId: req.usuario!.sub } });
    if (!profesor) { res.status(404).json({ ok: false, mensaje: 'Perfil de profesor no encontrado' }); return; }

    const asignaciones = await prisma.materiaGradoProfesor.findMany({
      where: { gradoId: gradoId as string, profesorId: profesor.id },
      include: { materia: true },
    });

    if (asignaciones.length === 0) { res.status(404).json({ ok: false, mensaje: 'No tienes materias asignadas en ese grado' }); return; }

    const grado = await prisma.grado.findUnique({ where: { id: gradoId as string } });
    const periodo = await prisma.periodo.findUnique({ where: { id: periodoId as string } });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Portal Escolar';
    workbook.created = new Date();

    for (const asig of asignaciones) {
      await construirHojaMateria(
        workbook, asig.materia.nombre, asig.materiaId, gradoId as string, periodoId as string,
        `${profesor.nombres} ${profesor.apellidos}`,
        `${grado?.nombre}${grado?.grupo}`, periodo?.nombre ?? '',
      );
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Notas_${grado?.nombre}${grado?.grupo}_${periodo?.nombre?.replace(/\s/g, '_')}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    logger.error('Error al exportar notas del profesor', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── EXPORTAR NOTAS COMPLETAS DEL GRADO (admin: todas las materias) ──────────
export async function exportarNotasGrado(req: Request, res: Response): Promise<void> {
  const { gradoId, periodoId } = req.query;
  if (!gradoId || !periodoId) { res.status(400).json({ ok: false, mensaje: 'gradoId y periodoId son requeridos' }); return; }

  try {
    const asignaciones = await prisma.materiaGradoProfesor.findMany({
      where: { gradoId: gradoId as string },
      include: { materia: true, profesor: true },
    });

    if (asignaciones.length === 0) { res.status(404).json({ ok: false, mensaje: 'Este grado no tiene materias asignadas' }); return; }

    const grado = await prisma.grado.findUnique({ where: { id: gradoId as string } });
    const periodo = await prisma.periodo.findUnique({ where: { id: periodoId as string } });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Portal Escolar';
    workbook.created = new Date();

    for (const asig of asignaciones) {
      await construirHojaMateria(
        workbook, asig.materia.nombre, asig.materiaId, gradoId as string, periodoId as string,
        `${asig.profesor.nombres} ${asig.profesor.apellidos}`,
        `${grado?.nombre}${grado?.grupo}`, periodo?.nombre ?? '',
      );
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Notas_${grado?.nombre}${grado?.grupo}_${periodo?.nombre?.replace(/\s/g, '_')}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    logger.error('Error al exportar notas del grado', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}