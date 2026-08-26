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

/**
 * La extensión y el Content-Type que llegan en la petición los controla el
 * cliente y son falsificables. Este middleware confirma que el contenido real
 * del archivo guardado empieza con la firma binaria de PDF antes de aceptarlo.
 */
export function validarPDFReal(req: Request, res: Response, next: NextFunction): void {
  if (!req.file) { next(); return; }

  const firma = Buffer.alloc(FIRMA_PDF.length);
  let coincide = false;
  try {
    const fd = fs.openSync(req.file.path, 'r');
    fs.readSync(fd, firma, 0, FIRMA_PDF.length, 0);
    fs.closeSync(fd);
    coincide = firma.toString('ascii') === FIRMA_PDF;
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
