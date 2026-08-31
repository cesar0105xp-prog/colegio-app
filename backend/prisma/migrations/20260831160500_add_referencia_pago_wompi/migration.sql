-- AlterTable
ALTER TABLE "cobros" ADD COLUMN "referencia_pago" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "cobros_referencia_pago_key" ON "cobros"("referencia_pago");
