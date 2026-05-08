
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count();
  const projectCount = await prisma.project.count();
  const activityCount = await prisma.activity.count();

  console.log(`Usuarios: ${userCount}`);
  console.log(`Empresas (Proyectos): ${projectCount}`);
  console.log(`Actividades: ${activityCount}`);

  if (projectCount > 0) {
    const projects = await prisma.project.findMany({ take: 5, select: { name: true } });
    console.log('Ejemplos de empresas:', projects.map(p => p.name));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
