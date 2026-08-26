import { PrismaClient, Rol, TipoDocumento, Genero, EstadoEstudiante, TipoActividad, TipoObservacion, TipoDocumentoArchivo } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;
const ANIO = 2026;
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? './uploads';

const resumen = {
  usuarios: [] as string[],
  grados: [] as string[],
  materias: [] as string[],
  periodos: [] as string[],
  asignaciones: [] as string[],
  estudiantes: [] as string[],
  vinculos: [] as string[],
  actividades: [] as string[],
  calificaciones: 0,
  observaciones: [] as string[],
  observacionesVistas: 0,
  matriculas: [] as string[],
  contactosEmergencia: 0,
  datosAdicionales: 0,
  tiposDocumento: [] as string[],
  archivos: [] as string[],
  comunicados: [] as string[],
};

// ─── USUARIOS + PERFILES ──────────────────────────────────────────────────────

async function upsertSecretario(email: string, password: string, nombres: string, apellidos: string, telefono: string) {
  const existente = await prisma.usuario.findUnique({ where: { email }, include: { perfilSecretario: true } });
  if (existente) {
    resumen.usuarios.push(`${email} (SECRETARIO, ya existía)`);
    return existente;
  }
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const usuario = await prisma.usuario.create({
    data: {
      email,
      passwordHash,
      rol: Rol.SECRETARIO,
      estado: 'ACTIVO',
      perfilSecretario: { create: { nombres, apellidos, telefono } },
    },
    include: { perfilSecretario: true },
  });
  resumen.usuarios.push(`${email} (SECRETARIO)`);
  return usuario;
}

async function upsertProfesor(
  email: string, password: string, nombres: string, apellidos: string,
  tipoDocumento: TipoDocumento, numeroDocumento: string, telefono: string, especialidad: string
) {
  const existente = await prisma.usuario.findUnique({ where: { email }, include: { perfilProfesor: true } });
  if (existente) {
    resumen.usuarios.push(`${email} (PROFESOR, ya existía)`);
    return existente;
  }
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const usuario = await prisma.usuario.create({
    data: {
      email,
      passwordHash,
      rol: Rol.PROFESOR,
      estado: 'ACTIVO',
      perfilProfesor: { create: { nombres, apellidos, tipoDocumento, numeroDocumento, telefono, especialidad } },
    },
    include: { perfilProfesor: true },
  });
  resumen.usuarios.push(`${email} (PROFESOR)`);
  return usuario;
}

