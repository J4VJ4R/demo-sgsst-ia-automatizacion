
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando inyección de métricas de prueba...");

  try {
    const projects = await prisma.project.findMany();
    console.log(`Encontradas ${projects.length} empresas.`);

    const today = new Date();
    // Vencido: 5 días atrás
    const pastDate = new Date(today);
    pastDate.setDate(today.getDate() - 5);
    
    // Por vencer: 3 días adelante
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + 3);

    for (const project of projects) {
      console.log(`Procesando empresa: ${project.name} (${project.id})`);

      // Crear 12 actividades vencidas
      const vencidasPromises = Array.from({ length: 12 }).map((_, i) => 
        prisma.activity.create({
          data: {
            title: `Actividad Vencida de Prueba ${i + 1}`,
            projectId: project.id,
            status: "PENDING",
            priority: "Vencido", // Usamos la etiqueta directa
            dueDate: pastDate,
            updatedAt: pastDate,
          }
        })
      );

      // Crear 7 actividades por vencer
      const porVencerPromises = Array.from({ length: 7 }).map((_, i) => 
        prisma.activity.create({
          data: {
            title: `Actividad Por Vencer de Prueba ${i + 1}`,
            projectId: project.id,
            status: "PENDING",
            priority: "Por vencer", // Usamos la etiqueta directa
            dueDate: futureDate,
            updatedAt: today,
          }
        })
      );

      await Promise.all([...vencidasPromises, ...porVencerPromises]);
      console.log(`  -> Agregadas 12 vencidas y 7 por vencer.`);
    }

    console.log("Inyección de datos completada exitosamente.");
  } catch (error) {
    console.error("Error durante la inyección de datos:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
