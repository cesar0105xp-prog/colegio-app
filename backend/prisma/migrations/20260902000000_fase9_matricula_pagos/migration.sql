-- CreateEnum
CREATE TYPE "EstadoDocumentoArchivo" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "EstadoSolicitudCupo" AS ENUM ('PENDIENTE', 'CONTACTADO', 'MATRICULADO', 'DESCARTADO');

-- CreateTable
CREATE TABLE "solicitudes_cupo" (
    "id" TEXT NOT NULL,
    "nombre_estudiante" TEXT NOT NULL,
    "grado_interes" TEXT NOT NULL,
    "nombre_acudiente" TEXT NOT NULL,
    "telefono_acudiente" TEXT NOT NULL,
    "email_acudiente" TEXT NOT NULL,
    "estado" "EstadoSolicitudCupo" NOT NULL DEFAULT 'PENDIENTE',
    "observaciones" VARCHAR(300),
    "contactado_por" TEXT,
    "fecha_contacto" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solicitudes_cupo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitudes_cupo_estado_idx" ON "solicitudes_cupo"("estado");

-- AlterTable: matriculas — magic link, tracker de progreso, firma digital, pago del formulario
ALTER TABLE "matriculas"
  ADD COLUMN "solicitud_cupo_id" TEXT,
  ADD COLUMN "magic_link_token" TEXT,
  ADD COLUMN "magic_link_expiry" TIMESTAMP(3),
  ADD COLUMN "magic_link_used_at" TIMESTAMP(3),
  ADD COLUMN "fecha_formulario_completado" TIMESTAMP(3),
  ADD COLUMN "fecha_documentos_subidos" TIMESTAMP(3),
  ADD COLUMN "firma_digital_nombre" TEXT,
  ADD COLUMN "firma_digital_fecha" TIMESTAMP(3),
  ADD COLUMN "firma_digital_ip" TEXT,
  ADD COLUMN "formulario_pagado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "formulario_comprobante_url" TEXT,
  ADD COLUMN "formulario_referencia" TEXT,
  ADD COLUMN "formulario_fecha_pago" TIMESTAMP(3),
  ADD COLUMN "formulario_verificado_por" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "matriculas_solicitud_cupo_id_key" ON "matriculas"("solicitud_cupo_id");

-- CreateIndex
CREATE UNIQUE INDEX "matriculas_magic_link_token_key" ON "matriculas"("magic_link_token");

-- AddForeignKey
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_solicitud_cupo_id_fkey" FOREIGN KEY ("solicitud_cupo_id") REFERENCES "solicitudes_cupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: archivos — checklist de aprobación por documento
ALTER TABLE "archivos"
  ADD COLUMN "estado_revision" "EstadoDocumentoArchivo" NOT NULL DEFAULT 'PENDIENTE',
  ADD COLUMN "motivo_rechazo" VARCHAR(300),
  ADD COLUMN "revisado_por" TEXT,
  ADD COLUMN "fecha_revision" TIMESTAMP(3);

-- AlterTable: comprobantes_pago — referencia de transacción opcional (Nequi/transferencia)
ALTER TABLE "comprobantes_pago" ADD COLUMN "referencia_transaccion" VARCHAR(50);
