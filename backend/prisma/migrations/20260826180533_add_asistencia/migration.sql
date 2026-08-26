-- CreateEnum
CREATE TYPE "EstadoAsistencia" AS ENUM ('PRESENTE', 'AUSENTE', 'TARDE', 'EXCUSA');

-- CreateTable
CREATE TABLE "registros_asistencia" (
    "id" TEXT NOT NULL,
    "estudiante_id" TEXT NOT NULL,
    "profesor_id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "estado_manana" "EstadoAsistencia" NOT NULL DEFAULT 'PRESENTE',
    "estado_tarde" "EstadoAsistencia" NOT NULL DEFAULT 'PRESENTE',
    "observacion" VARCHAR(300),
    "justificada" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registros_asistencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registros_asistencia_estudiante_id_idx" ON "registros_asistencia"("estudiante_id");

-- CreateIndex
CREATE INDEX "registros_asistencia_fecha_idx" ON "registros_asistencia"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "registros_asistencia_estudiante_id_fecha_key" ON "registros_asistencia"("estudiante_id", "fecha");

-- AddForeignKey
ALTER TABLE "registros_asistencia" ADD CONSTRAINT "registros_asistencia_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "estudiantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_asistencia" ADD CONSTRAINT "registros_asistencia_profesor_id_fkey" FOREIGN KEY ("profesor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
