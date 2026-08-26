import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('Admin123!', 12);
  
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
  
  console.log('✅ Admin creado:', usuario.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());