async function upsertPadre(
  email: string, password: string, nombres: string, apellidos: string,
  tipoDocumento: TipoDocumento, numeroDocumento: string, telefono: string, direccion: string, ocupacion: string
) {
  const existente = await prisma.usuario.findUnique({ where: { email }, include: { perfilPadre: true } });
  if (existente) {
    resumen.usuarios.push(`${email} (PADRE, ya existía)`);
    return existente;
  }
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const usuario = await prisma.usuario.create({
    data: {
      email,
      passwordHash,
      rol: Rol.PADRE,
      estado: 'ACTIVO',
      perfilPadre: { create: { nombres, apellidos, tipoDocumento, numeroDocumento, telefono, direccion, ocupacion, emailContacto: email } },
    },
    include: { perfilPadre: true },
  });
  resumen.usuarios.push(`${email} (PADRE)`);
  return usuario;
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Iniciando seed de datos de prueba...\n');

  // 1. Usuarios base ------------------------------------------------------------
  const usuarioSecretario = await upsertSecretario(
    'adhara@gmail.com', 'Adhara2026!', 'Adhara', 'Ramírez', '3012345670'
  );
  const usuarioProfesor = await upsertProfesor(
    'tadashmelo747@gmail.com', 'Cesar2026!', 'Cesar', 'Meléndez',
    TipoDocumento.CC, '1020304050', '3009876543', 'Matemáticas y Ciencias Naturales'
  );
  const usuarioPadre1 = await upsertPadre(
    'adhagely@gmail.com', 'Adhara2026!', 'Adhagely', 'Torres',
    TipoDocumento.CC, '1122334455', '3111234567', 'Calle 10 # 20-30, Bogotá', 'Comerciante'
  );
  const usuarioPadre2 = await upsertPadre(
    'cesar0105xp@gmail.com', 'Camilo2026!', 'Cesar', 'Pérez',
    TipoDocumento.CC, '1122334466', '3122345678', 'Carrera 45 # 12-08, Bogotá', 'Ingeniero'
  );
  const usuarioPadre3 = await upsertPadre(
    'gdmaster747@gmail.com', 'Jose2026!', 'Jose', 'González',
    TipoDocumento.CC, '1122334477', '3133456789', 'Avenida 68 # 30-15, Bogotá', 'Comerciante'
  );

  const profesor = await prisma.profesor.findUniqueOrThrow({ where: { usuarioId: usuarioProfesor.id } });
  const secretario = await prisma.secretario.findUniqueOrThrow({ where: { usuarioId: usuarioSecretario.id } });
  const padre1 = await prisma.padre.findUniqueOrThrow({ where: { usuarioId: usuarioPadre1.id } }); // Adhagely
  const padre2 = await prisma.padre.findUniqueOrThrow({ where: { usuarioId: usuarioPadre2.id } }); // Cesar
  const padre3 = await prisma.padre.findUniqueOrThrow({ where: { usuarioId: usuarioPadre3.id } }); // Jose

  // 2. Grados ---------------------------------------------------------------------
  async function upsertGrado(nombre: string, grupo: string, nivel: string, anio: number) {
    const grado = await prisma.grado.upsert({
      where: { nombre_grupo_anio: { nombre, grupo, anio } },
      update: {},
      create: { nombre, grupo, nivel, anio },
    });
    resumen.grados.push(`${nombre} ${grupo} (${anio})`);
    return grado;
  }
  const gradoPrimeroA = await upsertGrado('Primero', 'A', 'primaria', ANIO);
  const gradoSegundoA = await upsertGrado('Segundo', 'A', 'primaria', ANIO);
  const gradoTerceroB = await upsertGrado('Tercero', 'B', 'primaria', ANIO);

  // 3. Materias ---------------------------------------------------------------------
  async function upsertMateria(nombre: string, codigo: string) {
    const materia = await prisma.materia.upsert({
      where: { nombre },
      update: {},
      create: { nombre, codigo },
    });
    resumen.materias.push(`${nombre} (${codigo})`);
    return materia;
  }
  const materiaMatematicas = await upsertMateria('Matemáticas', 'MAT-01');
  const materiaCiencias = await upsertMateria('Ciencias Naturales', 'CIE-01');
  await upsertMateria('Español', 'ESP-01');
  await upsertMateria('Inglés', 'ING-01');

  // 4. Periodos ---------------------------------------------------------------------
  async function upsertPeriodo(nombre: string, numero: number, anio: number, fechaInicio: Date, fechaFin: Date, activo: boolean) {
    const periodo = await prisma.periodo.upsert({
      where: { numero_anio: { numero, anio } },
      update: {},
      create: { nombre, numero, anio, fechaInicio, fechaFin, activo },
    });
    resumen.periodos.push(`${nombre} ${anio}`);
    return periodo;
  }
  const periodo1 = await upsertPeriodo('Primer Periodo', 1, ANIO, new Date(`${ANIO}-01-20`), new Date(`${ANIO}-04-10`), true);
  await upsertPeriodo('Segundo Periodo', 2, ANIO, new Date(`${ANIO}-04-13`), new Date(`${ANIO}-06-30`), false);

  // 5. Vincular profesor con materia + grado (asignaciones) ------------------------
  async function upsertAsignacion(materiaId: string, gradoId: string, profesorId: string, anio: number, etiqueta: string) {
    const asignacion = await prisma.materiaGradoProfesor.upsert({
      where: { materiaId_gradoId_anio: { materiaId, gradoId, anio } },
      update: { profesorId },
      create: { materiaId, gradoId, profesorId, anio },
    });
    resumen.asignaciones.push(etiqueta);
    return asignacion;
  }
  const asigMatePrimeroA = await upsertAsignacion(materiaMatematicas.id, gradoPrimeroA.id, profesor.id, ANIO, 'Matemáticas - Primero A');
  const asigCienciasSegundoA = await upsertAsignacion(materiaCiencias.id, gradoSegundoA.id, profesor.id, ANIO, 'Ciencias Naturales - Segundo A');
  const asigMateTerceroB = await upsertAsignacion(materiaMatematicas.id, gradoTerceroB.id, profesor.id, ANIO, 'Matemáticas - Tercero B');

  // 6. Estudiantes --------------------------------------------------------------------
  interface DatosEstudiante {
    nombres: string; apellidos: string; numeroDocumento: string; fechaNacimiento: string;
    genero: Genero; gradoId: string; estado: EstadoEstudiante; codigoMatricula: string;
  }
  async function upsertEstudiante(d: DatosEstudiante) {
    const estudiante = await prisma.estudiante.upsert({
      where: { numeroDocumento: d.numeroDocumento },
      update: {},
      create: {
        nombres: d.nombres, apellidos: d.apellidos, tipoDocumento: TipoDocumento.TI,
        numeroDocumento: d.numeroDocumento, fechaNacimiento: new Date(d.fechaNacimiento),
        genero: d.genero, gradoId: d.gradoId, estado: d.estado, codigoMatricula: d.codigoMatricula,
        direccion: 'Bogotá, Colombia',
      },
    });
    resumen.estudiantes.push(`${d.nombres} ${d.apellidos}`);
    return estudiante;
  }

  const sofia = await upsertEstudiante({
    nombres: 'Sofía', apellidos: 'Torres Pérez', numeroDocumento: '1001234501', fechaNacimiento: '2018-03-12',
    genero: Genero.FEMENINO, gradoId: gradoPrimeroA.id, estado: EstadoEstudiante.ACTIVO, codigoMatricula: `${ANIO}-001`,
  });
  const mateo = await upsertEstudiante({
    nombres: 'Mateo', apellidos: 'Torres Ramírez', numeroDocumento: '1001234502', fechaNacimiento: '2017-07-22',
    genero: Genero.MASCULINO, gradoId: gradoPrimeroA.id, estado: EstadoEstudiante.ACTIVO, codigoMatricula: `${ANIO}-002`,
  });
  const camilo = await upsertEstudiante({
    nombres: 'Camilo', apellidos: 'Pérez Rojas', numeroDocumento: '1001234503', fechaNacimiento: '2016-11-05',
    genero: Genero.MASCULINO, gradoId: gradoSegundoA.id, estado: EstadoEstudiante.ACTIVO, codigoMatricula: `${ANIO}-003`,
  });
  const valentina = await upsertEstudiante({
    nombres: 'Valentina', apellidos: 'Pérez Rojas', numeroDocumento: '1001234504', fechaNacimiento: '2015-02-18',
    genero: Genero.FEMENINO, gradoId: gradoSegundoA.id, estado: EstadoEstudiante.INACTIVO, codigoMatricula: `${ANIO}-004`,
  });
  const daniela = await upsertEstudiante({
    nombres: 'Daniela', apellidos: 'González Ruiz', numeroDocumento: '1001234505', fechaNacimiento: '2016-09-30',
    genero: Genero.FEMENINO, gradoId: gradoSegundoA.id, estado: EstadoEstudiante.ACTIVO, codigoMatricula: `${ANIO}-005`,
  });
  const andres = await upsertEstudiante({
    nombres: 'Andrés', apellidos: 'González Ruiz', numeroDocumento: '1001234506', fechaNacimiento: '2014-05-14',
    genero: Genero.MASCULINO, gradoId: gradoTerceroB.id, estado: EstadoEstudiante.INACTIVO, codigoMatricula: `${ANIO}-006`,
  });
  const isabella = await upsertEstudiante({
    nombres: 'Isabella', apellidos: 'González Ruiz', numeroDocumento: '1001234507', fechaNacimiento: '2013-12-01',
    genero: Genero.FEMENINO, gradoId: gradoTerceroB.id, estado: EstadoEstudiante.ACTIVO, codigoMatricula: `${ANIO}-007`,
  });

  // 7. Vínculos padre-estudiante --------------------------------------------------
  async function upsertVinculo(padreId: string, estudianteId: string, parentesco: string, esPrincipal: boolean, etiqueta: string) {
    await prisma.padreEstudiante.upsert({
      where: { padreId_estudianteId: { padreId, estudianteId } },
      update: {},
      create: { padreId, estudianteId, parentesco, esPrincipal },
    });
    resumen.vinculos.push(etiqueta);
  }
  await upsertVinculo(padre1.id, sofia.id, 'madre', true, 'Adhagely (madre) — Sofía');
  await upsertVinculo(padre2.id, sofia.id, 'padre', false, 'Cesar Pérez (padre) — Sofía [custodia compartida]');
  await upsertVinculo(padre1.id, mateo.id, 'madre', true, 'Adhagely (madre) — Mateo');
  await upsertVinculo(padre2.id, camilo.id, 'padre', true, 'Cesar Pérez (padre) — Camilo');
  await upsertVinculo(padre2.id, valentina.id, 'padre', true, 'Cesar Pérez (padre) — Valentina');
  await upsertVinculo(padre3.id, daniela.id, 'padre', true, 'Jose González (padre) — Daniela');
  await upsertVinculo(padre3.id, andres.id, 'padre', true, 'Jose González (padre) — Andrés');
  await upsertVinculo(padre3.id, isabella.id, 'padre', true, 'Jose González (padre) — Isabella');

  // 8. Actividades ------------------------------------------------------------------
  async function upsertActividad(
    nombre: string, tipo: TipoActividad, porcentaje: number, materiaId: string, gradoId: string, periodoId: string, profesorId: string
  ) {
    let actividad = await prisma.actividad.findFirst({ where: { nombre, materiaId, gradoId, periodoId } });
    if (!actividad) {
      actividad = await prisma.actividad.create({
        data: { nombre, tipo, porcentaje, materiaId, gradoId, periodoId, profesorId, descripcion: `${nombre} correspondiente al ${periodo1.nombre}` },
      });
    }
    resumen.actividades.push(nombre);
    return actividad;
  }

  const actMateP1Taller = await upsertActividad('Taller de sumas y restas', TipoActividad.TALLER, 30, materiaMatematicas.id, gradoPrimeroA.id, periodo1.id, profesor.id);
  const actMateP1Examen = await upsertActividad('Examen primer corte', TipoActividad.EXAMEN, 40, materiaMatematicas.id, gradoPrimeroA.id, periodo1.id, profesor.id);
  const actCienciasS1Quiz = await upsertActividad('Quiz de seres vivos', TipoActividad.QUIZ, 25, materiaCiencias.id, gradoSegundoA.id, periodo1.id, profesor.id);
  const actCienciasS1Examen = await upsertActividad('Examen primer corte', TipoActividad.EXAMEN, 40, materiaCiencias.id, gradoSegundoA.id, periodo1.id, profesor.id);
  const actMateT1Taller = await upsertActividad('Taller de multiplicación', TipoActividad.TALLER, 30, materiaMatematicas.id, gradoTerceroB.id, periodo1.id, profesor.id);
  const actMateT1Quiz = await upsertActividad('Quiz de tablas', TipoActividad.QUIZ, 25, materiaMatematicas.id, gradoTerceroB.id, periodo1.id, profesor.id);

  // 9. Calificaciones (solo estudiantes activos matriculados en el grado) -----------
  async function upsertCalificacion(actividadId: string, estudianteId: string, valor: number) {
    await prisma.calificacion.upsert({
      where: { actividadId_estudianteId: { actividadId, estudianteId } },
      update: {},
      create: { actividadId, estudianteId, valor },
    });
    resumen.calificaciones++;
  }
  // Primero A: Sofía, Mateo
  await upsertCalificacion(actMateP1Taller.id, sofia.id, 95);
  await upsertCalificacion(actMateP1Examen.id, sofia.id, 90);
  await upsertCalificacion(actMateP1Taller.id, mateo.id, 70);
  await upsertCalificacion(actMateP1Examen.id, mateo.id, 62);
  // Segundo A activos: Camilo, Daniela (Valentina está INACTIVO, sin matrícula verificada)
  await upsertCalificacion(actCienciasS1Quiz.id, camilo.id, 80);
  await upsertCalificacion(actCienciasS1Examen.id, camilo.id, 75);
  await upsertCalificacion(actCienciasS1Quiz.id, daniela.id, 98);
  await upsertCalificacion(actCienciasS1Examen.id, daniela.id, 94);
  // Tercero B activos: Isabella (Andrés está INACTIVO, matrícula pendiente)
  await upsertCalificacion(actMateT1Taller.id, isabella.id, 100);
  await upsertCalificacion(actMateT1Quiz.id, isabella.id, 96);

  // 10. Observaciones -----------------------------------------------------------------
  async function upsertObservacion(
    estudianteId: string, profesorId: string, tipo: TipoObservacion, descripcion: string, materiaId: string | null, etiqueta: string
  ) {
    let observacion = await prisma.observacion.findFirst({ where: { estudianteId, descripcion } });
    if (!observacion) {
      observacion = await prisma.observacion.create({
        data: { estudianteId, profesorId, tipo, descripcion, materiaId: materiaId ?? undefined },
      });
    }
    resumen.observaciones.push(etiqueta);
    return observacion;
  }
  const obsSofia = await upsertObservacion(
    sofia.id, profesor.id, TipoObservacion.POSITIVA,
    'Sofía mostró excelente disposición y resolvió todos los ejercicios de la clase de matemáticas correctamente.',
    materiaMatematicas.id, 'Sofía — POSITIVA'
  );
  const obsMateo = await upsertObservacion(
    mateo.id, profesor.id, TipoObservacion.ACADEMICA,
    'Mateo necesita refuerzo en el proceso de restas con préstamo, se recomienda práctica adicional en casa.',
    materiaMatematicas.id, 'Mateo — ACADEMICA'
  );
  const obsCamilo = await upsertObservacion(
    camilo.id, profesor.id, TipoObservacion.DISCIPLINARIA,
    'Camilo interrumpió la clase de forma reiterada, se conversó con él sobre las normas de convivencia.',
    null, 'Camilo — DISCIPLINARIA'
  );
  const obsDaniela = await upsertObservacion(
    daniela.id, profesor.id, TipoObservacion.CONVIVENCIA,
    'Daniela ayudó activamente a sus compañeros durante el trabajo en equipo de la clase de ciencias.',
    materiaCiencias.id, 'Daniela — CONVIVENCIA'
  );
  const obsIsabella = await upsertObservacion(
    isabella.id, profesor.id, TipoObservacion.POSITIVA,
    'Isabella obtuvo la nota más alta del grupo en el examen del primer periodo.',
    materiaMatematicas.id, 'Isabella — POSITIVA'
  );

  // 11. Observaciones vistas (algunas leídas, otras no, para probar el badge) -----------
  async function marcarVista(observacionId: string, padreId: string) {
    await prisma.observacionVista.upsert({
      where: { observacionId_padreId: { observacionId, padreId } },
      update: {},
      create: { observacionId, padreId },
    });
    resumen.observacionesVistas++;
  }
  await marcarVista(obsSofia.id, padre1.id);
  await marcarVista(obsMateo.id, padre1.id);
  await marcarVista(obsCamilo.id, padre2.id);
  await marcarVista(obsIsabella.id, padre3.id);
  // obsDaniela queda sin marcar como vista intencionalmente (para probar estado "no leído")

  // 12. Matrículas ------------------------------------------------------------------
  async function generarPin(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pin = '';
    for (let i = 0; i < 8; i++) pin += chars[Math.floor(Math.random() * chars.length)];
    return bcrypt.hash(pin, 10);
  }
  async function upsertMatricula(
    estudianteId: string, padreId: string, estadoDocumentos: string, verificadoPor: string | null, observaciones: string | null, etiqueta: string
  ) {
    await prisma.matricula.upsert({
      where: { estudianteId },
      update: {},
      create: {
        estudianteId, padreId, pin: await generarPin(), pinUsado: verificadoPor !== null,
        estadoDocumentos, verificadoPor: verificadoPor ?? undefined,
        fechaVerificacion: verificadoPor ? new Date() : undefined, observaciones: observaciones ?? undefined,
      },
    });
    resumen.matriculas.push(etiqueta);
  }
  await upsertMatricula(sofia.id, padre1.id, 'VERIFICADO', usuarioSecretario.id, null, 'Sofía — VERIFICADO');
  await upsertMatricula(mateo.id, padre1.id, 'VERIFICADO', usuarioSecretario.id, null, 'Mateo — VERIFICADO');
  await upsertMatricula(camilo.id, padre2.id, 'VERIFICADO', usuarioSecretario.id, null, 'Camilo — VERIFICADO');
  await upsertMatricula(valentina.id, padre2.id, 'RECHAZADO', usuarioSecretario.id, 'Falta certificado de afiliación a EPS', 'Valentina — RECHAZADO');
  await upsertMatricula(daniela.id, padre3.id, 'VERIFICADO', usuarioSecretario.id, null, 'Daniela — VERIFICADO');
  await upsertMatricula(andres.id, padre3.id, 'PENDIENTE', null, null, 'Andrés — PENDIENTE');
  await upsertMatricula(isabella.id, padre3.id, 'VERIFICADO', usuarioSecretario.id, null, 'Isabella — VERIFICADO');

  // 13. Contactos de emergencia -------------------------------------------------------
  async function upsertContacto(estudianteId: string, nombres: string, apellidos: string, parentesco: string, telefono: string) {
    const existe = await prisma.contactoEmergencia.findFirst({ where: { estudianteId, orden: 1 } });
    if (!existe) {
      await prisma.contactoEmergencia.create({ data: { estudianteId, nombres, apellidos, parentesco, telefono, orden: 1 } });
    }
    resumen.contactosEmergencia++;
  }
  await upsertContacto(sofia.id, 'Marleny', 'Torres', 'abuela', '3151234567');
  await upsertContacto(mateo.id, 'Marleny', 'Torres', 'abuela', '3151234567');
  await upsertContacto(camilo.id, 'Rosa', 'Rojas', 'tia', '3162345678');
  await upsertContacto(valentina.id, 'Rosa', 'Rojas', 'tia', '3162345678');
  await upsertContacto(daniela.id, 'Marta', 'Ruiz', 'madre', '3173456789');
  await upsertContacto(andres.id, 'Marta', 'Ruiz', 'madre', '3173456789');
  await upsertContacto(isabella.id, 'Marta', 'Ruiz', 'madre', '3173456789');

  // 14. Datos adicionales (salud) -------------------------------------------------------
  async function upsertDatosAdicionales(estudianteId: string, eps: string, grupoSanguineo: string, alergias: string | null) {
    await prisma.datosAdicionales.upsert({
      where: { estudianteId },
      update: {},
      create: { estudianteId, eps, grupoSanguineo, alergias: alergias ?? undefined, contactoMedico: 'Dr. Camilo Reyes', telefonoMedico: '3181234567' },
    });
    resumen.datosAdicionales++;
  }
  await upsertDatosAdicionales(sofia.id, 'Sura EPS', 'O+', null);
  await upsertDatosAdicionales(mateo.id, 'Sura EPS', 'O+', 'Alergia a la penicilina');
  await upsertDatosAdicionales(camilo.id, 'Nueva EPS', 'A+', null);
  await upsertDatosAdicionales(valentina.id, 'Nueva EPS', 'A+', 'Alergia al polen');
  await upsertDatosAdicionales(daniela.id, 'Sanitas EPS', 'B+', null);
  await upsertDatosAdicionales(andres.id, 'Sanitas EPS', 'O-', null);
  await upsertDatosAdicionales(isabella.id, 'Sanitas EPS', 'AB+', 'Asma leve');

  // 15. Tipos de documento requerido -----------------------------------------------------
  async function upsertTipoDocumento(nombre: string, obligatorio: boolean, orden: number, descripcion?: string) {
    let tipo = await prisma.tipoDocumentoRequerido.findFirst({ where: { nombre } });
    if (!tipo) {
      tipo = await prisma.tipoDocumentoRequerido.create({ data: { nombre, obligatorio, orden, descripcion } });
    }
    resumen.tiposDocumento.push(nombre);
    return tipo;
  }
  const tipoRegistroCivil = await upsertTipoDocumento('Registro Civil de Nacimiento', true, 1);
  await upsertTipoDocumento('Fotocopia Documento de Identidad', true, 2);
  await upsertTipoDocumento('Certificado de Afiliación a EPS', true, 3);
  await upsertTipoDocumento('Carné de Vacunación', false, 4, 'Opcional para estudiantes de primaria');
  await upsertTipoDocumento('Foto tipo documento', true, 5);

  // 16. Archivos de ejemplo (con archivo físico real en UPLOAD_DIR) -----------------------
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  async function upsertArchivo(
    estudianteId: string, subidoPorPadreId: string, tipoDocumentoId: string, nombreArchivoBase: string, etiqueta: string
  ) {
    const nombreArchivo = `${nombreArchivoBase}.pdf`;
    const existente = await prisma.archivo.findUnique({ where: { nombreArchivo } });
    if (existente) { resumen.archivos.push(`${etiqueta} (ya existía)`); return; }

    const rutaAbsoluta = path.join(UPLOAD_DIR, nombreArchivo);
    const contenido = `Documento de prueba generado por el seed - ${etiqueta}`;
    fs.writeFileSync(rutaAbsoluta, contenido);
    const tamanoBytes = fs.statSync(rutaAbsoluta).size;

    await prisma.archivo.create({
      data: {
        estudianteId, subidoPorPadreId, tipoDocumentoId,
        tipo: TipoDocumentoArchivo.CERTIFICADO,
        nombreOriginal: `${nombreArchivoBase}.pdf`,
        nombreArchivo, ruta: rutaAbsoluta, mimeType: 'application/pdf', tamanoBytes,
        descripcion: `Registro civil de ${etiqueta}`, visibleParaPadre: true,
      },
    });
    resumen.archivos.push(etiqueta);
  }
  await upsertArchivo(sofia.id, padre1.id, tipoRegistroCivil.id, 'seed-registro-civil-sofia-torres', 'Sofía Torres');
  await upsertArchivo(camilo.id, padre2.id, tipoRegistroCivil.id, 'seed-registro-civil-camilo-perez', 'Camilo Pérez');

  // 17. Comunicados ------------------------------------------------------------------------
  async function upsertComunicado(titulo: string, mensaje: string, destinatario: string, gradoId: string | null, creadoPorId: string, totalEnviados: number) {
    let comunicado = await prisma.comunicado.findFirst({ where: { titulo } });
    if (!comunicado) {
      comunicado = await prisma.comunicado.create({
        data: { titulo, mensaje, destinatario, gradoId: gradoId ?? undefined, creadoPorId, totalEnviados },
      });
    }
    resumen.comunicados.push(titulo);
    return comunicado;
  }
  await upsertComunicado(
    'Bienvenida al año escolar 2026', 'Damos la bienvenida a toda la comunidad educativa al año lectivo 2026. ¡Esperamos un excelente año!',
    'TODOS', null, usuarioSecretario.id, 3
  );
  await upsertComunicado(
    'Reunión de padres de familia - Primero A', 'Se cita a los padres de familia del grado Primero A a la reunión de entrega de informes el próximo viernes a las 6:00pm.',
    'GRADO', gradoPrimeroA.id, usuarioProfesor.id, 2
  );

  // 18. Auditoría (registro de accesos de ejemplo) --------------------------------------------
  const usuariosParaAuditoria = [usuarioSecretario, usuarioProfesor, usuarioPadre1, usuarioPadre2, usuarioPadre3];
  for (const u of usuariosParaAuditoria) {
    const yaExiste = await prisma.auditLog.findFirst({ where: { usuarioId: u.id, accion: 'LOGIN' } });
    if (!yaExiste) {
      await prisma.auditLog.create({ data: { usuarioId: u.id, accion: 'LOGIN', entidad: 'usuarios', entidadId: u.id } });
    }
  }

  // ─── RESUMEN ──────────────────────────────────────────────────────────────────
  console.log('Seed completado.\n');
  console.log('═══════════════════════════════════════════════════════');
  console.log('RESUMEN DE DATOS CREADOS / VERIFICADOS');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('USUARIOS:');
  resumen.usuarios.forEach(u => console.log(`  - ${u}`));

  console.log('\nGRADOS:');
  resumen.grados.forEach(g => console.log(`  - ${g}`));

  console.log('\nMATERIAS:');
  resumen.materias.forEach(m => console.log(`  - ${m}`));

  console.log('\nPERIODOS:');
  resumen.periodos.forEach(p => console.log(`  - ${p}`));

  console.log('\nASIGNACIONES PROFESOR-MATERIA-GRADO:');
  resumen.asignaciones.forEach(a => console.log(`  - ${a}`));

  console.log('\nESTUDIANTES:');
  resumen.estudiantes.forEach(e => console.log(`  - ${e}`));

  console.log('\nVÍNCULOS PADRE-ESTUDIANTE:');
  resumen.vinculos.forEach(v => console.log(`  - ${v}`));

  console.log('\nACTIVIDADES:');
  resumen.actividades.forEach(a => console.log(`  - ${a}`));

  console.log(`\nCALIFICACIONES REGISTRADAS: ${resumen.calificaciones}`);

  console.log('\nOBSERVACIONES:');
  resumen.observaciones.forEach(o => console.log(`  - ${o}`));
  console.log(`  (Observaciones marcadas como vistas por un padre: ${resumen.observacionesVistas})`);

  console.log('\nMATRÍCULAS:');
  resumen.matriculas.forEach(m => console.log(`  - ${m}`));

  console.log(`\nCONTACTOS DE EMERGENCIA: ${resumen.contactosEmergencia}`);
  console.log(`DATOS ADICIONALES DE SALUD: ${resumen.datosAdicionales}`);

  console.log('\nTIPOS DE DOCUMENTO REQUERIDO:');
  resumen.tiposDocumento.forEach(t => console.log(`  - ${t}`));

  console.log('\nARCHIVOS DE EJEMPLO:');
  resumen.archivos.forEach(a => console.log(`  - ${a}`));

  console.log('\nCOMUNICADOS:');
  resumen.comunicados.forEach(c => console.log(`  - ${c}`));

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('CREDENCIALES DE PRUEBA');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Profesor    | tadashmelo747@gmail.com | Cesar2026!');
  console.log('  Secretario  | adhara@gmail.com        | Adhara2026!');
  console.log('  Padre 1     | adhagely@gmail.com       | Adhara2026!');
  console.log('  Padre 2     | cesar0105xp@gmail.com    | Camilo2026!');
  console.log('  Padre 3     | gdmaster747@gmail.com    | Jose2026!');
  console.log('═══════════════════════════════════════════════════════\n');
}

main()
  .catch((error) => {
    console.error('Error al ejecutar el seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
