
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnosePriorities() {
  console.log('Diagnosing recent activities priorities...');

  try {
    const activities = await prisma.activity.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        priority: true,
        updatedAt: true,
        dueDate: true
      }
    });

    console.log('Total fetched:', activities.length);
    const counts: Record<string, number> = {};
    
    activities.forEach(a => {
        const p = a.priority || "NULL";
        counts[p] = (counts[p] || 0) + 1;
        // console.log(`[${a.updatedAt.toISOString()}] ${a.title} - Priority: ${a.priority}, Due: ${a.dueDate}`);
    });

    console.log('Priority distribution in top 50:', counts);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnosePriorities();
