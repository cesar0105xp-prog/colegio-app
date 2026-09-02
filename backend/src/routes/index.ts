import { Router } from 'express';
import { Rol } from '@prisma/client';
import { login, logout, refreshToken, cambiarPassword, validarLogin, validarCambioPassword } from '../controllers/auth.controller';
import { listarEstudiantes, obtenerEstudiante, crearEstudiante, editarEstudiante, cambiarEstadoEstudiante, validarEstudiante } from '../controllers/estudiantes.controller';
import { listarUsuarios, obtenerUsuario, crearUsuario, editarUsuario, eliminarUsuario, cambiarEstadoUsuario, resetearPassword, validarCrearUsuario, validarEditarUsuario, miPerfil, editarMiPerfil, actualizarCorreo, validarEditarMiPerfil, validarActualizarCorreo } from '../controllers/usuarios.controller';
import { listarGrados, crearGrado, editarGrado, validarGrado, listarMaterias, crearMateria, editarMateria, eliminarMateria, validarMateria, asignarMateriaGrado, listarPeriodos, crearPeriodo, editarPeriodo, validarPeriodo, activarPeriodo, obtenerStats } from '../controllers/academico.controller';
import { crearActividad, listarActividades, registrarCalificacion, obtenerBoletin, validarActividad, validarCalificacion, editarActividad, eliminarActividad, validarEditarActividad } from '../controllers/calificaciones.controller';
import { crearObservacion, listarObservaciones, marcarObservacionVista, validarObservacion, eliminarObservacion, editarObservacion, validarEditarObservacion } from '../controllers/observaciones.controller';
import { subirArchivo, descargarArchivo, listarArchivos } from '../controllers/archivos.controller';
import { misHijos, miPerfilEstudiante } from '../controllers/padre.controller';
import { listarVinculos, crearVinculo, eliminarVinculo, validarVinculo } from '../controllers/vinculos.controller';
import { reporteBoletinesPorGrado, reporteRendimientoMateria, reporteEstudiantesDestacados, reporteObservacionesPendientes } from '../controllers/reportes.controller';
import { listarAuditoria } from '../controllers/auditoria.controller';
import { autenticar, autorizar, validarAccesoPadreEstudiante, validarAccesoEstudiante } from '../middlewares/auth.middleware';
import { uploadPDF, validarPDFReal } from '../middlewares/upload.middleware';

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
router.put('/usuarios/mi-perfil',               autenticar, autorizar(PROF), validarEditarMiPerfil, editarMiPerfil);
router.put('/usuarios/mi-correo',               autenticar, autorizar(PADRE), validarActualizarCorreo, actualizarCorreo);
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
router.put('/grados/:id',              autenticar, autorizar(ADMIN), validarGrado, editarGrado);
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
router.put('/actividades/:id',  autenticar, autorizar(ADMIN, PROF), validarEditarActividad, editarActividad);
router.delete('/actividades/:id', autenticar, autorizar(ADMIN, PROF), eliminarActividad);

// CALIFICACIONES
router.post('/calificaciones', autenticar, autorizar(ADMIN, PROF), validarCalificacion, registrarCalificacion);

// BOLETÍN
router.get('/boletin/:estudianteId', autenticar, autorizar(ADMIN, SEC, PROF, PADRE, EST), validarAccesoPadreEstudiante, validarAccesoEstudiante, obtenerBoletin);

// OBSERVACIONES
router.get('/observaciones/:estudianteId',          autenticar, autorizar(ADMIN, SEC, PROF, PADRE, EST), validarAccesoPadreEstudiante, validarAccesoEstudiante, listarObservaciones);
router.post('/observaciones',                       autenticar, autorizar(ADMIN, PROF), validarObservacion, crearObservacion);
router.put('/observaciones/:id',                    autenticar, autorizar(ADMIN, PROF), validarEditarObservacion, editarObservacion);
router.post('/observaciones/:observacionId/visto',  autenticar, autorizar(PADRE), marcarObservacionVista);
router.delete('/observaciones/:id',                 autenticar, autorizar(ADMIN, PROF), eliminarObservacion);

