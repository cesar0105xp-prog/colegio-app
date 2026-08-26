-- AlterTable
ALTER TABLE "padres" ADD COLUMN     "ocupacion" TEXT;

-- CreateTable
CREATE TABLE "datos_adicionales" (
    "id" TEXT NOT NULL,
    "estudiante_id" TEXT NOT NULL,
    "eps" TEXT,
    "grupo_sanguineo" TEXT,
    "alergias" TEXT,
    "condiciones_medicas" TEXT,
    "medicamentos" TEXT,
    "contacto_medico" TEXT,
    "telefono_medico" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "datos_adicionales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_documento_requerido" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "obligatorio" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tipos_documento_requerido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "datos_adicionales_estudiante_id_key" ON "datos_adicionales"("estudiante_id");

-- AddForeignKey
ALTER TABLE "datos_adicionales" ADD CONSTRAINT "datos_adicionales_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "estudiantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
