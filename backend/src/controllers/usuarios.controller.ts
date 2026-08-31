import { Request, Response } from 'express';
import { PrismaClient, Rol } from '@prisma/client';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { audit } from '../utils/audit';
import { logger } from '../utils/logger';
import { REGEX } from '../types';
import { SALT_ROUNDS } from '../utils/config';

const prisma = new PrismaClient();

// ─── VALIDACIONES ────────────────────────────────────────────────────────────
export const validarCrearUsuario = [
  body('email').trim().isEmail().withMessage('Email inválido').isLength({ max: 100 }).withMessage('Máximo 100 caracteres').normalizeEmail(),
  body('rol').isIn(Object.values(Rol)).withMessage('Rol inválido'),
  body('nombres').trim().notEmpty().withMessage('Nombres requeridos').isLength({ min: 2, max: 50 }).withMessage('Entre 2 y 50 caracteres').matches(REGEX.SOLO_LETRAS).withMessage('Solo letras'),
  body('apellidos').trim().notEmpty().withMessage('Apellidos requeridos').isLength({ min: 2, max: 50 }).withMessage('Entre 2 y 50 caracteres').matches(REGEX.SOLO_LETRAS).withMessage('Solo letras'),
  body('telefono').optional().trim().matches(REGEX.TELEFONO).withMessage('Teléfono inválido'),
  body('numeroDocumento').optional().trim().matches(REGEX.SOLO_NUMEROS).withMessage('Documento solo dígitos'),
];

export const validarEditarMiPerfil = [
  body('nombres').optional().trim().isLength({ min: 2, max: 80 }).withMessage('Entre 2 y 80 caracteres').matches(REGEX.SOLO_LETRAS).withMessage('Solo letras'),
  body('apellidos').optional().trim().isLength({ min: 2, max: 80 }).withMessage('Entre 2 y 80 caracteres').matches(REGEX.SOLO_LETRAS).withMessage('Solo letras'),
  body('telefono').optional({ checkFalsy: true }).trim().matches(REGEX.TELEFONO).withMessage('Teléfono inválido'),
  body('tipoDocumento').optional().isIn(['CC','CE','PASAPORTE']).withMessage('Tipo de documento inválido'),
  body('numeroDocumento').optional({ checkFalsy: true }).trim().matches(REGEX.SOLO_NUMEROS).withMessage('Documento solo dígitos'),
];

export const validarActualizarCorreo = [
  body('email').trim().isEmail().withMessage('Email inválido').isLength({ max: 100 }).withMessage('Máximo 100 caracteres').normalizeEmail(),
  body('passwordActual').notEmpty().withMessage('Debes ingresar tu contraseña actual'),
];

export const validarEditarUsuario = [
  body('nombres').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Entre 2 y 50 caracteres').matches(REGEX.SOLO_LETRAS).withMessage('Solo letras'),
  body('apellidos').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Entre 2 y 50 caracteres').matches(REGEX.SOLO_LETRAS).withMessage('Solo letras'),
  body('telefono').optional().trim().matches(REGEX.TELEFONO).withMessage('Teléfono inválido'),
  body('email').optional().trim().isEmail().withMessage('Email inválido').isLength({ max: 100 }).withMessage('Máximo 100 caracteres'),
];

