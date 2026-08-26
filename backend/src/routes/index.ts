import { Router } from 'express';
import { Rol } from '@prisma/client';
import { login, logout, refreshToken, cambiarPassword, validarLogin, validarCambioPassword } from '../controllers/auth.controller';
import { listarEstudiantes, obtenerEstudiante, crearEstudiante, editarEstudiante, cambiarEstadoEstudiante, validarEstudiante } from '../controllers/estudiantes.controller';
import { listarUsuarios, obtenerUsuario, crearUsuario, editarUsuario, eliminarUsuario, cambiarEstadoUsuario, resetearPassword, validarCrearUsuario, validarEditarUsuario, miPerfil, editarMiPerfil, actualizarCorreo } from '../controllers/usuarios.controller';
import { listarGrados, crearGrado, editarGrado, validarGrado, listarMaterias, crearMateria, editarMateria, eliminarMateria, validarMateria, asignarMateriaGrado, listarPeriodos, crearPeriodo, editarPeriodo, validarPeriodo, activarPeriodo, obtenerStats } from '../controllers/academico.controller';
import { crearActividad, listarActividades, registrarCalificacion, obtenerBoletin, validarActividad, validarCalificacion, editarActividad, eliminarActividad } from '../controllers/calificaciones.controller';
import { crearObservacion, listarObservaciones, marcarObservacionVista, validarObservacion, eliminarObservacion, editarObservacion } from '../controllers/observaciones.controller';
import { subirArchivo, descargarArchivo, listarArchivos } from '../controllers/archivos.controller';
import { misHijos, miPerfilEstudiante } from '../controllers/padre.controller';
import { listarVinculos, crearVinculo, eliminarVinculo, validarVinculo } from '../controllers/vinculos.controller';
import { reporteBoletinesPorGrado, reporteRendimientoMateria, reporteEstudiantesDestacados, reporteObservacionesPendientes } from '../controllers/reportes.controller';
import { listarAuditoria } from '../controllers/auditoria.controller';
import { autenticar, autorizar, validarAccesoPadreEstudiante, validarAccesoEstudiante } from '../middlewares/auth.middleware';
import { uploadPDF } from '../middlewares/upload.middleware';

const router = Router();
const ADMIN = Rol.ADMINISTRADOR;
const SEC   = Rol.SECRETARIO;
const PROF  = Rol.PROFESOR;
const PADRE = Rol.PADRE;
const EST   = Rol.ESTUDIANTE;

// AUTH
router.post('/auth/login',    validarLogin, login);
router.post('/auth/refresh',  refreshToken);
router.post('/auth/logout',   autenticar, logout);
router.put('/auth/password',  autenticar, validarCambioPassword, cambiarPassword);

// STATS
router.get('/stats', autenticar, autorizar(ADMIN, SEC), obtenerStats);

// ESTUDIANTES
router.get('/estudiantes',              autenticar, autorizar(ADMIN, SEC, PROF), listarEstudiantes);
router.get('/estudiantes/mis-hijos',    autenticar, autorizar(PADRE), misHijos);
router.get('/estudiantes/mi-perfil',    autenticar, autorizar(EST), miPerfilEstudiante);
router.get('/estudiantes/:id',          autenticar, autorizar(ADMIN, SEC, PROF), obtenerEstudiante);
router.post('/estudiantes',             autenticar, autorizar(ADMIN, SEC), validarEstudiante, crearEstudiante);
router.put('/estudiantes/:id',          autenticar, autorizar(ADMIN, SEC), validarEstudiante, editarEstudiante);
router.patch('/estudiantes/:id/estado', autenticar, autorizar(ADMIN), cambiarEstadoEstudiante);

