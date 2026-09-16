import { PrismaClient } from '@prisma/client';

// Una sola instancia de PrismaClient por proceso, compartida por todo el backend.
// Cada instancia abre su propio pool de conexiones a PostgreSQL: con una por
// archivo (26 instancias), un solo proceso ya mantenía ~30 conexiones abiertas,
// y dos procesos en cluster (PM2) podían agotar max_connections = 100 bajo carga.
// Con esta instancia única cada proceso usa un solo pool (5 conexiones en 2 CPU).
export const prisma = new PrismaClient();
