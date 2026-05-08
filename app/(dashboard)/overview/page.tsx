import prisma from "@/lib/prisma";
import { OverviewContent } from "@/components/dashboard/overview-content";
import { getCurrentUser } from "@/app/auth-actions";
import { COLLABORATOR_PRELOADED_ACTIVITY_TITLES } from "@/lib/collaborator-preloaded-activities";
import type { Prisma } from "@prisma/client";

import { redirect } from "next/navigation";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { companyId } = await searchParams;
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login");
  }

  const userRole = user.role || "CLIENT_VIEWER";
  const userId = user.id;
  const isClientRole = userRole === "CLIENT" || userRole === "CLIENT_VIEWER";

  let projectWhere: Prisma.ProjectWhereInput = { id: "none" };
  let projectScope: Prisma.ProjectWhereInput = {};

  if (userRole === "ADMIN_PMD") {
    // Admin sees all ACTIVE projects
    projectWhere = { status: "ACTIVE" };
    projectScope = { status: "ACTIVE" };
  } else if (userRole === "CONSULTANT" && userId) {
    projectWhere = { consultantId: userId, status: "ACTIVE" };
    projectScope = { consultantId: userId, status: "ACTIVE" };
  } else if (isClientRole && userId) {
    projectWhere = { clientUserId: userId, status: "ACTIVE" };
    projectScope = { clientUserId: userId, status: "ACTIVE" };
  }

  // Get all available projects for the filter dropdown based on user role
  // OPTIMIZATION: Moved to Promise.all below to run in parallel with other queries
  
  // Apply company filter if selected
  // Note: We are now handling filtering client-side to allow for instant updates without reload.
  // The server fetches all relevant data for the user's role.
  /*
  if (companyId && typeof companyId === "string" && companyId !== "all") {
    // Verify the company exists and user has access (implicitly handled by merging with projectWhere)
    projectWhere = { ...projectWhere, id: companyId };
    activityBaseWhere = { ...activityBaseWhere, projectId: companyId };
  }
  */

  const [
    availableProjects,
    totalProjects,
    pendingActivities,
    inReviewActivities,
    approvedActivities,
    rejectedActivities,
    recentActivities,
    dashboardIndicatorsRaw,
  ] = await Promise.all([
    prisma.project.findMany({
      where: projectWhere,
      select: {
        id: true,
        name: true,
        consultantId: true,
        department: true,
        consultant: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.project.count({
      where: projectWhere,
    }),
    prisma.activity.count({
      where: {
        status: "PENDING",
        NOT: {
          AND: [
            { collaboratorId: { not: null } },
            { title: { in: [...COLLABORATOR_PRELOADED_ACTIVITY_TITLES] } },
          ],
        },
        OR: [
          {
            collaboratorId: null,
            inspectionEquipmentId: null,
            project: { is: { ...projectScope, sections: { some: { sectionKey: "requirements", enabled: true } } } },
          },
          {
            collaboratorId: { not: null },
            project: { is: { ...projectScope, sections: { some: { sectionKey: "collaborators", enabled: true } } } },
          },
          {
            inspectionEquipmentId: { not: null },
            project: { is: { ...projectScope, sections: { some: { sectionKey: "inspection-maintenance", enabled: true } } } },
          },
        ],
      },
    }),
    prisma.activity.count({
      where: {
        status: "IN_REVIEW",
        NOT: {
          AND: [
            { collaboratorId: { not: null } },
            { title: { in: [...COLLABORATOR_PRELOADED_ACTIVITY_TITLES] } },
          ],
        },
        OR: [
          {
            collaboratorId: null,
            inspectionEquipmentId: null,
            project: { is: { ...projectScope, sections: { some: { sectionKey: "requirements", enabled: true } } } },
          },
          {
            collaboratorId: { not: null },
            project: { is: { ...projectScope, sections: { some: { sectionKey: "collaborators", enabled: true } } } },
          },
          {
            inspectionEquipmentId: { not: null },
            project: { is: { ...projectScope, sections: { some: { sectionKey: "inspection-maintenance", enabled: true } } } },
          },
        ],
      },
    }),
    prisma.activity.count({
      where: {
        status: "APPROVED",
        NOT: {
          AND: [
            { collaboratorId: { not: null } },
            { title: { in: [...COLLABORATOR_PRELOADED_ACTIVITY_TITLES] } },
          ],
        },
        OR: [
          {
            collaboratorId: null,
            inspectionEquipmentId: null,
            project: { is: { ...projectScope, sections: { some: { sectionKey: "requirements", enabled: true } } } },
          },
          {
            collaboratorId: { not: null },
            project: { is: { ...projectScope, sections: { some: { sectionKey: "collaborators", enabled: true } } } },
          },
          {
            inspectionEquipmentId: { not: null },
            project: { is: { ...projectScope, sections: { some: { sectionKey: "inspection-maintenance", enabled: true } } } },
          },
        ],
      },
    }),
    prisma.activity.count({
      where: {
        status: "REJECTED",
        NOT: {
          AND: [
            { collaboratorId: { not: null } },
            { title: { in: [...COLLABORATOR_PRELOADED_ACTIVITY_TITLES] } },
          ],
        },
        OR: [
          {
            collaboratorId: null,
            inspectionEquipmentId: null,
            project: { is: { ...projectScope, sections: { some: { sectionKey: "requirements", enabled: true } } } },
          },
          {
            collaboratorId: { not: null },
            project: { is: { ...projectScope, sections: { some: { sectionKey: "collaborators", enabled: true } } } },
          },
          {
            inspectionEquipmentId: { not: null },
            project: { is: { ...projectScope, sections: { some: { sectionKey: "inspection-maintenance", enabled: true } } } },
          },
        ],
      },
    }),
    prisma.activity.findMany({
      where: {
        NOT: {
          AND: [
            { collaboratorId: { not: null } },
            { title: { in: [...COLLABORATOR_PRELOADED_ACTIVITY_TITLES] } },
          ],
        },
        OR: [
          {
            collaboratorId: null,
            inspectionEquipmentId: null,
            project: { is: { ...projectScope, sections: { some: { sectionKey: "requirements", enabled: true } } } },
          },
          {
            collaboratorId: { not: null },
            project: { is: { ...projectScope, sections: { some: { sectionKey: "collaborators", enabled: true } } } },
          },
          {
            inspectionEquipmentId: { not: null },
            project: { is: { ...projectScope, sections: { some: { sectionKey: "inspection-maintenance", enabled: true } } } },
          },
        ],
      },
      select: {
        id: true,
        status: true,
        priority: true,
        updatedAt: true,
        dueDate: true,
        projectId: true,
        collaboratorId: true,
        inspectionEquipmentId: true,
        assignedToId: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            department: true,
            municipality: true,
            riskLevel: true,
            consultantId: true,
            consultant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      // Increase limit to ensure all activities are available for client-side filtering
      // covering all companies and consultants.
      take: 10000,
    }),
    (async () => {
      if (!isClientRole) return [];
      if (!(prisma as unknown as Record<string, unknown>).minimumIndicator) return [];
      try {
        return await prisma.minimumIndicator.findMany({
          where: {
            deletedAt: null,
            project: { is: projectWhere },
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            projectId: true,
            name: true,
            description: true,
            unit: true,
            targetPercent: true,
            formula: true,
            variablesJson: true,
            project: { select: { name: true } },
            measurements: {
              where: { deletedAt: null },
              orderBy: { periodEnd: "desc" },
              take: 1,
              select: {
                id: true,
                periodStart: true,
                periodEnd: true,
                inputsJson: true,
                computedValue: true,
                compliancePct: true,
                resultAnalysis: true,
                createdAt: true,
              },
            },
          },
        });
      } catch (e) {
        const code = typeof e === "object" && e && "code" in e ? (e as { code?: unknown }).code : null;
        if (code !== "P2022") return [];
        try {
          return await prisma.minimumIndicator.findMany({
            where: {
              deletedAt: null,
              project: { is: projectWhere },
            },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              projectId: true,
              name: true,
              description: true,
              unit: true,
              targetPercent: true,
              formula: true,
              variablesJson: true,
              project: { select: { name: true } },
              measurements: {
                where: { deletedAt: null },
                orderBy: { periodEnd: "desc" },
                take: 1,
                select: {
                  id: true,
                  periodStart: true,
                  periodEnd: true,
                  inputsJson: true,
                  computedValue: true,
                  compliancePct: true,
                  createdAt: true,
                },
              },
            },
          });
        } catch {
          return [];
        }
      }
    })(),
  ]);

  const formattedProjects = availableProjects.map(p => ({
    id: p.id,
    name: p.name,
    consultantId: p.consultantId,
    consultantName: p.consultant?.name ?? null,
    department: p.department,
  }));

  const activities = recentActivities.map((activity) => ({
    id: activity.id,
    status: activity.status,
    priority: activity.priority,
    updatedAt: activity.updatedAt.toISOString(),
    dueDate: activity.dueDate?.toISOString() ?? null,
    projectId: activity.projectId,
    projectName: activity.project.name,
    department: activity.project.department ?? null,
    municipality: activity.project.municipality ?? null,
    riskLevel: activity.project.riskLevel ?? null,
    assignedToId: activity.assignedToId,
    assignedToName: activity.assignedTo?.name ?? null,
    assignedToRole: activity.assignedTo?.role ?? null,
    consultantId: activity.project.consultantId,
    consultantName: activity.project.consultant?.name ?? null,
  }));

  const dashboardIndicators = (dashboardIndicatorsRaw as Array<{
    id: string;
    projectId: string;
    name: string;
    description: string | null;
    unit: string;
    targetPercent: number;
    formula: string;
    variablesJson: string;
    project: { name: string };
    measurements: Array<{
      id: string;
      periodStart: Date;
      periodEnd: Date;
      inputsJson: string;
      computedValue: number;
      compliancePct: number;
      resultAnalysis?: string | null;
      createdAt: Date;
    }>;
  }>).map((row) => {
    const latest = row.measurements[0] || null;
    let variables: Array<{ key: string; label: string }> = [];
    try {
      variables = JSON.parse(row.variablesJson || "[]");
      if (!Array.isArray(variables)) variables = [];
    } catch {
      variables = [];
    }
    return {
      id: row.id,
      projectId: row.projectId,
      projectName: row.project.name,
      name: row.name,
      description: row.description ?? null,
      unit: row.unit,
      targetPercent: row.targetPercent,
      formula: row.formula,
      variables,
      latestMeasurement: latest
        ? {
            id: latest.id,
            periodStart: latest.periodStart.toISOString(),
            periodEnd: latest.periodEnd.toISOString(),
            inputsJson: latest.inputsJson,
            computedValue: latest.computedValue,
            compliancePct: latest.compliancePct,
            resultAnalysis: latest.resultAnalysis ?? null,
            createdAt: latest.createdAt.toISOString(),
          }
        : null,
    };
  });

  const kpiData = {
    totalProjects,
    pendingActivities,
    inReviewActivities,
    approvedActivities,
    rejectedActivities,
  };

  return (
    <div className="space-y-6">
      <OverviewContent
        kpiData={kpiData}
        activities={activities}
        projects={formattedProjects}
        initialCompanyId={typeof companyId === "string" ? companyId : "all"}
        userRole={userRole}
        dashboardIndicators={dashboardIndicators}
      />
    </div>
  );
}