// ─── LISTAR USUARIOS ──────────────────────────────────────────────────────────
export async function listarUsuarios(req: Request, res: Response): Promise<void> {
  const { rol, estado } = req.query;
  try {
    const usuarios = await prisma.usuario.findMany({
      where: { rol: rol as Rol | undefined, estado: estado as 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO' | undefined },
      select: {
        id: true, email: true, rol: true, estado: true, ultimoLogin: true, createdAt: true,
        perfilProfesor: { select: { id: true, nombres: true, apellidos: true, telefono: true, numeroDocumento: true, tipoDocumento: true, materiaGrados: { include: { materia: { select: { nombre: true } }, grado: { select: { nombre: true, grupo: true } } } } } },
        perfilSecretario: { select: { id: true, nombres: true, apellidos: true, telefono: true } },
        perfilPadre: { select: { id: true, nombres: true, apellidos: true, telefono: true, numeroDocumento: true, tipoDocumento: true } },
        perfilAdmin: { select: { id: true, nombres: true, apellidos: true, telefono: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const resultado = usuarios.map(u => ({
      ...u,
      perfil: u.perfilProfesor ?? u.perfilSecretario ?? u.perfilPadre ?? u.perfilAdmin ?? null,
      perfilProfesor: undefined, perfilSecretario: undefined, perfilPadre: undefined, perfilAdmin: undefined,
    }));
    res.json({ ok: true, datos: resultado });
  } catch (err) {
    logger.error('Error al listar usuarios', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── OBTENER UN USUARIO ───────────────────────────────────────────────────────
export async function obtenerUsuario(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true, email: true, rol: true, estado: true, ultimoLogin: true, createdAt: true,
        perfilProfesor: true, perfilSecretario: true, perfilPadre: true, perfilAdmin: true,
      },
    });
    if (!usuario) { res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' }); return; }
    const perfil = usuario.perfilProfesor ?? usuario.perfilSecretario ?? usuario.perfilPadre ?? usuario.perfilAdmin;
    res.json({ ok: true, datos: { ...usuario, perfil } });
  } catch (err) {
    logger.error('Error al obtener usuario', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── CREAR USUARIO ────────────────────────────────────────────────────────────
export async function crearUsuario(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) { res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) }); return; }

  const { email, rol, nombres, apellidos, telefono, tipoDocumento, numeroDocumento } = req.body;

  try {
    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe) { res.status(409).json({ ok: false, mensaje: 'Ya existe un usuario con ese email' }); return; }

    const passwordTemporal = `${nombres.split(' ')[0]}2026!`;
    const hash = await bcrypt.hash(passwordTemporal, SALT_ROUNDS);

    const data: Record<string, unknown> = { email: email.trim(), passwordHash: hash, rol, estado: 'ACTIVO' };

    if (rol === 'ADMINISTRADOR') {
      data.perfilAdmin = { create: { nombres: nombres.trim(), apellidos: apellidos.trim(), telefono: telefono?.trim() } };
    } else if (rol === 'SECRETARIO') {
      data.perfilSecretario = { create: { nombres: nombres.trim(), apellidos: apellidos.trim(), telefono: telefono?.trim() } };
    } else if (rol === 'PROFESOR') {
      if (!numeroDocumento || !tipoDocumento) { res.status(400).json({ ok: false, mensaje: 'Documento requerido para profesores' }); return; }
      const docExiste = await prisma.profesor.findUnique({ where: { numeroDocumento } });
      if (docExiste) { res.status(409).json({ ok: false, mensaje: 'Ya existe un profesor con ese documento' }); return; }
      data.perfilProfesor = { create: { nombres: nombres.trim(), apellidos: apellidos.trim(), telefono: telefono?.trim() ?? '', tipoDocumento, numeroDocumento: numeroDocumento.trim() } };
    } else if (rol === 'PADRE') {
      if (!numeroDocumento || !tipoDocumento) { res.status(400).json({ ok: false, mensaje: 'Documento requerido para padres' }); return; }
      const docExiste = await prisma.padre.findUnique({ where: { numeroDocumento } });
      if (docExiste) { res.status(409).json({ ok: false, mensaje: 'Ya existe un padre con ese documento' }); return; }
      data.perfilPadre = { create: { nombres: nombres.trim(), apellidos: apellidos.trim(), telefono: telefono?.trim() ?? '', tipoDocumento, numeroDocumento: numeroDocumento.trim() } };
    }

    const usuario = await prisma.usuario.create({
      data: data as Parameters<typeof prisma.usuario.create>[0]['data'],
      select: { id: true, email: true, rol: true, estado: true, createdAt: true },
    });

    await audit({ usuarioId: req.usuario!.sub, accion: 'CREAR', entidad: 'usuarios', entidadId: usuario.id, datosDespues: { email, rol, nombres, apellidos }, ip: req.ip });

    res.status(201).json({ ok: true, datos: usuario, mensaje: `Usuario creado. Contraseña temporal: ${passwordTemporal}` });
  } catch (err) {
    logger.error('Error al crear usuario', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── EDITAR USUARIO (datos del perfil) ────────────────────────────────────────
export async function editarUsuario(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) { res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) }); return; }

  const { id } = req.params;
  const { nombres, apellidos, telefono, email } = req.body;

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      include: { perfilProfesor: true, perfilSecretario: true, perfilPadre: true, perfilAdmin: true },
    });
    if (!usuario) { res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' }); return; }

    // Actualizar email si cambió
    if (email && email !== usuario.email) {
      const existeEmail = await prisma.usuario.findFirst({ where: { email, id: { not: id } } });
      if (existeEmail) { res.status(409).json({ ok: false, mensaje: 'Ese email ya está en uso' }); return; }
      await prisma.usuario.update({ where: { id }, data: { email: email.trim() } });
    }

    // Actualizar el perfil correspondiente según el rol
    const datosPerfilUpdate = { nombres: nombres?.trim(), apellidos: apellidos?.trim(), telefono: telefono?.trim() };

    if (usuario.rol === 'ADMINISTRADOR' && usuario.perfilAdmin) {
      await prisma.administrador.update({ where: { usuarioId: id }, data: datosPerfilUpdate });
    } else if (usuario.rol === 'SECRETARIO' && usuario.perfilSecretario) {
      await prisma.secretario.update({ where: { usuarioId: id }, data: datosPerfilUpdate });
    } else if (usuario.rol === 'PROFESOR' && usuario.perfilProfesor) {
      await prisma.profesor.update({ where: { usuarioId: id }, data: datosPerfilUpdate });
    } else if (usuario.rol === 'PADRE' && usuario.perfilPadre) {
      await prisma.padre.update({ where: { usuarioId: id }, data: datosPerfilUpdate });
    }

    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'usuarios', entidadId: id, datosDespues: { nombres, apellidos, telefono, email }, ip: req.ip });

    res.json({ ok: true, mensaje: 'Usuario actualizado correctamente' });
  } catch (err) {
    logger.error('Error al editar usuario', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── ELIMINAR USUARIO ─────────────────────────────────────────────────────────
export async function eliminarUsuario(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    if (id === req.usuario!.sub) {
      res.status(400).json({ ok: false, mensaje: 'No puedes eliminar tu propia cuenta' });
      return;
    }

    const usuario = await prisma.usuario.findUnique({ where: { id } });
    if (!usuario) { res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' }); return; }

    await prisma.usuario.delete({ where: { id } });

    await audit({ usuarioId: req.usuario!.sub, accion: 'ELIMINAR', entidad: 'usuarios', entidadId: id, datosAntes: { email: usuario.email, rol: usuario.rol }, ip: req.ip });

    res.json({ ok: true, mensaje: 'Usuario eliminado correctamente' });
  } catch (err) {
    logger.error('Error al eliminar usuario', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── CAMBIAR ESTADO ───────────────────────────────────────────────────────────
export async function cambiarEstadoUsuario(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { estado } = req.body;
  if (!['ACTIVO', 'INACTIVO', 'BLOQUEADO'].includes(estado)) { res.status(400).json({ ok: false, mensaje: 'Estado inválido' }); return; }

  try {
    if (id === req.usuario!.sub && estado !== 'ACTIVO') {
      res.status(400).json({ ok: false, mensaje: 'No puedes desactivar tu propia cuenta' });
      return;
    }

    const usuario = await prisma.usuario.update({
      where: { id },
      data: { estado, intentosFallidos: 0, bloqueadoHasta: null },
      select: { id: true, email: true, estado: true },
    });

    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'usuarios', entidadId: id, datosDespues: { estado }, ip: req.ip });

    res.json({ ok: true, datos: usuario });
  } catch (err) {
    logger.error('Error al cambiar estado usuario', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── RESETEAR CONTRASEÑA ──────────────────────────────────────────────────────
export async function resetearPassword(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id },
      include: { perfilProfesor: true, perfilPadre: true, perfilSecretario: true, perfilAdmin: true },
    });
    if (!usuario) { res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' }); return; }

    const perfil = usuario.perfilProfesor ?? usuario.perfilPadre ?? usuario.perfilSecretario ?? usuario.perfilAdmin;
    const nombre = perfil?.nombres?.split(' ')[0] ?? 'Usuario';
    const passwordTemporal = `${nombre}2026!`;
    const hash = await bcrypt.hash(passwordTemporal, SALT_ROUNDS);

    await prisma.usuario.update({ where: { id }, data: { passwordHash: hash, refreshToken: null, intentosFallidos: 0, bloqueadoHasta: null } });

    await audit({ usuarioId: req.usuario!.sub, accion: 'CAMBIO_CONTRASENA', entidad: 'usuarios', entidadId: id, ip: req.ip });

    res.json({ ok: true, mensaje: `Contraseña reseteada. Nueva contraseña temporal: ${passwordTemporal}` });
  } catch (err) {
    logger.error('Error al resetear contraseña', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── MI PERFIL (profesor autenticado) ────────────────────────────────────────
export async function miPerfil(req: Request, res: Response): Promise<void> {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuario!.sub },
      select: {
        id: true,
        email: true,
        rol: true,
        estado: true,
        perfilProfesor: {
          select: {
            id: true,
            nombres: true,
            apellidos: true,
            tipoDocumento: true,
            numeroDocumento: true,
            telefono: true,
            materiaGrados: {
              include: {
                materia: { select: { id: true, nombre: true } },
                grado: { select: { id: true, nombre: true, grupo: true } },
              },
            },
          },
        },
      },
    });
    if (!usuario) { res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' }); return; }
    res.json({ ok: true, datos: usuario });
  } catch (err) {
    logger.error('Error al obtener mi perfil', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

export async function editarMiPerfil(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) });
    return;
  }

  const { telefono, nombres, apellidos, tipoDocumento, numeroDocumento } = req.body;
  try {
    const profesor = await prisma.profesor.findUnique({ where: { usuarioId: req.usuario!.sub } });
    if (!profesor) { res.status(404).json({ ok: false, mensaje: 'Perfil no encontrado' }); return; }

    const actualizado = await prisma.profesor.update({
      where: { id: profesor.id },
      data: {
        telefono: telefono?.trim() || profesor.telefono,
        nombres: nombres?.trim() ?? profesor.nombres,
        apellidos: apellidos?.trim() ?? profesor.apellidos,
        tipoDocumento: tipoDocumento ?? profesor.tipoDocumento,
        numeroDocumento: numeroDocumento?.trim() ?? profesor.numeroDocumento,
      },
    });

    await audit({ usuarioId: req.usuario!.sub, accion: 'EDITAR', entidad: 'profesores', entidadId: profesor.id, datosDespues: actualizado, ip: req.ip });
    res.json({ ok: true, datos: actualizado, mensaje: 'Perfil actualizado' });
  } catch (err) {
    logger.error('Error al editar mi perfil', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}

// ─── ACTUALIZAR CORREO (padre actualiza su propio correo de acceso) ───────────
export async function actualizarCorreo(req: Request, res: Response): Promise<void> {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    res.status(400).json({ ok: false, errores: errores.array().map(e => e.msg) });
    return;
  }

  const { email, passwordActual } = req.body;
  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario!.sub } });
    if (!usuario) { res.status(404).json({ ok: false, mensaje: 'Usuario no encontrado' }); return; }

    // Verificar contraseña actual
    const ok = await bcrypt.compare(passwordActual, usuario.passwordHash);
    if (!ok) { res.status(401).json({ ok: false, mensaje: 'Contraseña incorrecta' }); return; }

    // Verificar que el nuevo correo no exista
    const emailExiste = await prisma.usuario.findFirst({ where: { email: email.trim(), NOT: { id: usuario.id } } });
    if (emailExiste) { res.status(400).json({ ok: false, mensaje: 'Ese correo ya está registrado' }); return; }

    await prisma.usuario.update({ where: { id: usuario.id }, data: { email: email.trim() } });
    await audit({ usuarioId: usuario.id, accion: 'EDITAR', entidad: 'usuarios', entidadId: usuario.id, datosDespues: { email }, ip: req.ip });
    res.json({ ok: true, mensaje: 'Correo actualizado. Usa el nuevo correo en tu próximo login.' });
  } catch (err) {
    logger.error('Error al actualizar correo', { err });
    res.status(500).json({ ok: false, mensaje: 'Error interno del servidor' });
  }
}