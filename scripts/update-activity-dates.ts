
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to generate random date relative to today
function getDateOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

async function main() {
  console.log('Updating activity due dates for dashboard metrics...');

  const activities = await prisma.activity.findMany();
  console.log(`Found ${activities.length} activities to update.`);

  let updatedCount = 0;

  for (const activity of activities) {
    // Determine new status and due date randomly to populate "Vencido", "Por vencer", "Cumplido"
    
    const rand = Math.random();
    let newDueDate: Date;
    let newStatus = activity.status;

    if (rand < 0.33) {
      // VENCIDO (Overdue): 
      // Date MUST be in the past (e.g., yesterday to 30 days ago)
      // Status MUST be PENDING or IN_REVIEW (not APPROVED)
      newDueDate = getDateOffset(-Math.floor(Math.random() * 30) - 1); 
      if (newStatus === 'APPROVED') {
        newStatus = 'PENDING'; 
      }
    } else if (rand < 0.66) {
      // POR VENCER (Due soon): 
      // Date MUST be today or in next 7 days
      // Status MUST be PENDING or IN_REVIEW
      newDueDate = getDateOffset(Math.floor(Math.random() * 7)); 
      if (newStatus === 'APPROVED') {
        newStatus = 'PENDING';
      }
    } else {
      // CUMPLIDO (Compliant):
      // Status MUST be APPROVED
      // Date doesn't matter for logic, but let's keep it reasonable
      newStatus = 'APPROVED';
      newDueDate = getDateOffset(Math.floor(Math.random() * 30) - 15);
    }

    await prisma.activity.update({
      where: { id: activity.id },
      data: {
        dueDate: newDueDate,
        status: newStatus
      }
    });
    updatedCount++;
  }

  console.log(`Successfully updated ${updatedCount} activities with varied due dates and statuses.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
