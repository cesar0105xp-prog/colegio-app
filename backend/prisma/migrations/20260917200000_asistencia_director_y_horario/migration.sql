-- Quién llama a lista en cada grado.
--   DIRECTOR_FIJO    (preescolar a 4°): siempre el director de curso.
--   ROTATIVO_HORARIO (5° en adelante): el profesor de la primera clase del día.
-- Los grados existentes quedan como DIRECTOR_FIJO; administración ajusta el resto.

CREATE TYPE "TipoAsistencia" AS ENUM ('DIRECTOR_FIJO', 'ROTATIVO_HORARIO');

ALTER TABLE "grados" ADD COLUMN "tipo_asistencia" "TipoAsistencia" NOT NULL DEFAULT 'DIRECTOR_FIJO';
ALTER TABLE "grados" ADD COLUMN "director_curso_id" TEXT;

ALTER TABLE "grados" ADD CONSTRAINT "grados_director_curso_id_fkey"
  FOREIGN KEY ("director_curso_id") REFERENCES "profesores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Horario semanal: la franja marcada como primera clase define quién toma la
-- asistencia ese día en los grados rotativos.
CREATE TABLE "horarios_clase" (
  "id"               TEXT NOT NULL,
  "grado_id"         TEXT NOT NULL,
  "materia_id"       TEXT NOT NULL,
  "profesor_id"      TEXT NOT NULL,
  "dia_semana"       INTEGER NOT NULL,
  "hora_inicio"      VARCHAR(5) NOT NULL,
  "hora_fin"         VARCHAR(5) NOT NULL,
  "es_primera_clase" BOOLEAN NOT NULL DEFAULT false,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "horarios_clase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "horarios_clase_grado_id_dia_semana_idx" ON "horarios_clase"("grado_id", "dia_semana");
CREATE INDEX "horarios_clase_profesor_id_idx" ON "horarios_clase"("profesor_id");

-- Una sola primera clase por grado y día
CREATE UNIQUE INDEX "horarios_clase_primera_por_dia"
  ON "horarios_clase"("grado_id", "dia_semana") WHERE "es_primera_clase";

ALTER TABLE "horarios_clase" ADD CONSTRAINT "horarios_clase_grado_id_fkey"
  FOREIGN KEY ("grado_id") REFERENCES "grados"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "horarios_clase" ADD CONSTRAINT "horarios_clase_materia_id_fkey"
  FOREIGN KEY ("materia_id") REFERENCES "materias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "horarios_clase" ADD CONSTRAINT "horarios_clase_profesor_id_fkey"
  FOREIGN KEY ("profesor_id") REFERENCES "profesores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
