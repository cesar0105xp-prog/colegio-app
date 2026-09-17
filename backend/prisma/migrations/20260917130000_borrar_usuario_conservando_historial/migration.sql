-- Borrar un usuario desde administración sin perder el historial académico.
-- El autor de cada registro pasa a ser opcional: al borrar la cuenta, el registro
-- queda sin autor ("Profesor retirado" / "Sin acudiente") en vez de bloquear el
-- borrado o arrastrar notas y matrículas. Las asignaciones materia-grado del
-- profesor y los vínculos padre-hijo sí se borran con la cuenta.

-- ── Autor opcional ───────────────────────────────────────────────────────────
ALTER TABLE "actividades"            ALTER COLUMN "profesor_id"   DROP NOT NULL;
ALTER TABLE "observaciones"          ALTER COLUMN "profesor_id"   DROP NOT NULL;
ALTER TABLE "registros_asistencia"   ALTER COLUMN "profesor_id"   DROP NOT NULL;
ALTER TABLE "tareas_agenda"          ALTER COLUMN "profesor_id"   DROP NOT NULL;
ALTER TABLE "eventos_agenda"         ALTER COLUMN "creador_id"    DROP NOT NULL;
ALTER TABLE "comunicados"            ALTER COLUMN "creado_por_id" DROP NOT NULL;
ALTER TABLE "matriculas"             ALTER COLUMN "padre_id"      DROP NOT NULL;
ALTER TABLE "comprobantes_pago"      ALTER COLUMN "padre_id"      DROP NOT NULL;
ALTER TABLE "solicitudes_permiso"    ALTER COLUMN "padre_id"      DROP NOT NULL;
ALTER TABLE "solicitudes_certificado" ALTER COLUMN "padre_id"     DROP NOT NULL;

-- ── Al borrar la cuenta, el registro queda sin autor ─────────────────────────
ALTER TABLE "actividades" DROP CONSTRAINT "actividades_profesor_id_fkey";
ALTER TABLE "actividades" ADD CONSTRAINT "actividades_profesor_id_fkey"
  FOREIGN KEY ("profesor_id") REFERENCES "profesores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "observaciones" DROP CONSTRAINT "observaciones_profesor_id_fkey";
ALTER TABLE "observaciones" ADD CONSTRAINT "observaciones_profesor_id_fkey"
  FOREIGN KEY ("profesor_id") REFERENCES "profesores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "registros_asistencia" DROP CONSTRAINT "registros_asistencia_profesor_id_fkey";
ALTER TABLE "registros_asistencia" ADD CONSTRAINT "registros_asistencia_profesor_id_fkey"
  FOREIGN KEY ("profesor_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tareas_agenda" DROP CONSTRAINT "tareas_agenda_profesor_id_fkey";
ALTER TABLE "tareas_agenda" ADD CONSTRAINT "tareas_agenda_profesor_id_fkey"
  FOREIGN KEY ("profesor_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "eventos_agenda" DROP CONSTRAINT "eventos_agenda_creador_id_fkey";
ALTER TABLE "eventos_agenda" ADD CONSTRAINT "eventos_agenda_creador_id_fkey"
  FOREIGN KEY ("creador_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "comunicados" DROP CONSTRAINT "comunicados_creado_por_id_fkey";
ALTER TABLE "comunicados" ADD CONSTRAINT "comunicados_creado_por_id_fkey"
  FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "matriculas" DROP CONSTRAINT "matriculas_padre_id_fkey";
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_padre_id_fkey"
  FOREIGN KEY ("padre_id") REFERENCES "padres"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "comprobantes_pago" DROP CONSTRAINT "comprobantes_pago_padre_id_fkey";
ALTER TABLE "comprobantes_pago" ADD CONSTRAINT "comprobantes_pago_padre_id_fkey"
  FOREIGN KEY ("padre_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "solicitudes_permiso" DROP CONSTRAINT "solicitudes_permiso_padre_id_fkey";
ALTER TABLE "solicitudes_permiso" ADD CONSTRAINT "solicitudes_permiso_padre_id_fkey"
  FOREIGN KEY ("padre_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "solicitudes_certificado" DROP CONSTRAINT "solicitudes_certificado_padre_id_fkey";
ALTER TABLE "solicitudes_certificado" ADD CONSTRAINT "solicitudes_certificado_padre_id_fkey"
  FOREIGN KEY ("padre_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Las asignaciones de materia se borran junto con el profesor ──────────────
ALTER TABLE "materia_grado_profesor" DROP CONSTRAINT "materia_grado_profesor_profesor_id_fkey";
ALTER TABLE "materia_grado_profesor" ADD CONSTRAINT "materia_grado_profesor_profesor_id_fkey"
  FOREIGN KEY ("profesor_id") REFERENCES "profesores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
