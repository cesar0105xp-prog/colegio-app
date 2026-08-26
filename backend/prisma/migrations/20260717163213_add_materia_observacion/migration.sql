-- AlterTable
ALTER TABLE "observaciones" ADD COLUMN     "materia_id" TEXT;

-- AddForeignKey
ALTER TABLE "observaciones" ADD CONSTRAINT "observaciones_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "materias"("id") ON DELETE SET NULL ON UPDATE CASCADE;
