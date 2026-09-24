-- Importación de docentes y asignaciones.
--   * datos_pendientes: docente con correo o documento provisional.
--   * debe_cambiar_password: obliga a cambiar la contraseña temporal al entrar.

ALTER TABLE "profesores" ADD COLUMN "datos_pendientes" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "usuarios" ADD COLUMN "debe_cambiar_password" BOOLEAN NOT NULL DEFAULT false;
