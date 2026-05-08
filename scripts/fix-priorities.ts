
import { PrismaClient } from '@prisma/client';
// In scripts folder, so we need to go up one level
import { calculatePriority } from '../lib/priority-logic';

const prisma = new PrismaClient();

async function fixPriorities() {
  console.log('Fixing priorities based on due dates...');

  try {
    const activities = await prisma.activity.findMany({
        where: { dueDate: { not: null } },
        // Fetch all activities with a due date
    });

    console.log(`Checking ${activities.length} activities with due date...`);
    let updatedCount = 0;

    for (const activity of activities) {
        if (!activity.dueDate) continue;
        
        // calculatePriority expects a Date object
        const result = calculatePriority(activity.dueDate);
        
        // If current priority is different from calculated, update it
        // Note: activity.priority might be "Vencido", result.priority "Vencido"
        if (result.priority !== activity.priority) {
            await prisma.activity.update({
                where: { id: activity.id },
                data: { priority: result.priority }
            });
            updatedCount++;
            // console.log(`Updated ${activity.title}: ${activity.priority} -> ${result.priority}`);
        }
    }
    
    console.log(`Updated ${updatedCount} activities to match their due date logic.`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixPriorities();
