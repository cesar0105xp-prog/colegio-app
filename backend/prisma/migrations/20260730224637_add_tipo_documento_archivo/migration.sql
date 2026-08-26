-- AlterTable
ALTER TABLE "archivos" ADD COLUMN     "tipo_documento_id" TEXT;

-- AddForeignKey
ALTER TABLE "archivos" ADD CONSTRAINT "archivos_tipo_documento_id_fkey" FOREIGN KEY ("tipo_documento_id") REFERENCES "tipos_documento_requerido"("id") ON DELETE SET NULL ON UPDATE CASCADE;
