"use server";

import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { COLLABORATOR_PRELOADED_ACTIVITY_TITLES } from "@/lib/collaborator-preloaded-activities";

export interface CompanyMetrics {
  id: string;
  name: string;
  status: string;
  totalActivities: number;
  pending: number;
  inReview: number;
  rejected: number;
  approved: number;
  // Priority metrics
  high: number;
  medium: number;
  low: number;
  updatedAt: Date;
}

export async function getCompanyMetrics(filters: {
  dateRange?: "30" | "60" | "90" | "all";
  status?: "ACTIVE" | "INACTIVE" | "all";
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "No autenticado" };

  const userRole = user.role;
  const userId = user.id;

  // Base query for Projects
  const projectWhere: any = {};
  
  if (userRole === "CONSULTANT") {
    // Ensure consultantId is a string, not null
    if (!userId) return { success: false, error: "Usuario consultor sin ID" };
    projectWhere.consultantId = userId;
  } else if (userRole === "CLIENT_VIEWER") {
    if (!userId) return { success: false, error: "Usuario cliente sin ID" };
    projectWhere.clientUserId = userId;
  } else if (userRole === "ADMIN_PMD") {
    // Admin sees all
  } else {
    // Fallback: If user has role but logic missed it, deny access
    // But wait, what if role is undefined?
    return { success: false, error: `Rol no autorizado: ${userRole}` };
  }

  // Filter by Project Status
  if (filters.status && filters.status !== "all") {
    projectWhere.status = filters.status;
  }

  // Date Range Filter for Activities
  const activityDateFilter: any = {};
  if (filters.dateRange && filters.dateRange !== "all") {
    const days = parseInt(filters.dateRange);
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);
    activityDateFilter.updatedAt = { gte: dateLimit };
  }

  try {
    // Fetch projects with their activity counts
    // Using aggregation would be more efficient, but let's stick to relation counts for simplicity first
    // Prisma `include: { _count: ... }` is perfect here
    const projects = await prisma.project.findMany({
      where: projectWhere,
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true, // Use startDate instead of updatedAt since Project model doesn't have updatedAt
        activities: {
          where: {
            ...activityDateFilter,
            NOT: {
              AND: [
                { collaboratorId: { not: null } },
                { title: { in: [...COLLABORATOR_PRELOADED_ACTIVITY_TITLES] } },
              ],
            },
          },
          select: {
            status: true,
            priority: true, // Fetch priority as well
            dueDate: true,  // Fetch dueDate as well
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Process data to calculate metrics per project
    const metrics: CompanyMetrics[] = projects.map((project) => {
      // Safe access to activities array
      const acts = project.activities || [];
      const totalActivities = acts.length;
      
      // Status counts
      const pending = acts.filter((a) => a.status === "PENDING").length;
      const inReview = acts.filter((a) => a.status === "IN_REVIEW").length;
      const rejected = acts.filter((a) => a.status === "REJECTED").length;
      const approved = acts.filter((a) => a.status === "APPROVED").length;

      // Calculate "Vencido", "Por Vencer", "Cumplido" based on dueDate and Status
      const today = new Date();
      // Reset time part to ensure fair date comparison
      today.setHours(0, 0, 0, 0);
      
      let vencido = 0;
      let porVencer = 0;
      let cumplido = 0;

      acts.forEach((a: any) => {
        // CUMPLIDO logic:
        // If status is APPROVED, it is completed.
        if (a.status === "APPROVED") {
          cumplido++;
          return;
        }

        // For non-approved items, check dates
        if (!a.dueDate) {
            // If no due date, assume safe/cumplido? Or ignore?
            // Let's assume Cumplido (Low priority) if no date is set
            cumplido++;
            return; 
        }
        
        // Handle date strings or Date objects safely
        const due = new Date(a.dueDate);
        // Reset time part of due date to avoid timezone offset issues making it "yesterday"
        // We use local date components to avoid UTC shift
        const dueLocal = new Date(due.getFullYear(), due.getMonth(), due.getDate());
        const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        // Calculate difference in days
        const diffTime = dueLocal.getTime() - todayLocal.getTime();
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (daysRemaining <= 15) {
          // 15 days or less (or past) -> VENCIDO
          vencido++;
        } else if (daysRemaining <= 30) {
          // 16 to 30 days -> POR VENCER
          porVencer++;
        } else {
          // More than 30 days -> CUMPLIDO
          cumplido++;
        }
      });

      // Map these calculated values to high/medium/low fields expected by frontend
      // high -> Vencido
      // medium -> Por Vencer
      // low -> Cumplido
      const high = vencido;
      const medium = porVencer;
      const low = cumplido;

      return {
        id: project.id,
        name: project.name,
        status: project.status,
        totalActivities,
        pending,
        inReview,
        rejected,
        approved,
        high,
        medium,
        low,
        updatedAt: project.startDate, // Map startDate to updatedAt for the frontend interface
      };
    });

    return { success: true, metrics };
  } catch (error: any) {
    console.error("Error fetching company metrics:", error);
    // Include the actual error message in the return for debugging
    return { success: false, error: `Error al obtener métricas: ${error.message || "Desconocido"}` }; 
  }
}
