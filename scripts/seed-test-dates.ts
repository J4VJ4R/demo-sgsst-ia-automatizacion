
import { PrismaClient } from '@prisma/client';
import { calculatePriority } from '../lib/priority-logic';

const prisma = new PrismaClient();

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

async function seedTestDates() {
  console.log('Seeding test dates and priorities...');

  try {
    // Fetch all activities
    const activities = await prisma.activity.findMany({
        select: { id: true, title: true }
    });

    console.log(`Found ${activities.length} activities.`);
    
    let updatedCount = 0;
    const today = new Date();
    // Normalize today
    today.setHours(0, 0, 0, 0);

    for (const activity of activities) {
        // Randomly assign a category
        const rand = Math.random();
        let daysToAdd = 0;
        
        if (rand < 0.33) {
            // Vencido: <= 15 days (including past)
            // Let's range from -30 to 15
            daysToAdd = getRandomInt(-30, 15);
        } else if (rand < 0.66) {
            // Por vencer: 16 to 30 days
            daysToAdd = getRandomInt(16, 30);
        } else {
            // Cumplido: > 30 days
            daysToAdd = getRandomInt(31, 90);
        }

        const newDueDate = addDays(today, daysToAdd);
        
        // Calculate priority based on this new date
        const result = calculatePriority(newDueDate);

        await prisma.activity.update({
            where: { id: activity.id },
            data: { 
                dueDate: newDueDate,
                priority: result.priority
            }
        });
        
        updatedCount++;
    }
    
    console.log(`Updated ${updatedCount} activities with distributed dates and priorities.`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedTestDates();
