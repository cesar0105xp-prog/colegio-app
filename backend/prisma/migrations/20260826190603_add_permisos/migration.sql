-- CreateEnum
CREATE TYPE "MotivoPermiso" AS ENUM ('CITA_MEDICA', 'DILIGENCIA_FAMILIAR', 'VIAJE', 'ENFERMEDAD', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoPermiso" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateTable
CREATE TABLE "solicitudes_permiso" (
    "id" TEXT NOT NULL,
    "estudiante_id" TEXT NOT NULL,
    "padre_id" TEXT NOT NULL,
    "fecha_permiso" DATE NOT NULL,
    "motivo_codigo" "MotivoPermiso" NOT NULL,
    "descripcion" VARCHAR(500) NOT NULL,
    "estado" "EstadoPermiso" NOT NULL DEFAULT 'PENDIENTE',
    "revisado_por" TEXT,
    "fecha_revision" TIMESTAMP(3),
    "observacion_resp" VARCHAR(300),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitudes_permiso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitudes_permiso_estudiante_id_idx" ON "solicitudes_permiso"("estudiante_id");

-- CreateIndex
CREATE INDEX "solicitudes_permiso_estado_idx" ON "solicitudes_permiso"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "solicitudes_permiso_estudiante_id_fecha_permiso_key" ON "solicitudes_permiso"("estudiante_id", "fecha_permiso");

-- AddForeignKey
ALTER TABLE "solicitudes_permiso" ADD CONSTRAINT "solicitudes_permiso_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "estudiantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_permiso" ADD CONSTRAINT "solicitudes_permiso_padre_id_fkey" FOREIGN KEY ("padre_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
