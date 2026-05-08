'use server'

import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/app/auth-actions";
import { revalidatePath } from "next/cache";
import { accidentalidadActivities } from "@/lib/accidentalidad-data";
import { chapterActivities } from "@/lib/activities-data";
import { getDefaultSgSstDesignSections } from "@/lib/sgsst-design-defaults";

export type ProjectSectionKey =
  | "requirements"
  | "accidentalidad"
  | "collaborators"
  | "sgsst-design"
  | "inspection-maintenance"
  | "minimum-indicators"
  | "vehicles-inspection"
  | "drivers-inspection";

const allSectionKeys: ProjectSectionKey[] = [
  "requirements",
  "accidentalidad",
  "collaborators",
  "sgsst-design",
  "inspection-maintenance",
  "minimum-indicators",
  "vehicles-inspection",
  "drivers-inspection",
];

type CurrentUser = { id: string; role: string };

async function getProjectAccess(user: CurrentUser, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, consultantId: true, clientUserId: true, chapter: true },
  });
  if (!project) return { ok: false as const, error: "Empresa no encontrada." };

  const isAdmin = user.role === "ADMIN_PMD";
  const isProjectConsultant = user.role === "CONSULTANT" && project.consultantId === user.id;
  const isProjectClient = user.role === "CLIENT_VIEWER" && project.clientUserId === user.id;

  return {
    ok: true as const,
    project,
    canView: isAdmin || isProjectConsultant || isProjectClient,
    canManage: isAdmin || isProjectConsultant,
  };
}

function defaultSectionState(): Record<ProjectSectionKey, boolean> {
  return {
    requirements: true,
    accidentalidad: false,
    collaborators: false,
    "sgsst-design": false,
    "inspection-maintenance": false,
    "minimum-indicators": false,
    "vehicles-inspection": false,
    "drivers-inspection": false,
  };
}

export async function getProjectSections(projectId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "No autenticado" } as const;

  const access = await getProjectAccess(user, projectId);
  if (!access.ok) return { success: false, error: access.error } as const;
  if (!access.canView) return { success: false, error: "Sin permisos" } as const;

  const current = await prisma.projectSection.findMany({
    where: { projectId },
    select: { sectionKey: true, enabled: true },
  });

  const state = defaultSectionState();
  for (const row of current) {
    const key = row.sectionKey as ProjectSectionKey;
    if (allSectionKeys.includes(key)) state[key] = row.enabled;
  }

  return { success: true, state, canManage: access.canManage } as const;
}

async function ensureSectionRows(projectId: string, userId: string) {
  const existing = await prisma.projectSection.findMany({
    where: { projectId, sectionKey: { in: allSectionKeys } },
    select: { sectionKey: true },
  });
  const existingKeys = new Set(existing.map((r) => r.sectionKey));
  const defaults = defaultSectionState();

  const toCreate = allSectionKeys.filter((k) => !existingKeys.has(k));
  if (toCreate.length === 0) return;

  await prisma.projectSection.createMany({
    data: toCreate.map((k) => ({
      projectId,
      sectionKey: k,
      enabled: defaults[k],
      enabledAt: defaults[k] ? new Date() : null,
      enabledBy: defaults[k] ? userId : null,
    })),
  });
}

async function validateDisable(user: CurrentUser, projectId: string, sectionKey: ProjectSectionKey) {
  if (sectionKey === "requirements") {
    const pending = await prisma.activity.count({
      where: { projectId, collaboratorId: null, inspectionEquipmentId: null, status: { not: "APPROVED" } },
    });
    if (pending > 0) return { ok: false as const, error: "No se puede desactivar Requisitos con actividades en proceso." };
  }

  if (sectionKey === "collaborators") {
    const pending = await prisma.activity.count({
      where: { projectId, collaboratorId: { not: null }, status: { not: "APPROVED" } },
    });
    if (pending > 0) return { ok: false as const, error: "No se puede desactivar Colaboradores con actividades en proceso." };
  }

  if (sectionKey === "inspection-maintenance") {
    const pending = await prisma.activity.count({
      where: { projectId, inspectionEquipmentId: { not: null }, status: { not: "APPROVED" } },
    });
    if (pending > 0)
      return { ok: false as const, error: "No se puede desactivar Programa de inspecciones y mantenimiento con actividades en proceso." };
  }

  if (sectionKey === "accidentalidad") {
    const pending = await prisma.accidentalidadEmpresa.count({
      where: { projectId, status: { not: "APPROVED" } },
    });
    if (pending > 0) return { ok: false as const, error: "No se puede desactivar Accidentalidad con registros en proceso." };
  }

  if (sectionKey === "sgsst-design") {
    return { ok: true as const };
  }

  return { ok: true as const };
}