// USUARIOS
router.get('/usuarios/mi-perfil',               autenticar, autorizar(PROF), miPerfil);
router.put('/usuarios/mi-perfil',               autenticar, autorizar(PROF), editarMiPerfil);
router.put('/usuarios/mi-correo',               autenticar, autorizar(PADRE), actualizarCorreo);
router.get('/usuarios',                         autenticar, autorizar(ADMIN, SEC, PADRE), listarUsuarios);
router.get('/usuarios/:id',                 autenticar, autorizar(ADMIN), obtenerUsuario);
router.post('/usuarios',                    autenticar, autorizar(ADMIN), validarCrearUsuario, crearUsuario);
router.put('/usuarios/:id',                 autenticar, autorizar(ADMIN), validarEditarUsuario, editarUsuario);
router.delete('/usuarios/:id',              autenticar, autorizar(ADMIN), eliminarUsuario);
router.patch('/usuarios/:id/estado',        autenticar, autorizar(ADMIN), cambiarEstadoUsuario);
router.post('/usuarios/:id/reset-password', autenticar, autorizar(ADMIN), resetearPassword);

// VÍNCULOS PADRE-ESTUDIANTE
router.get('/vinculos',      autenticar, autorizar(ADMIN, SEC), listarVinculos);
router.post('/vinculos',     autenticar, autorizar(ADMIN, SEC), validarVinculo, crearVinculo);
router.delete('/vinculos/:id', autenticar, autorizar(ADMIN), eliminarVinculo);

// GRADOS
router.get('/grados',                  autenticar, autorizar(ADMIN, SEC, PROF), listarGrados);
router.post('/grados',                 autenticar, autorizar(ADMIN), validarGrado, crearGrado);
router.put('/grados/:id',              autenticar, autorizar(ADMIN), editarGrado);
router.post('/grados/asignar-materia', autenticar, autorizar(ADMIN), asignarMateriaGrado);

// MATERIAS
router.get('/materias',  autenticar, autorizar(ADMIN, SEC, PROF), listarMaterias);
router.post('/materias', autenticar, autorizar(ADMIN), validarMateria, crearMateria);
router.put('/materias/:id', autenticar, autorizar(ADMIN), validarMateria, editarMateria);
router.delete('/materias/:id', autenticar, autorizar(ADMIN), eliminarMateria);

// PERÍODOS
router.get('/periodos',               autenticar, autorizar(ADMIN, SEC, PROF, PADRE, EST), listarPeriodos);
router.post('/periodos',              autenticar, autorizar(ADMIN), validarPeriodo, crearPeriodo);
router.put('/periodos/:id',           autenticar, autorizar(ADMIN), validarPeriodo, editarPeriodo);
router.patch('/periodos/:id/activar', autenticar, autorizar(ADMIN), activarPeriodo);

// ACTIVIDADES
router.get('/actividades',      autenticar, autorizar(ADMIN, SEC, PROF), listarActividades);
router.post('/actividades',     autenticar, autorizar(ADMIN, PROF), validarActividad, crearActividad);
router.put('/actividades/:id',  autenticar, autorizar(ADMIN, PROF), editarActividad);
router.delete('/actividades/:id', autenticar, autorizar(ADMIN, PROF), eliminarActividad);

// CALIFICACIONES
router.post('/calificaciones', autenticar, autorizar(ADMIN, PROF), validarCalificacion, registrarCalificacion);

// BOLETÍN
router.get('/boletin/:estudianteId', autenticar, autorizar(ADMIN, SEC, PROF, PADRE, EST), validarAccesoPadreEstudiante, validarAccesoEstudiante, obtenerBoletin);

// OBSERVACIONES
router.get('/observaciones/:estudianteId',          autenticar, autorizar(ADMIN, SEC, PROF, PADRE, EST), validarAccesoPadreEstudiante, validarAccesoEstudiante, listarObservaciones);
router.post('/observaciones',                       autenticar, autorizar(ADMIN, PROF), validarObservacion, crearObservacion);
router.put('/observaciones/:id',                    autenticar, autorizar(ADMIN, PROF), editarObservacion);
router.post('/observaciones/:observacionId/visto',  autenticar, autorizar(PADRE), marcarObservacionVista);
router.delete('/observaciones/:id',                 autenticar, autorizar(ADMIN, PROF), eliminarObservacion);

