-- Plan de estudios por grado: qué materias se ven en cada curso, tengan o no
-- docente asignado. Antes el boletín se armaba desde las asignaciones de
-- docentes, así que preescolar (sin asignaciones) salía vacío.

CREATE TABLE "plan_estudio" (
  "id"         TEXT NOT NULL,
  "grado_id"   TEXT NOT NULL,
  "materia_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "plan_estudio_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plan_estudio_grado_id_materia_id_key" ON "plan_estudio"("grado_id", "materia_id");

ALTER TABLE "plan_estudio" ADD CONSTRAINT "plan_estudio_grado_id_fkey"
  FOREIGN KEY ("grado_id") REFERENCES "grados"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_estudio" ADD CONSTRAINT "plan_estudio_materia_id_fkey"
  FOREIGN KEY ("materia_id") REFERENCES "materias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Punto de partida: las materias que hoy tienen docente en cada grado
INSERT INTO "plan_estudio" ("id", "grado_id", "materia_id")
SELECT gen_random_uuid()::text, mgp."grado_id", mgp."materia_id"
FROM (SELECT DISTINCT "grado_id", "materia_id" FROM "materia_grado_profesor") mgp
ON CONFLICT DO NOTHING;
