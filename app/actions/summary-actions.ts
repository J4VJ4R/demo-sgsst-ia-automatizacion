'use server'

import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/app/auth-actions";
import { calculatePriority } from "@/lib/priority-logic";
import { canViewGlobalSummary } from "@/lib/rbac";
import { translatePriority } from "@/lib/utils";
import { COLLABORATOR_PRELOADED_ACTIVITY_TITLES } from "@/lib/collaborator-preloaded-activities";

export interface ActivitySummaryStats {
  status: {
    approved: number;
    inReview: number;
    pending: number;
    rejected: number;
  };
  priority: {
    overdue: number;
    dueSoon: number;
    completed: number;
  };
}

export async function getGlobalActivitySummary(args?: {
  companyId?: string | null;
}): Promise<ActivitySummaryStats | null> {
  const user = await getCurrentUser();
  
  if (!user || !canViewGlobalSummary(user.role)) return null;

  try {
    const projectWhere: any = {};

    if (user.role === "CLIENT" || user.role === "CLIENT_VIEWER") {
      projectWhere.clientUserId = user.id;
    } else if (user.role === "CONSULTANT") {
      projectWhere.consultantId = user.id;
    } else if (user.role === "ADMIN_PMD") {
    } else {
      return null;
    }

    projectWhere.status = "ACTIVE";

    if (args?.companyId) {
      projectWhere.id = args.companyId;
    }

    const activities = await prisma.activity.findMany({
      where: {
        OR: [
          {
            collaboratorId: null,
            inspectionEquipmentId: null,
            project: {
              is: {
                ...projectWhere,
                sections: { some: { sectionKey: "requirements", enabled: true } },
              },
            },
          },
          {
            collaboratorId: { not: null },
            project: {
              is: {
                ...projectWhere,
                sections: { some: { sectionKey: "collaborators", enabled: true } },
              },
            },
          },
          {
            inspectionEquipmentId: { not: null },
            project: {
              is: {
                ...projectWhere,
                sections: {
                  some: { sectionKey: "inspection-maintenance", enabled: true },
                },
              },
            },
          },
        ],
        NOT: {
          AND: [
            { collaboratorId: { not: null } },
            { title: { in: [...COLLABORATOR_PRELOADED_ACTIVITY_TITLES] } },
          ],
        },
      },
      select: {
        status: true,
        priority: true,
        dueDate: true,
        collaboratorId: true,
        inspectionEquipmentId: true,
      }
    });

    const now = new Date();

    const getPriorityLabel = (args: { dueDate: Date | null; priority: string | null }) => {
      if (args.dueDate) {
        return calculatePriority(new Date(args.dueDate), now).priority;
      }
      return null;
    };

    const stats: ActivitySummaryStats = {
      status: {
        approved: 0,
        inReview: 0,
        pending: 0,
        rejected: 0,
      },
      priority: {
        overdue: 0,
        dueSoon: 0,
        completed: 0,
      }
    };

    activities.forEach(activity => {
      // Status Counts
      const status = activity.status.toUpperCase();
      if (status === 'APPROVED' || status === 'APROBADA') stats.status.approved++;
      else if (status === 'IN_REVIEW' || status === 'EN REVISIÓN' || status === 'REVIEW') stats.status.inReview++;
      else if (status === 'PENDING' || status === 'PENDIENTE') stats.status.pending++;
      else if (status === 'REJECTED' || status === 'RECHAZADA') stats.status.rejected++;

      const priorityLabel = getPriorityLabel({
        dueDate: activity.dueDate,
        priority: activity.priority,
      });
      if (priorityLabel === "Cumplido") stats.priority.completed++;
      else if (priorityLabel === "Vencido") stats.priority.overdue++;
      else if (priorityLabel === "Por vencer") stats.priority.dueSoon++;
    });

    return stats;
  } catch (error) {
    console.error("Error fetching client summary:", error);
    return null;
  }
}

export async function getClientActivitySummary(): Promise<ActivitySummaryStats | null> {
  return getGlobalActivitySummary();
}
