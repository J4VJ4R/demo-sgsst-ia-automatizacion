import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Define types locally since they are not Enums in the schema
type ActivityStatus = "PENDING" | "APPROVED" | "REJECTED" | "IN_PROGRESS";
type Priority = "Alta" | "Media" | "Baja";

const ACTIVITY_TITLES = [
  "Renovación de Matriz de Riesgos",
  "Capacitación de Brigada de Emergencia",
  "Auditoría Interna de Calidad",
  "Entrega de Elementos de Protección Personal",
  "Exámenes Médicos Ocupacionales",
  "Inspección de Extintores",
  "Reporte de Condiciones de Salud",
  "Comité de Convivencia Laboral",
  "Simulacro de Evacuación",
  "Mantenimiento de Equipos",
  "Revisión de Política SST",
  "Inducción a Nuevos Ingresos",
  "Medición de Ruido Ambiental",
  "Investigación de Incidentes",
  "Plan de Gestión de Residuos"
];

const DEPARTMENTS = ["Seguridad", "Salud", "Gestión Humana", "Operaciones", "Calidad"];
const MUNICIPALITIES = ["Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena"];

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function generateRandomState(today: Date) {
    let status: ActivityStatus = "PENDING";
    let priority: Priority = "Media";
    let dueDate: Date = today;
    
    const rand = Math.random();
    
    if (rand < 0.33) {
      // VENCIDO (Rojo): <= 15 días (o pasada)
      // Generar fecha entre hace 10 días y dentro de 10 días
      // Para asegurar que sea "Vencido" según la lógica: <= 15 días restantes
      // Si hoy es 7 de Marzo:
      // -5 días = 2 Marzo (Pasada, diff negativo, <= 15) -> OK
      // +10 días = 17 Marzo (Diff 10, <= 15) -> OK
      dueDate = addDays(today, Math.floor(Math.random() * 20) - 5); 
      priority = "Alta";
      status = "PENDING";
    } else if (rand < 0.66) {
      // POR VENCER (Amarillo): 16 - 30 días
      dueDate = addDays(today, 16 + Math.floor(Math.random() * 14));
      priority = "Media";
      status = "PENDING";
    } else {
      // CUMPLIDO (Verde): > 30 días o Aprobada
      if (Math.random() > 0.5) {
          status = "APPROVED";
          dueDate = addDays(today, -10);
          priority = "Baja";
      } else {
          dueDate = addDays(today, 35 + Math.floor(Math.random() * 60));
          priority = "Baja";
          status = "PENDING";
      }
    }
    return { status, priority, dueDate };
}

async function main() {
  console.log("Iniciando generación de datos reales...");

  try {
    // 1. Obtener empresas
    const projects = await prisma.project.findMany({
      include: {
        _count: {
          select: { activities: true }
        }
      }
    });

    console.log(`Se encontraron ${projects.length} empresas.`);

    const today = new Date();

    for (const project of projects) {
      console.log(`Actualizando datos para empresa: ${project.name} (${project._count.activities} actividades)`);
      
      // Obtener actividades existentes
      const activities = await prisma.activity.findMany({
        where: { projectId: project.id }
      });

      // Si tiene pocas, crear nuevas
      if (activities.length < 5) {
         // ... lógica de creación (se mantiene o se mejora) ...
         // Por simplicidad, si tiene < 5, las borramos y creamos nuevas como antes
         await prisma.activity.deleteMany({ where: { projectId: project.id } });
         // ... crear nuevas ...
         const activitiesToCreate = 12;
         for (let i = 0; i < activitiesToCreate; i++) {
            // (Lógica de creación igual a abajo)
            const { status, priority, dueDate } = generateRandomState(today);
            await prisma.activity.create({
                data: {
                    title: getRandomItem(ACTIVITY_TITLES),
                    // description field does not exist in Activity model, removing it
                    status, priority, dueDate,
                    projectId: project.id,
                    // department, municipality, riskLevel don't exist in Activity model in schema.prisma either
                    // Based on previous fixes, we should remove them.
                }
            });
         }
      } else {
         // Si YA TIENE actividades, actualizarlas para que cuadren con la lógica
         for (const activity of activities) {
            const { status, priority, dueDate } = generateRandomState(today);
            await prisma.activity.update({
                where: { id: activity.id },
                data: { status, priority, dueDate }
            });
         }
      }
    }

    console.log("Proceso completado exitosamente.");

  } catch (error) {
    console.error("Error generando datos:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
