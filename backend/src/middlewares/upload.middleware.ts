import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';
import fs from 'fs';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads';
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB ?? '10');
const TIPOS_PERMITIDOS = ['application/pdf'];
const EXTENSION_PERMITIDA = '.pdf';

// Crear directorio si no existe
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, _file, cb) => {
    // Nombre único con UUID para evitar sobrescritura y ocultar el nombre original
    const nombreUnico = `${uuidv4()}${EXTENSION_PERMITIDA}`;
    cb(null, nombreUnico);
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const extOk = path.extname(file.originalname).toLowerCase() === EXTENSION_PERMITIDA;
  const mimeOk = TIPOS_PERMITIDOS.includes(file.mimetype);

  if (extOk && mimeOk) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos PDF'));
  }
};

export const uploadPDF = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
    files: 1,
  },
});

const FIRMA_PDF = '%PDF-';
// El estándar PDF (ISO 32000-1 §7.5.2) permite que algunos generadores antepongan
// unos pocos bytes (BOM, saltos de línea) antes del encabezado; los lectores
// conformes buscan la firma dentro del primer KB en vez de exigirla en el byte 0.
const BYTES_A_INSPECCIONAR = 1024;

/**
 * La extensión y el Content-Type que llegan en la petición los controla el
 * cliente y son falsificables. Este middleware confirma que el contenido real
 * del archivo guardado contiene la firma binaria de PDF antes de aceptarlo.
 */
export function validarPDFReal(req: Request, res: Response, next: NextFunction): void {
  if (!req.file) { next(); return; }

  const inicio = Buffer.alloc(BYTES_A_INSPECCIONAR);
  let coincide = false;
  try {
    const fd = fs.openSync(req.file.path, 'r');
    const bytesLeidos = fs.readSync(fd, inicio, 0, BYTES_A_INSPECCIONAR, 0);
    fs.closeSync(fd);
    coincide = inicio.subarray(0, bytesLeidos).toString('latin1').includes(FIRMA_PDF);
  } catch {
    coincide = false;
  }

  if (!coincide) {
    fs.unlink(req.file.path, () => {});
    res.status(400).json({ ok: false, mensaje: 'El archivo no es un PDF válido' });
    return;
  }
  next();
}

// ─── COMPROBANTES DE PAGO (JPG, PNG o PDF) ────────────────────────────────────

const MAX_COMPROBANTE_MB = 5;
const EXTENSIONES_COMPROBANTE = ['.jpg', '.jpeg', '.png', '.pdf'];
const TIPOS_COMPROBANTE = ['image/jpeg', 'image/png', 'application/pdf'];

const storageComprobante = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${EXTENSIONES_COMPROBANTE.includes(ext) ? ext : ''}`);
  },
});

export const uploadComprobante = multer({
  storage: storageComprobante,
  fileFilter: (_req, file, cb) => {
    const extOk = EXTENSIONES_COMPROBANTE.includes(path.extname(file.originalname).toLowerCase());
    const mimeOk = TIPOS_COMPROBANTE.includes(file.mimetype);
    if (extOk && mimeOk) cb(null, true);
    else cb(new Error('Solo se permiten archivos JPG, PNG o PDF'));
  },
  limits: { fileSize: MAX_COMPROBANTE_MB * 1024 * 1024, files: 1 },
});

const FIRMAS_IMAGEN: { nombre: string; bytes: number[] }[] = [
  { nombre: 'JPG', bytes: [0xff, 0xd8, 0xff] },
  { nombre: 'PNG', bytes: [0x89, 0x50, 0x4e, 0x47] },
];

/** Igual que validarPDFReal, pero acepta también la firma binaria de JPG/PNG. */
export function validarComprobanteReal(req: Request, res: Response, next: NextFunction): void {
  if (!req.file) { next(); return; }

  const inicio = Buffer.alloc(BYTES_A_INSPECCIONAR);
  let coincide = false;
  try {
    const fd = fs.openSync(req.file.path, 'r');
    const bytesLeidos = fs.readSync(fd, inicio, 0, BYTES_A_INSPECCIONAR, 0);
    fs.closeSync(fd);
    const buffer = inicio.subarray(0, bytesLeidos);
    coincide = buffer.toString('latin1').includes(FIRMA_PDF)
      || FIRMAS_IMAGEN.some(f => buffer.subarray(0, f.bytes.length).equals(Buffer.from(f.bytes)));
  } catch {
    coincide = false;
  }

  if (!coincide) {
    fs.unlink(req.file.path, () => {});
    res.status(400).json({ ok: false, mensaje: 'El archivo no es una imagen JPG/PNG ni un PDF válido' });
    return;
  }
  next();
}
