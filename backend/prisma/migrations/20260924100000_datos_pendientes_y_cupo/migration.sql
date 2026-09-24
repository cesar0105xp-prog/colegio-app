-- Importación masiva de estudiantes desde la planilla del colegio.
-- Los estudiantes entran con nombres, apellidos y grado; el resto de datos se
-- completa después uno por uno, así que:
--   * datos_pendientes marca a quienes les falta información;
--   * fecha de nacimiento y género quedan opcionales (mejor vacío que inventado).
-- Además, cada grado guarda un cupo máximo sugerido.

ALTER TABLE "estudiantes" ADD COLUMN "datos_pendientes" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "estudiantes" ALTER COLUMN "fecha_nacimiento" DROP NOT NULL;
ALTER TABLE "estudiantes" ALTER COLUMN "genero" DROP NOT NULL;

ALTER TABLE "grados" ADD COLUMN "cupo_maximo" INTEGER;
