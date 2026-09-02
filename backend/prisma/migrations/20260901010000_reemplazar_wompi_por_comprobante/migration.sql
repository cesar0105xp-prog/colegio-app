-- DropIndex (Wompi)
DROP INDEX IF EXISTS "cobros_referencia_pago_key";

-- AlterTable: quitar la columna de integración con Wompi
ALTER TABLE "cobros" DROP COLUMN IF EXISTS "referencia_pago";

-- AlterEnum: nuevo estado de cobro mientras se verifica un comprobante
ALTER TYPE "EstadoPago" ADD VALUE 'EN_VERIFICACION';

-- CreateEnum
CREATE TYPE "EstadoComprobante" AS ENUM ('PENDIENTE_VERIFICACION', 'APROBADO', 'RECHAZADO');

-- CreateTable
CREATE TABLE "comprobantes_pago" (
    "id" TEXT NOT NULL,
    "cobro_id" TEXT NOT NULL,
    "padre_id" TEXT NOT NULL,
    "archivo_url" TEXT NOT NULL,
    "nombre_original" TEXT NOT NULL,
    "observaciones" VARCHAR(200),
    "estado" "EstadoComprobante" NOT NULL DEFAULT 'PENDIENTE_VERIFICACION',
    "motivo_rechazo" VARCHAR(300),
    "verificado_por" TEXT,
    "fecha_verificacion" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comprobantes_pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comprobantes_pago_cobro_id_idx" ON "comprobantes_pago"("cobro_id");

-- CreateIndex
CREATE INDEX "comprobantes_pago_estado_idx" ON "comprobantes_pago"("estado");

-- AddForeignKey
ALTER TABLE "comprobantes_pago" ADD CONSTRAINT "comprobantes_pago_cobro_id_fkey" FOREIGN KEY ("cobro_id") REFERENCES "cobros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes_pago" ADD CONSTRAINT "comprobantes_pago_padre_id_fkey" FOREIGN KEY ("padre_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