// ARCHIVOS
router.post('/archivos',                         autenticar, autorizar(ADMIN, SEC, PADRE), uploadPDF.single('archivo'), subirArchivo);
router.get('/archivos/estudiante/:estudianteId', autenticar, autorizar(ADMIN, SEC, PROF, PADRE, EST), validarAccesoPadreEstudiante, validarAccesoEstudiante, listarArchivos);
router.get('/archivos/:archivoId/descargar',     autenticar, descargarArchivo);

// REPORTES
router.get('/reportes/boletines-grado',          autenticar, autorizar(ADMIN, SEC), reporteBoletinesPorGrado);
router.get('/reportes/rendimiento-materia',      autenticar, autorizar(ADMIN, SEC), reporteRendimientoMateria);
router.get('/reportes/estudiantes-destacados',   autenticar, autorizar(ADMIN, SEC), reporteEstudiantesDestacados);
router.get('/reportes/observaciones-pendientes', autenticar, autorizar(ADMIN, SEC), reporteObservacionesPendientes);

// AUDITORÍA
router.get('/auditoria', autenticar, autorizar(ADMIN), listarAuditoria);

// RESUMEN ANUAL
import { obtenerResumenAnual } from '../controllers/calificaciones.controller';
router.get('/boletin/:estudianteId/resumen-anual', autenticar, autorizar(ADMIN, SEC, PROF, PADRE, EST), validarAccesoPadreEstudiante, validarAccesoEstudiante, obtenerResumenAnual);

// COMUNICADOS
import { enviarComunicado, listarComunicados, validarComunicado, comunicadosParaPadre, archivarComunicado } from '../controllers/comunicados.controller';
router.get('/comunicados',              autenticar, autorizar(ADMIN, SEC), listarComunicados);
router.post('/comunicados',             autenticar, autorizar(ADMIN, SEC), validarComunicado, enviarComunicado);
router.get('/comunicados/padre',        autenticar, autorizar(PADRE), comunicadosParaPadre);
router.patch('/comunicados/:id/archivar', autenticar, autorizar(ADMIN, SEC), archivarComunicado);

// MATRÍCULAS
import { crearMatricula, listarMatriculas, verificarMatricula, rechazarMatricula, validarMatricula } from '../controllers/matriculas.controller';
router.get('/matriculas',                    autenticar, autorizar(ADMIN, SEC), listarMatriculas);
router.post('/matriculas',                   autenticar, autorizar(ADMIN, SEC), validarMatricula, crearMatricula);
router.patch('/matriculas/:id/verificar',    autenticar, autorizar(ADMIN, SEC), verificarMatricula);
router.patch('/matriculas/:id/rechazar',     autenticar, autorizar(ADMIN, SEC), rechazarMatricula);

// DATOS ADICIONALES Y TIPOS DE DOCUMENTO
import { obtenerDatosAdicionales, guardarDatosAdicionales, validarDatosAdicionales, actualizarDatosPadre, validarDatosPadre, listarTiposDocumento, crearTipoDocumento, editarTipoDocumento } from '../controllers/datos_adicionales.controller';
router.get('/estudiantes/:estudianteId/datos-adicionales',  autenticar, autorizar(ADMIN, SEC, PROF, PADRE), obtenerDatosAdicionales);
router.put('/estudiantes/:estudianteId/datos-adicionales',  autenticar, autorizar(ADMIN, SEC, PADRE), validarDatosAdicionales, guardarDatosAdicionales);
router.put('/padre/mis-datos',                              autenticar, autorizar(PADRE), validarDatosPadre, actualizarDatosPadre);
router.get('/tipos-documento',                              autenticar, listarTiposDocumento);
router.post('/tipos-documento',                             autenticar, autorizar(ADMIN), crearTipoDocumento);
router.put('/tipos-documento/:id',                          autenticar, autorizar(ADMIN), editarTipoDocumento);