// ARCHIVOS
router.post('/archivos',                         autenticar, autorizar(ADMIN, SEC, PADRE), uploadPDF.single('archivo'), validarPDFReal, subirArchivo);
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
import { crearMatricula, listarMatriculas, verificarMatricula, rechazarMatricula, validarMatricula, accederConMagicLink, reenviarLink } from '../controllers/matriculas.controller';
router.get('/matriculas',                    autenticar, autorizar(ADMIN, SEC), listarMatriculas);
router.post('/matriculas',                   autenticar, autorizar(ADMIN, SEC), validarMatricula, crearMatricula);
router.patch('/matriculas/:id/verificar',    autenticar, autorizar(ADMIN, SEC), verificarMatricula);
router.patch('/matriculas/:id/rechazar',     autenticar, autorizar(ADMIN, SEC), rechazarMatricula);
router.get('/matriculas/acceso/:token',      accederConMagicLink);
router.patch('/matriculas/:id/reenviar-link', autenticar, autorizar(ADMIN, SEC), reenviarLink);

// DATOS ADICIONALES Y TIPOS DE DOCUMENTO
import { obtenerDatosAdicionales, guardarDatosAdicionales, validarDatosAdicionales, actualizarDatosPadre, validarDatosPadre, listarTiposDocumento, crearTipoDocumento, editarTipoDocumento, validarTipoDocumento } from '../controllers/datos_adicionales.controller';
router.get('/estudiantes/:estudianteId/datos-adicionales',  autenticar, autorizar(ADMIN, SEC, PROF, PADRE), obtenerDatosAdicionales);
router.put('/estudiantes/:estudianteId/datos-adicionales',  autenticar, autorizar(ADMIN, SEC, PADRE), validarDatosAdicionales, guardarDatosAdicionales);
router.put('/padre/mis-datos',                              autenticar, autorizar(PADRE), validarDatosPadre, actualizarDatosPadre);
router.get('/tipos-documento',                              autenticar, listarTiposDocumento);
router.post('/tipos-documento',                             autenticar, autorizar(ADMIN), validarTipoDocumento, crearTipoDocumento);
router.put('/tipos-documento/:id',                          autenticar, autorizar(ADMIN), validarTipoDocumento, editarTipoDocumento);

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
  reportarComprobante, listarComprobantes, verComprobanteArchivo, aprobarComprobante, rechazarComprobante,
  validarIdCobroPago, validarRechazarComprobante,
} from '../controllers/pagos.controller';
import { uploadComprobante, validarComprobanteReal } from '../middlewares/upload.middleware';

router.get('/conceptos',           autenticar, autorizar(ADMIN, SEC), listarConceptos);
router.post('/conceptos',          autenticar, autorizar(ADMIN), validarConceptoPago, crearConcepto);
router.put('/conceptos/:id',       autenticar, autorizar(ADMIN), validarConceptoPagoEditar, editarConcepto);
router.delete('/conceptos/:id',    autenticar, autorizar(ADMIN), validarIdConcepto, desactivarConcepto);

router.get('/cobros/reporte',      autenticar, autorizar(ADMIN, SEC), reporteCartera);
router.get('/cobros/mi-estado',    autenticar, autorizar(PADRE), miEstadoCuenta);
router.get('/cobros/exportar',     autenticar, autorizar(ADMIN), exportarCarteraCSV);
router.get('/cobros/comprobantes', autenticar, autorizar(ADMIN, SEC), listarComprobantes);
router.get('/cobros',              autenticar, autorizar(ADMIN, SEC), listarCobros);
router.post('/cobros/masivo',      autenticar, autorizar(ADMIN, SEC), validarCobroMasivo, generarCobrosMasivo);
router.post('/cobros',             autenticar, autorizar(ADMIN, SEC), validarCobro, crearCobro);
router.patch('/cobros/:id/pagar',    autenticar, autorizar(ADMIN, SEC), validarMarcarPagado, marcarPagado);
router.patch('/cobros/:id/exonerar', autenticar, autorizar(ADMIN), validarExonerar, exonerarCobro);

// COMPROBANTES DE PAGO (transferencia manual)
router.post('/cobros/:id/comprobante',             autenticar, autorizar(PADRE), uploadComprobante.single('archivo'), validarComprobanteReal, validarIdCobroPago, reportarComprobante);
router.get('/cobros/comprobantes/:id/archivo',     autenticar, autorizar(ADMIN, SEC, PADRE), verComprobanteArchivo);
router.patch('/cobros/comprobantes/:id/aprobar',   autenticar, autorizar(ADMIN, SEC), validarIdCobroPago, aprobarComprobante);
router.patch('/cobros/comprobantes/:id/rechazar',  autenticar, autorizar(ADMIN, SEC), validarRechazarComprobante, rechazarComprobante);

