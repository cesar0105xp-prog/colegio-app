import PDFDocument from 'pdfkit';
import fs from 'fs';
import { Response } from 'express';

const NOMBRE_COLEGIO = 'Liceo Moderno San Marcos';
const CIUDAD = 'Bogotá, Colombia';

const LABEL_TIPO_DOC: Record<string, string> = { CC: 'C.C.', TI: 'T.I.', RC: 'R.C.', CE: 'C.E.', PASAPORTE: 'Pasaporte' };

function agregarMembrete(doc: PDFKit.PDFDocument): void {
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#1e3a8a').text(NOMBRE_COLEGIO, { align: 'center' });
  doc.fontSize(10).font('Helvetica').fillColor('#64748b').text(CIUDAD, { align: 'center' });
  doc.moveDown(0.5);
  doc.strokeColor('#1e3a8a').lineWidth(2)
    .moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
  doc.moveDown(1.5);
  doc.fillColor('#000');
}

function agregarFirma(doc: PDFKit.PDFDocument): void {
  doc.moveDown(4);
  const x = doc.page.margins.left;
  const ancho = 220;
  doc.strokeColor('#000').lineWidth(1).moveTo(x, doc.y).lineTo(x + ancho, doc.y).stroke();
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica-Bold').text('Dirección Académica', x, doc.y, { width: ancho });
  doc.font('Helvetica').fillColor('#64748b').text(NOMBRE_COLEGIO, x, doc.y, { width: ancho });
  doc.fillColor('#000');
}

function agregarPie(doc: PDFKit.PDFDocument): void {
  const fecha = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.moveDown(2);
  doc.fontSize(9).fillColor('#94a3b8').text(`Documento generado el ${fecha} a través del Portal Escolar.`, { align: 'center' });
  doc.fillColor('#000');
}

function agregarMarcaDeAgua(doc: PDFKit.PDFDocument, esCopia: boolean): void {
  if (!esCopia) return;
  const cx = doc.page.width / 2;
  const cy = doc.page.height / 2;
  const xOrig = doc.x, yOrig = doc.y;
  // El texto rotado puede confundir el cálculo de paginación automática de pdfkit
  // y disparar una página en blanco adicional; se desactiva temporalmente.
  const addPageOriginal = doc.addPage.bind(doc);
  doc.addPage = () => doc;
  doc.save();
  doc.rotate(-45, { origin: [cx, cy] });
  doc.fontSize(90).font('Helvetica-Bold').fillColor('#cbd5e1').opacity(0.4)
    .text('COPIA', cx - 250, cy - 45, { width: 500, align: 'center', lineBreak: false });
  doc.restore();
  doc.addPage = addPageOriginal;
  doc.x = xOrig; doc.y = yOrig;
  doc.opacity(1).fillColor('#000');
}

export interface DatosEstudianteCert {
  nombres: string;
  apellidos: string;
  tipoDocumento: string;
  numeroDocumento: string;
  grado: { nombre: string; grupo: string; anio: number };
}

export function construirCertificadoEstudio(doc: PDFKit.PDFDocument, est: DatosEstudianteCert, esCopia: boolean): void {
  agregarMarcaDeAgua(doc, esCopia);
  agregarMembrete(doc);

  doc.fontSize(15).font('Helvetica-Bold').text('CERTIFICADO DE ESTUDIO', { align: 'center' });
  doc.moveDown(2);

  doc.fontSize(11).font('Helvetica').lineGap(6).text(
    `La Dirección Académica del colegio ${NOMBRE_COLEGIO} certifica que el(la) estudiante ` +
    `${est.nombres} ${est.apellidos}, identificado(a) con ${LABEL_TIPO_DOC[est.tipoDocumento] ?? est.tipoDocumento} No. ${est.numeroDocumento}, ` +
    `se encuentra matriculado(a) y cursando el grado ${est.grado.nombre} ${est.grado.grupo} durante el año lectivo ${est.grado.anio}.`,
    { align: 'justify' }
  );
  doc.moveDown();
  doc.text('Este certificado se expide a solicitud del acudiente para los fines que el interesado estime convenientes.', { align: 'justify' });

  agregarFirma(doc);
  agregarPie(doc);
}

export interface MateriaNotaCert { nombre: string; nota: number | null }
export interface DatosNotasCert extends DatosEstudianteCert {
  periodoNombre: string;
  materias: MateriaNotaCert[];
}

export function construirCertificadoNotas(doc: PDFKit.PDFDocument, datos: DatosNotasCert, esCopia: boolean): void {
  agregarMarcaDeAgua(doc, esCopia);
  agregarMembrete(doc);

  doc.fontSize(15).font('Helvetica-Bold').text('CERTIFICADO DE NOTAS', { align: 'center' });
  doc.moveDown(2);

  doc.fontSize(11).font('Helvetica').lineGap(6).text(
    `La Dirección Académica del colegio ${NOMBRE_COLEGIO} certifica que el(la) estudiante ` +
    `${datos.nombres} ${datos.apellidos}, identificado(a) con ${LABEL_TIPO_DOC[datos.tipoDocumento] ?? datos.tipoDocumento} No. ${datos.numeroDocumento}, ` +
    `del grado ${datos.grado.nombre} ${datos.grado.grupo}, obtuvo las siguientes calificaciones durante el ${datos.periodoNombre} del año lectivo ${datos.grado.anio}:`,
    { align: 'justify' }
  );
  doc.moveDown(1.5);

  // Tabla simple
  const x = doc.page.margins.left;
  const anchoTabla = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colMateria = anchoTabla * 0.7;
  const colNota = anchoTabla * 0.3;
  let y = doc.y;

  doc.font('Helvetica-Bold').fontSize(10);
  doc.rect(x, y, anchoTabla, 22).fill('#1e3a8a');
  doc.fillColor('#fff').text('Materia', x + 8, y + 6, { width: colMateria - 8 });
  doc.text('Nota', x + colMateria, y + 6, { width: colNota - 8, align: 'center' });
  y += 22;

  doc.font('Helvetica').fontSize(10);
  datos.materias.forEach((m, i) => {
    const alturaFila = 20;
    doc.rect(x, y, anchoTabla, alturaFila).fill(i % 2 === 0 ? '#f8fafc' : '#ffffff');
    doc.fillColor('#000').text(m.nombre, x + 8, y + 5, { width: colMateria - 8 });
    doc.text(m.nota != null ? m.nota.toFixed(1) : '—', x + colMateria, y + 5, { width: colNota - 8, align: 'center' });
    y += alturaFila;
  });

  doc.rect(x, y, anchoTabla, 1).fill('#cbd5e1');
  doc.y = y + 10;

  const conNota = datos.materias.filter(m => m.nota != null);
  const promedio = conNota.length > 0 ? conNota.reduce((a, m) => a + (m.nota ?? 0), 0) / conNota.length : null;
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#000')
    .text(`Promedio general: ${promedio != null ? promedio.toFixed(1) : '—'} / 100`, x, doc.y);

  agregarFirma(doc);
  agregarPie(doc);
}

export function generarPDFArchivo(rutaDestino: string, construir: (doc: PDFKit.PDFDocument) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(rutaDestino);
    doc.pipe(stream);
    construir(doc);
    doc.end();
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });
}

export function generarPDFStream(res: Response, construir: (doc: PDFKit.PDFDocument) => void, nombreArchivo: string): void {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${nombreArchivo}"`);
  doc.pipe(res);
  construir(doc);
  doc.end();
}
