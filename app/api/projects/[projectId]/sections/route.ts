import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/auth-actions";
import { accidentalidadActivities } from "@/lib/accidentalidad-data";
import { chapterActivities } from "@/lib/activities-data";
import { getDefaultSgSstDesignSections } from "@/lib/sgsst-design-defaults";
import { revalidatePath } from "next/cache";

type ProjectSectionKey =
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

async function getProjectAccess(user: { id: string; role: string }, projectId: string) {
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

async function ensureSectionData(projectId: string, sectionKey: ProjectSectionKey) {
  if (sectionKey === "accidentalidad") {
    await prisma.accidentalidadEmpresa.deleteMany({
      where: { projectId, actividad: { in: [...accidentalidadActivities] } },
    });
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

export async function POST(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

  const { projectId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const sectionKey = (body?.sectionKey || "") as ProjectSectionKey;
  const enabled = !!body?.enabled;

  if (!allSectionKeys.includes(sectionKey)) {
    return NextResponse.json({ success: false, error: "Sección inválida" }, { status: 400 });
  }

  const access = await getProjectAccess(user, projectId);
  if (!access.ok) return NextResponse.json({ success: false, error: access.error }, { status: 404 });
  if (!access.canManage) return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });

  await ensureSectionRows(projectId, user.id);

  const current = await prisma.projectSection.findUnique({
    where: { projectId_sectionKey: { projectId, sectionKey } },
    select: { enabled: true },
  });
  const previousEnabled = current?.enabled ?? defaultSectionState()[sectionKey];

  if (previousEnabled === enabled) return NextResponse.json({ success: true, enabled: previousEnabled });

  if (enabled) {
    await ensureSectionData(projectId, sectionKey);
  }

  await prisma.projectSection.upsert({
    where: { projectId_sectionKey: { projectId, sectionKey } },
    create: {
      projectId,
      sectionKey,
      enabled,
      enabledAt: enabled ? new Date() : null,
      enabledBy: enabled ? user.id : null,
      disabledAt: !enabled ? new Date() : null,
      disabledBy: !enabled ? user.id : null,
    },
    update: {
      enabled,
      enabledAt: enabled ? new Date() : null,
      enabledBy: enabled ? user.id : null,
      disabledAt: !enabled ? new Date() : null,
      disabledBy: !enabled ? user.id : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: enabled ? "ENABLE_SECTION" : "DISABLE_SECTION",
      entity: "ProjectSection",
      entityId: `${projectId}:${sectionKey}`,
      performedBy: user.id,
      details: JSON.stringify({
        projectId,
        sectionKey,
        previousEnabled,
        nextEnabled: enabled,
      }),
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/overview`);
  revalidatePath(`/activities`);

  return NextResponse.json({ success: true, enabled });
}
