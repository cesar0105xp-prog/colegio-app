-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('EXAMEN', 'TAREA', 'EVENTO_COLEGIO', 'FESTIVO', 'REUNION', 'OTRO');

-- CreateTable
CREATE TABLE "eventos_agenda" (
    "id" TEXT NOT NULL,
    "titulo" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(800),
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3),
    "tipo_evento" "TipoEvento" NOT NULL,
    "grado_id" TEXT,
    "creador_id" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eventos_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tareas_agenda" (
    "id" TEXT NOT NULL,
    "titulo" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(800),
    "fecha_entrega" TIMESTAMP(3) NOT NULL,
    "materia_id" TEXT NOT NULL,
    "grado_id" TEXT NOT NULL,
    "profesor_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tareas_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "eventos_agenda_fecha_inicio_idx" ON "eventos_agenda"("fecha_inicio");

-- CreateIndex
CREATE INDEX "eventos_agenda_grado_id_idx" ON "eventos_agenda"("grado_id");

-- CreateIndex
CREATE INDEX "tareas_agenda_fecha_entrega_idx" ON "tareas_agenda"("fecha_entrega");

-- CreateIndex
CREATE INDEX "tareas_agenda_grado_id_idx" ON "tareas_agenda"("grado_id");

-- AddForeignKey
ALTER TABLE "eventos_agenda" ADD CONSTRAINT "eventos_agenda_grado_id_fkey" FOREIGN KEY ("grado_id") REFERENCES "grados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_agenda" ADD CONSTRAINT "eventos_agenda_creador_id_fkey" FOREIGN KEY ("creador_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas_agenda" ADD CONSTRAINT "tareas_agenda_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "materias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas_agenda" ADD CONSTRAINT "tareas_agenda_grado_id_fkey" FOREIGN KEY ("grado_id") REFERENCES "grados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas_agenda" ADD CONSTRAINT "tareas_agenda_profesor_id_fkey" FOREIGN KEY ("profesor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
