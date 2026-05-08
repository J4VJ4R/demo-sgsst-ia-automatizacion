
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migratePriorities() {
  console.log('Starting migration of priorities...');

  try {
    // Migrate "Alta" to "Vencido"
    const updateHigh = await prisma.activity.updateMany({
      where: { priority: 'Alta' },
      data: { priority: 'Vencido' },
    });
    console.log(`Updated ${updateHigh.count} activities from 'Alta' to 'Vencido'.`);

    // Migrate "Media" to "Por vencer"
    const updateMedium = await prisma.activity.updateMany({
      where: { priority: 'Media' },
      data: { priority: 'Por vencer' },
    });
    console.log(`Updated ${updateMedium.count} activities from 'Media' to 'Por vencer'.`);

    // Migrate "Baja" to "Cumplido"
    const updateLow = await prisma.activity.updateMany({
      where: { priority: 'Baja' },
      data: { priority: 'Cumplido' },
    });
    console.log(`Updated ${updateLow.count} activities from 'Baja' to 'Cumplido'.`);

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migratePriorities();
