-- Orden escolar de los grados. Ordenar por el nombre en texto deja "Cuarto"
-- antes que "Primero" y "Séptimo" antes que "Sexto"; desde ahora todo el
-- sistema ordena por este número y luego por grupo.

ALTER TABLE "grados" ADD COLUMN "orden" INTEGER NOT NULL DEFAULT 99;

UPDATE "grados" SET "orden" = CASE
  translate(lower("nombre"), 'áéíóúü', 'aeiouu')
    WHEN 'pre-jardin'  THEN 1
    WHEN 'prejardin'   THEN 1
    WHEN 'pre jardin'  THEN 1
    WHEN 'jardin'      THEN 2
    WHEN 'transicion'  THEN 3
    WHEN 'primero'     THEN 4
    WHEN 'segundo'     THEN 5
    WHEN 'tercero'     THEN 6
    WHEN 'cuarto'      THEN 7
    WHEN 'quinto'      THEN 8
    WHEN 'sexto'       THEN 9
    WHEN 'septimo'     THEN 10
    WHEN 'octavo'      THEN 11
    WHEN 'noveno'      THEN 12
    WHEN 'decimo'      THEN 13
    WHEN 'undecimo'    THEN 14
    WHEN 'once'        THEN 14
    ELSE 99
  END;

CREATE INDEX "grados_orden_grupo_idx" ON "grados"("orden", "grupo");
