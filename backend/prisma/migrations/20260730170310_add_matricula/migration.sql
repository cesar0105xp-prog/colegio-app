/*
  Warnings:

  - A unique constraint covering the columns `[codigo_matricula]` on the table `estudiantes` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "estudiantes" ADD COLUMN     "codigo_matricula" TEXT;

-- CreateTable
CREATE TABLE "matriculas" (
    "id" TEXT NOT NULL,
    "estudiante_id" TEXT NOT NULL,
    "padre_id" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "pin_usado" BOOLEAN NOT NULL DEFAULT false,
    "estado_documentos" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "fecha_matricula" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verificado_por" TEXT,
    "fecha_verificacion" TIMESTAMP(3),
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matriculas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "matriculas_estudiante_id_key" ON "matriculas"("estudiante_id");

-- CreateIndex
CREATE UNIQUE INDEX "estudiantes_codigo_matricula_key" ON "estudiantes"("codigo_matricula");

-- AddForeignKey
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "estudiantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_padre_id_fkey" FOREIGN KEY ("padre_id") REFERENCES "padres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_verificado_por_fkey" FOREIGN KEY ("verificado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