// PERÍODOS ACADÉMICOS AUTOMÁTICOS
import { previewPeriodos, confirmarPeriodos, listarConfiguraciones, validarPreview, validarConfirmar } from '../controllers/periodos.controller';
router.get('/periodos/preview',        autenticar, autorizar(ADMIN), validarPreview, previewPeriodos);
router.post('/periodos/confirmar',     autenticar, autorizar(ADMIN), validarConfirmar, confirmarPeriodos);
router.get('/configuraciones-academicas', autenticar, autorizar(ADMIN), listarConfiguraciones);

// ASISTENCIA
import {
  registrarAsistenciaGrado, listarAsistenciaGrado, editarAsistencia, historialEstudiante,
  reporteAusencias, alertasAusencias, validarAsistenciaGrado, validarEditarAsistencia,
} from '../controllers/asistencia.controller';
router.post('/asistencia/grado',                  autenticar, autorizar(PROF), validarAsistenciaGrado, registrarAsistenciaGrado);
router.get('/asistencia/grado/:gradoId',           autenticar, autorizar(PROF), listarAsistenciaGrado);
router.put('/asistencia/:id',                      autenticar, autorizar(PROF), validarEditarAsistencia, editarAsistencia);
router.get('/asistencia/estudiante/:estudianteId', autenticar, autorizar(ADMIN, PROF, PADRE), validarAccesoPadreEstudiante, historialEstudiante);
router.get('/asistencia/reporte',                  autenticar, autorizar(ADMIN), reporteAusencias);
router.get('/asistencia/alertas',                  autenticar, autorizar(ADMIN), alertasAusencias);

// PERMISOS Y AUSENCIAS
import {
  crearSolicitudPermiso, listarPermisos, misSolicitudesPermiso, aprobarPermiso, rechazarPermiso, historialPermisosEstudiante,
  validarSolicitudPermiso, validarAprobar, validarRechazar,
} from '../controllers/permisos.controller';
router.post('/permisos',                         autenticar, autorizar(PADRE), validarAccesoPadreEstudiante, validarSolicitudPermiso, crearSolicitudPermiso);
router.get('/permisos',                          autenticar, autorizar(ADMIN, SEC), listarPermisos);
router.get('/permisos/mis',                      autenticar, autorizar(PADRE), misSolicitudesPermiso);
router.patch('/permisos/:id/aprobar',            autenticar, autorizar(ADMIN, SEC), validarAprobar, aprobarPermiso);
router.patch('/permisos/:id/rechazar',           autenticar, autorizar(ADMIN, SEC), validarRechazar, rechazarPermiso);
router.get('/permisos/estudiante/:estudianteId', autenticar, autorizar(ADMIN, PROF), historialPermisosEstudiante);

// AGENDA ESCOLAR DIGITAL
import {
  listarAgenda, crearEvento, editarEvento, eliminarEvento, crearTarea, editarTarea, eliminarTarea, misTareas,
  validarEvento, validarTarea, validarId,
} from '../controllers/agenda.controller';
router.get('/agenda',              autenticar, autorizar(ADMIN, SEC, PROF, PADRE, EST), listarAgenda);
router.post('/agenda/eventos',     autenticar, autorizar(ADMIN, PROF), validarEvento, crearEvento);
router.put('/agenda/eventos/:id',  autenticar, autorizar(ADMIN, PROF), validarId, validarEvento, editarEvento);
router.delete('/agenda/eventos/:id', autenticar, autorizar(ADMIN), eliminarEvento);
router.post('/agenda/tareas',      autenticar, autorizar(PROF), validarTarea, crearTarea);
router.put('/agenda/tareas/:id',   autenticar, autorizar(ADMIN, PROF), validarId, validarTarea, editarTarea);
router.delete('/agenda/tareas/:id', autenticar, autorizar(ADMIN, PROF), eliminarTarea);
router.get('/agenda/mis-tareas',   autenticar, autorizar(PADRE), misTareas);

// CERTIFICADOS DESDE EL PORTAL
import {
  crearSolicitud, misSolicitudes, listarSolicitudes, procesarSolicitud, descargarCertificado,
  validarSolicitud, validarId as validarIdCertificado,
} from '../controllers/certificados.controller';
router.post('/certificados',                autenticar, autorizar(PADRE), validarAccesoPadreEstudiante, validarSolicitud, crearSolicitud);
router.get('/certificados/mis',             autenticar, autorizar(PADRE), misSolicitudes);
router.get('/certificados',                 autenticar, autorizar(ADMIN, SEC), listarSolicitudes);
router.patch('/certificados/:id/procesar',  autenticar, autorizar(ADMIN, SEC), uploadPDF.single('archivo'), validarPDFReal, validarIdCertificado, procesarSolicitud);
router.get('/certificados/:id/descargar',   autenticar, autorizar(PADRE), descargarCertificado);