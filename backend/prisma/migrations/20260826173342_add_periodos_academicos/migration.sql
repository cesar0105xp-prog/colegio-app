-- AlterTable
ALTER TABLE "periodos" ADD COLUMN     "config_id" TEXT,
ADD COLUMN     "peso" DECIMAL(5,2) NOT NULL DEFAULT 25.00;

-- CreateTable
CREATE TABLE "configuraciones_academicas" (
    "id" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuraciones_academicas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "configuraciones_academicas_anio_key" ON "configuraciones_academicas"("anio");

-- AddForeignKey
ALTER TABLE "periodos" ADD CONSTRAINT "periodos_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "configuraciones_academicas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
