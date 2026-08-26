-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'PAGADO', 'EXONERADO');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'BANCO_BOGOTA', 'PSE', 'NEQUI');

-- CreateTable
CREATE TABLE "conceptos_pago" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(300),
    "monto" DECIMAL(10,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conceptos_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cobros" (
    "id" TEXT NOT NULL,
    "estudiante_id" TEXT NOT NULL,
    "concepto_id" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "monto_cobrado" DECIMAL(10,2) NOT NULL,
    "estado_pago" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "fecha_pago" TIMESTAMP(3),
    "metodo_pago" "MetodoPago",
    "observaciones" VARCHAR(500),
    "registrado_por" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cobros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cobros_estudiante_id_idx" ON "cobros"("estudiante_id");

-- CreateIndex
CREATE INDEX "cobros_estado_pago_idx" ON "cobros"("estado_pago");

-- CreateIndex
CREATE INDEX "cobros_mes_anio_idx" ON "cobros"("mes", "anio");

-- AddForeignKey
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "estudiantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobros" ADD CONSTRAINT "cobros_concepto_id_fkey" FOREIGN KEY ("concepto_id") REFERENCES "conceptos_pago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
