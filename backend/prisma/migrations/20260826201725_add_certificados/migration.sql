-- CreateEnum
CREATE TYPE "TipoCertificado" AS ENUM ('ESTUDIO', 'NOTAS', 'CONDUCTA', 'PAZ_Y_SALVO', 'DIPLOMA');

-- CreateEnum
CREATE TYPE "EstadoCertificado" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'LISTO', 'ENTREGADO');

-- CreateTable
CREATE TABLE "solicitudes_certificado" (
    "id" TEXT NOT NULL,
    "estudiante_id" TEXT NOT NULL,
    "padre_id" TEXT NOT NULL,
    "tipo_certificado" "TipoCertificado" NOT NULL,
    "estado" "EstadoCertificado" NOT NULL DEFAULT 'PENDIENTE',
    "observaciones" VARCHAR(300),
    "archivo_url" TEXT,
    "procesado_por" TEXT,
    "fecha_procesado" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitudes_certificado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitudes_certificado_estudiante_id_idx" ON "solicitudes_certificado"("estudiante_id");

-- CreateIndex
CREATE INDEX "solicitudes_certificado_estado_idx" ON "solicitudes_certificado"("estado");

-- AddForeignKey
ALTER TABLE "solicitudes_certificado" ADD CONSTRAINT "solicitudes_certificado_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "estudiantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_certificado" ADD CONSTRAINT "solicitudes_certificado_padre_id_fkey" FOREIGN KEY ("padre_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
