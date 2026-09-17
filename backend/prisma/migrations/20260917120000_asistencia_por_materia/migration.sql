-- Asistencia por materia: antes había un solo registro por estudiante y día
-- (mañana/tarde), así que el segundo profesor del día pisaba lo del primero.
-- Ahora hay un registro por estudiante, día y materia, con un estado por clase.

-- 1) Columnas nuevas (nullable mientras se migran los datos existentes)
ALTER TABLE "registros_asistencia" ADD COLUMN "materia_id" TEXT;
ALTER TABLE "registros_asistencia" ADD COLUMN "estado" "EstadoAsistencia" NOT NULL DEFAULT 'PRESENTE';

-- 2) El estado de la clase es el peor del día: ausente > tarde > excusa > presente
UPDATE "registros_asistencia" SET "estado" = CASE
  WHEN 'AUSENTE' IN ("estado_manana", "estado_tarde") THEN 'AUSENTE'
  WHEN 'TARDE'   IN ("estado_manana", "estado_tarde") THEN 'TARDE'
  WHEN 'EXCUSA'  IN ("estado_manana", "estado_tarde") THEN 'EXCUSA'
  ELSE 'PRESENTE'
END::"EstadoAsistencia";

-- 3) La materia del registro es la que dicta ese profesor en el grado del estudiante
UPDATE "registros_asistencia" r SET "materia_id" = (
  SELECT mgp."materia_id"
  FROM "materia_grado_profesor" mgp
  JOIN "profesores" p ON p."id" = mgp."profesor_id"
  JOIN "estudiantes" e ON e."id" = r."estudiante_id"
  WHERE mgp."grado_id" = e."grado_id" AND p."usuario_id" = r."profesor_id"
  ORDER BY mgp."anio" DESC
  LIMIT 1
) WHERE r."materia_id" IS NULL;

-- 4) Si el profesor ya no tiene esa materia asignada, se usa cualquier materia del grado
UPDATE "registros_asistencia" r SET "materia_id" = (
  SELECT mgp."materia_id"
  FROM "materia_grado_profesor" mgp
  JOIN "estudiantes" e ON e."id" = r."estudiante_id"
  WHERE mgp."grado_id" = e."grado_id"
  ORDER BY mgp."anio" DESC
  LIMIT 1
) WHERE r."materia_id" IS NULL;

-- 5) Registros de grados sin ninguna materia asignada: no hay a qué clase atribuirlos
DELETE FROM "registros_asistencia" WHERE "materia_id" IS NULL;

-- 6) Estructura final
ALTER TABLE "registros_asistencia" ALTER COLUMN "materia_id" SET NOT NULL;
ALTER TABLE "registros_asistencia" DROP COLUMN "estado_manana";
ALTER TABLE "registros_asistencia" DROP COLUMN "estado_tarde";

DROP INDEX IF EXISTS "registros_asistencia_estudiante_id_fecha_key";
CREATE UNIQUE INDEX "registros_asistencia_estudiante_id_fecha_materia_id_key"
  ON "registros_asistencia"("estudiante_id", "fecha", "materia_id");

ALTER TABLE "registros_asistencia"
  ADD CONSTRAINT "registros_asistencia_materia_id_fkey"
  FOREIGN KEY ("materia_id") REFERENCES "materias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
