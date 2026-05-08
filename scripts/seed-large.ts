
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Define types locally since they are not Enums in the schema
type ActivityStatus = "PENDING" | "APPROVED" | "REJECTED" | "IN_PROGRESS";
type Priority = "Alta" | "Media" | "Baja";

const COMPANIES = [
  "Tech Solutions", "Global Logistics", "Health First", "Eco Energy", "Urban Build",
  "FinServe", "EduTech", "AgroCorp", "Retail Giant", "Media Group",
  "AutoMotors", "Travel Safe", "Foodie Inc", "Legal Minds", "Secure IT",
  "Clean Water", "Green Earth", "Smart Home", "Future Vision", "Cloud Nine",
  "Data Flow", "Net Works", "Cyber Safe", "Bio Labs", "Chem Co",
  "Metal Works", "Wood Craft", "Textile Mill", "Fashion Hub", "Design Studio",
  "Print Master", "Book World", "Music Box", "Art Gallery", "Movie Star",
  "Game Zone", "Sport Life", "Gym Fit", "Spa Relax", "Beauty Queen",
  "Toy Story", "Baby Care", "Pet Shop", "Vet Clinic", "Farm Fresh",
  "Garden Pro", "Flower Power", "Coffee Time", "Tea House", "Juice Bar"
];

const ACTIVITY_TITLES = [
  "Renovación de Matriz de Riesgos", "Capacitación de Brigada de Emergencia", "Auditoría Interna de Calidad",
  "Entrega de Elementos de Protección Personal", "Exámenes Médicos Ocupacionales", "Inspección de Extintores",
  "Reporte de Condiciones de Salud", "Comité de Convivencia Laboral", "Simulacro de Evacuación",
  "Mantenimiento de Equipos", "Revisión de Política SST", "Inducción a Nuevos Ingresos",
  "Medición de Ruido Ambiental", "Investigación de Incidentes", "Plan de Gestión de Residuos",
  "Capacitación en Alturas", "Inspección de Botiquines", "Señalización de Áreas",
  "Mantenimiento de Redes Eléctricas", "Evaluación de Puestos de Trabajo"
];

const DEPARTMENTS = ["Seguridad", "Salud", "Gestión Humana", "Operaciones", "Calidad", "Mantenimiento", "Producción", "Ventas", "Logística", "Administración"];
const MUNICIPALITIES = ["Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena", "Bucaramanga", "Pereira", "Manizales", "Cúcuta", "Ibagué"];

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
    
    if (rand < 0.25) {
      // VENCIDO (Rojo): <= 15 días (o pasada)
      dueDate = addDays(today, Math.floor(Math.random() * 20) - 5); 
      priority = "Alta";
      status = "PENDING";
    } else if (rand < 0.5) {
      // POR VENCER (Amarillo): 16 - 30 días
      dueDate = addDays(today, 16 + Math.floor(Math.random() * 14));
      priority = "Media";
      status = "PENDING";
    } else {
      // CUMPLIDO (Verde): > 30 días o Aprobada
      if (Math.random() > 0.6) {
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
  console.log("Iniciando generación de datos masivos...");
  const today = new Date();

  try {
    // 1. Crear empresas faltantes hasta llegar a 50
    const existingProjects = await prisma.project.findMany();
    const currentCount = existingProjects.length;
    const targetCount = 50;

    console.log(`Empresas actuales: ${currentCount}`);

    if (currentCount < targetCount) {
        const toCreate = targetCount - currentCount;
        console.log(`Creando ${toCreate} empresas nuevas...`);
        
        for (let i = 0; i < toCreate; i++) {
            const name = COMPANIES[currentCount + i] || `Empresa ${currentCount + i + 1}`;
            await prisma.project.create({
                data: {
                    name: name,
                    clientName: `Cliente ${name}`,
                    description: `Descripción para ${name}`,
                    status: "ACTIVE",
                    department: getRandomItem(DEPARTMENTS),
                    municipality: getRandomItem(MUNICIPALITIES),
                    riskLevel: (Math.floor(Math.random() * 5) + 1).toString(),
                    nit: `900${Math.floor(Math.random() * 1000000)}`,
                    phone: `300${Math.floor(Math.random() * 1000000)}`,
                    workerCount: Math.floor(Math.random() * 500) + 10,
                }
            });
        }
    }

    // 2. Asegurar actividades por empresa
    const allProjects = await prisma.project.findMany({
        include: {
            _count: {
                select: { activities: true }
            }
        }
    });

    for (const project of allProjects) {
        const activityCount = project._count.activities;
        const targetActivities = 30; // 30 actividades por empresa = 1500 total
        
        if (activityCount < targetActivities) {
            const toAdd = targetActivities - activityCount;
            // console.log(`Agregando ${toAdd} actividades a ${project.name}...`);
            
            for (let k = 0; k < toAdd; k++) {
                const { status, priority, dueDate } = generateRandomState(today);
                await prisma.activity.create({
                    data: {
                        title: getRandomItem(ACTIVITY_TITLES),
                        status, priority, dueDate,
                        projectId: project.id,
                    }
                });
            }
        }
    }

    const totalActivities = await prisma.activity.count();
    console.log(`Total de actividades en el sistema: ${totalActivities}`);
    console.log("Proceso completado exitosamente.");

  } catch (error) {
    console.error("Error generando datos:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
