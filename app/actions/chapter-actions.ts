'use server'

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/app/auth-actions";
import { chapterActivities } from "@/lib/activities-data";

export async function addChapterActivities(projectId: string, newChapter: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "No autenticado." };
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return { success: false, error: "Proyecto no encontrado." };
    }

    // Check permissions
    const userRole = currentUser.role;
    const userId = currentUser.id;
    const isAdmin = userRole === "ADMIN_PMD";
    const isProjectConsultant = userRole === "CONSULTANT" && project.consultantId === userId;

    if (!isAdmin && !isProjectConsultant) {
      return { success: false, error: "No tiene permisos para modificar este proyecto." };
    }

    // Determine current chapter
    const currentChapter = project.chapter || "0";
    
    // Validate progression
    if (parseInt(newChapter) <= parseInt(currentChapter)) {
        return { success: false, error: "No se puede agregar un capítulo igual o inferior al actual." };
    }

    // Get activities to add
    // If current is 1 and new is 2 -> Add activities from chapter 2
    // If current is 1 and new is 3 -> Add activities from chapter 2 AND 3? Or just 3?
    // User requirement: "Si se tiene el capítulo 1... y se agrega el capítulo 3... el total debe ser 45"
    // Chapter 1 (7) + Chapter 3 (38) = 45.
    // This implies we simply ADD the activities of the TARGET chapter.
    // Wait, if I go from 1 to 3, do I skip 2?
    // "Si se tiene el capítulo 1 (7) y se agrega el capítulo 3 (38), el total debe ser 45"
    // This implies we add the set of Chapter 3.
    // Does Chapter 3 set include Chapter 2 activities?
    // Let's check `chapterActivities` content again.
    // Chapter 1: 7 items.
    // Chapter 2: 17 items.
    // Chapter 3: 38 items.
    // If I add Chapter 3, I add 38 items.
    // If I already have Chapter 1 (7 items), total is 7 + 38 = 45.
    // So yes, we just add the activities defined in `chapterActivities[newChapter]`.
    
    const activitiesToAdd = chapterActivities[newChapter as keyof typeof chapterActivities] || [];
    
    if (activitiesToAdd.length === 0) {
        return { success: false, error: "El capítulo seleccionado no tiene actividades definidas." };
    }

    // Create activities in transaction
    await prisma.$transaction(async (tx) => {
        // Update project chapter
        // "La operación siempre debe ser aditiva... No permitir seleccionar un capítulo inferior"
        // Does this mean the project's "chapter" field updates to the new one?
        // Yes, likely reflects the highest level achieved/added.
        await tx.project.update({
            where: { id: projectId },
            data: { chapter: newChapter }
        });

        // Add activities
        // Check for duplicates? User says "Implementar validación que impida agregar un capítulo que ya existe"
        // But if we upgrade 1 -> 3, we add all 3.
        // We should probably just add them. The titles might duplicate if the sets overlap?
        // Let's assume sets are distinct or user accepts duplicates if they exist in multiple sets (which is rare for chapters usually).
        // Actually, looking at the data, Chapter 2 seems to have some same names as Chapter 1?
        // 1: "Asignación de persona..."
        // 2: "Asignación de persona..."
        // If they overlap, we might create duplicates.
        // "La operación siempre debe ser aditiva (solo suma actividades, nunca las elimina)"
        // If I have 7, and I add 38, I get 45.
        // If names duplicate, I will have 2 "Asignación de persona...".
        // This seems to be the requirement ("total debe ser 45").
        
        // Optimized with createMany
        await tx.activity.createMany({
            data: activitiesToAdd.map(title => ({
                title,
                projectId,
                status: "PENDING",
                priority: "Media",
                assignedToId: project.consultantId || null, // Auto-assign to project consultant if available
            }))
        });

    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true };

  } catch (error: any) {
    console.error("Error adding chapter activities:", error);
    return { success: false, error: error.message || "Error al agregar actividades del capítulo." };
  }
}