// CONTACTOS DE EMERGENCIA
import { listarContactos, crearContacto, editarContacto, eliminarContacto, validarContacto } from '../controllers/contactos.controller';
router.get('/estudiantes/:estudianteId/contactos',     autenticar, autorizar(ADMIN, SEC, PROF, PADRE), listarContactos);
router.post('/estudiantes/:estudianteId/contactos',    autenticar, autorizar(ADMIN, SEC, PADRE), validarContacto, crearContacto);
router.put('/contactos/:id',                           autenticar, autorizar(ADMIN, SEC, PADRE), validarContacto, editarContacto);
router.delete('/contactos/:id',                        autenticar, autorizar(ADMIN, SEC), eliminarContacto);

export default router;

// FICHA COMPLETA DEL ESTUDIANTE (admin/secretario)
import { obtenerFichaCompleta } from '../controllers/estudiantes.controller';
router.get('/estudiantes/:id/ficha-completa', autenticar, autorizar(ADMIN, SEC), obtenerFichaCompleta);

// EXPORTAR NOTAS A EXCEL
import { exportarNotasProfesor, exportarNotasGrado } from '../controllers/exportar.controller';
router.get('/exportar/notas-profesor', autenticar, autorizar(PROF), exportarNotasProfesor);
router.get('/exportar/notas-grado', autenticar, autorizar(ADMIN, SEC), exportarNotasGrado);

// PAGOS Y CARTERA
import {
  listarConceptos, crearConcepto, editarConcepto, desactivarConcepto,
  validarConceptoPago, validarConceptoPagoEditar, validarIdConcepto,
  listarCobros, crearCobro, generarCobrosMasivo, marcarPagado, exonerarCobro,
  validarCobro, validarCobroMasivo, validarMarcarPagado, validarExonerar,
  reporteCartera, exportarCarteraCSV, miEstadoCuenta,
} from '../controllers/pagos.controller';

router.get('/conceptos',           autenticar, autorizar(ADMIN, SEC), listarConceptos);
router.post('/conceptos',          autenticar, autorizar(ADMIN), validarConceptoPago, crearConcepto);
router.put('/conceptos/:id',       autenticar, autorizar(ADMIN), validarConceptoPagoEditar, editarConcepto);
router.delete('/conceptos/:id',    autenticar, autorizar(ADMIN), validarIdConcepto, desactivarConcepto);

router.get('/cobros/reporte',      autenticar, autorizar(ADMIN, SEC), reporteCartera);
router.get('/cobros/mi-estado',    autenticar, autorizar(PADRE), miEstadoCuenta);
router.get('/cobros/exportar',     autenticar, autorizar(ADMIN), exportarCarteraCSV);
router.get('/cobros',              autenticar, autorizar(ADMIN, SEC), listarCobros);
router.post('/cobros/masivo',      autenticar, autorizar(ADMIN, SEC), validarCobroMasivo, generarCobrosMasivo);
router.post('/cobros',             autenticar, autorizar(ADMIN, SEC), validarCobro, crearCobro);
router.patch('/cobros/:id/pagar',    autenticar, autorizar(ADMIN, SEC), validarMarcarPagado, marcarPagado);
router.patch('/cobros/:id/exonerar', autenticar, autorizar(ADMIN), validarExonerar, exonerarCobro);

// PERÍODOS ACADÉMICOS AUTOMÁTICOS
import { previewPeriodos, confirmarPeriodos, listarConfiguraciones, validarPreview, validarConfirmar } from '../controllers/periodos.controller';
router.get('/periodos/preview',        autenticar, autorizar(ADMIN), validarPreview, previewPeriodos);
router.post('/periodos/confirmar',     autenticar, autorizar(ADMIN), validarConfirmar, confirmarPeriodos);
router.get('/configuraciones-academicas', autenticar, autorizar(ADMIN), listarConfiguraciones);