async function ensureSectionData(projectId: string, sectionKey: ProjectSectionKey) {
  if (sectionKey === "accidentalidad") {
    const existing = await prisma.accidentalidadEmpresa.count({ where: { projectId } });
    if (existing === 0) {
      const defaultAccidentalidadDueDate = new Date();
      defaultAccidentalidadDueDate.setDate(defaultAccidentalidadDueDate.getDate() + 31);
      await prisma.accidentalidadEmpresa.createMany({
        data: accidentalidadActivities.map((actividad) => ({
          actividad,
          projectId,
          status: "PENDING",
          priority: "Cumplido",
          dueDate: defaultAccidentalidadDueDate,
        })),
      });
    }
  }

  if (sectionKey === "requirements") {
    const existing = await prisma.activity.count({ where: { projectId, collaboratorId: null } });
    if (existing === 0) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { chapter: true, consultantId: true },
      });
      const chapter = project?.chapter || "";
      const activitiesByChapter: Record<string, string[]> = chapterActivities;
      const activitiesToSeed = activitiesByChapter[chapter] || [];
      if (Array.isArray(activitiesToSeed) && activitiesToSeed.length > 0) {
        await prisma.activity.createMany({
          data: activitiesToSeed.map((title: string) => ({
            title,
            status: "PENDING",
            projectId,
            priority: "Media",
            assignedToId: project?.consultantId || null,
          })),
        });
      }
    }
  }

  if (sectionKey === "sgsst-design") {
    const existing = await prisma.sgSstDesignSection.count({ where: { projectId } });
    if (existing === 0) {
      const defaults = getDefaultSgSstDesignSections();
      await prisma.sgSstDesignSection.createMany({
        data: defaults.map((name, idx) => ({
          projectId,
          name,
          sortOrder: idx,
          isDefault: true,
        })),
      });
    }
  }
}

export async function setProjectSectionEnabled(args: { projectId: string; sectionKey: ProjectSectionKey; enabled: boolean }) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "No autenticado" } as const;

  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false, error: access.error } as const;
  if (!access.canManage) return { success: false, error: "Sin permisos" } as const;

  await ensureSectionRows(args.projectId, user.id);

  const current = await prisma.projectSection.findUnique({
    where: { projectId_sectionKey: { projectId: args.projectId, sectionKey: args.sectionKey } },
    select: { enabled: true },
  });
  const previousEnabled = current?.enabled ?? defaultSectionState()[args.sectionKey];

  if (previousEnabled === args.enabled) return { success: true, enabled: previousEnabled } as const;

  if (!args.enabled) {
    const valid = await validateDisable(user, args.projectId, args.sectionKey);
    if (!valid.ok) return { success: false, error: valid.error } as const;
  }

  if (args.enabled) {
    await ensureSectionData(args.projectId, args.sectionKey);
  }

  await prisma.projectSection.upsert({
    where: { projectId_sectionKey: { projectId: args.projectId, sectionKey: args.sectionKey } },
    create: {
      projectId: args.projectId,
      sectionKey: args.sectionKey,
      enabled: args.enabled,
      enabledAt: args.enabled ? new Date() : null,
      enabledBy: args.enabled ? user.id : null,
      disabledAt: !args.enabled ? new Date() : null,
      disabledBy: !args.enabled ? user.id : null,
    },
    update: {
      enabled: args.enabled,
      enabledAt: args.enabled ? new Date() : null,
      enabledBy: args.enabled ? user.id : null,
      disabledAt: !args.enabled ? new Date() : null,
      disabledBy: !args.enabled ? user.id : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: args.enabled ? "ENABLE_SECTION" : "DISABLE_SECTION",
      entity: "ProjectSection",
      entityId: `${args.projectId}:${args.sectionKey}`,
      performedBy: user.id,
      details: JSON.stringify({
        projectId: args.projectId,
        sectionKey: args.sectionKey,
        previousEnabled,
        nextEnabled: args.enabled,
      }),
    },
  });

  revalidatePath(`/projects/${args.projectId}`);
  revalidatePath(`/overview`);
  revalidatePath(`/activities`);

  return { success: true, enabled: args.enabled } as const;
}
