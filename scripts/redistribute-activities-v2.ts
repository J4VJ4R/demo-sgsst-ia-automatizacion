
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log("Iniciando redistribución masiva de actividades...");

  try {
    const activities = await prisma.activity.findMany();
    console.log(`Encontradas ${activities.length} actividades.`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let countVencido = 0;
    let countPorVencer = 0;
    let countCumplido = 0;

    const updates = activities.map((activity) => {
      const rand = Math.random();
      let daysOffset = 0;
      let newPriority = "";
      let newStatus = "PENDING"; // Default to pending to test date logic

      // 40% Vencido (<= 15 days, including past)
      if (rand < 0.4) {
        // Random between -60 days (past) and 15 days (future close)
        daysOffset = randomInt(-60, 15);
        newPriority = "Vencido";
        // Ensure it's not APPROVED so it counts as Vencido
        newStatus = Math.random() > 0.8 ? "IN_REVIEW" : "PENDING";
        countVencido++;
      } 
      // 30% Por Vencer (16 - 30 days)
      else if (rand < 0.7) {
        daysOffset = randomInt(16, 30);
        newPriority = "Por vencer";
        newStatus = Math.random() > 0.8 ? "IN_REVIEW" : "PENDING";
        countPorVencer++;
      } 
      // 30% Cumplido (> 30 days)
      else {
        daysOffset = randomInt(31, 90);
        newPriority = "Cumplido";
        // Mix of APPROVED and PENDING
        // If APPROVED, it's automatically Cumplido in metrics.
        // If PENDING with >30 days, it's also Cumplido.
        newStatus = Math.random() > 0.5 ? "APPROVED" : "PENDING";
        countCumplido++;
      }

      const newDate = new Date(today);
      newDate.setDate(today.getDate() + daysOffset);

      return prisma.activity.update({
        where: { id: activity.id },
        data: {
          dueDate: newDate,
          priority: newPriority,
          status: newStatus,
          updatedAt: new Date(), // Touch update
        },
      });
    });

    // Execute in chunks to avoid connection limits if many
    const chunkSize = 50;
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);
      await prisma.$transaction(chunk);
      console.log(`Procesadas ${Math.min(i + chunkSize, updates.length)} / ${updates.length} actividades...`);
    }

    console.log("Resumen de distribución (aproximado):");
    console.log(`  Vencido (<= 15d): ${countVencido}`);
    console.log(`  Por Vencer (16-30d): ${countPorVencer}`);
    console.log(`  Cumplido (> 30d): ${countCumplido}`);

  } catch (error) {
    console.error("Error redistribuyendo actividades:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
