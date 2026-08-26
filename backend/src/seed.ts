import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { logger } from './utils/logger';

const prisma = new PrismaClient();

async function main() {
  const passwordAdmin = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';
  const hash = await bcrypt.hash(passwordAdmin, 12);

  const usuario = await prisma.usuario.create({
    data: {
      email: 'admin@colegio.com',
      passwordHash: hash,
      rol: 'ADMINISTRADOR',
      estado: 'ACTIVO',
      perfilAdmin: {
        create: {
          nombres: 'Administrador',
          apellidos: 'Principal',
        }
      }
    }
  });

  logger.info('Admin creado', { email: usuario.email });
}

main()
  .catch(err => logger.error('Error al ejecutar seed', { err }))
  .finally(() => prisma.$disconnect());
