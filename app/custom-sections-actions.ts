"use server";

import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/app/auth-actions";
import { getPresignedUploadUrl, getPublicUrl } from "@/lib/s3";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

type CurrentUser = { id: string; role: string };

async function getProjectAccess(user: CurrentUser, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, consultantId: true, clientUserId: true },
  });
  if (!project) return { ok: false as const, error: "Empresa no encontrada." };

  const isAdmin = user.role === "ADMIN_PMD";
  const isProjectConsultant = user.role === "CONSULTANT" && project.consultantId === user.id;
  const isProjectClient = (user.role === "CLIENT" || user.role === "CLIENT_VIEWER") && project.clientUserId === user.id;

  return {
    ok: true as const,
    project,
    canView: isAdmin || isProjectConsultant || isProjectClient,
    canManage: isAdmin || isProjectConsultant,
  };
}

function getDbErrorMessage(e: unknown) {
  const anyErr = e as any;
  const code = typeof anyErr?.code === "string" ? anyErr.code : "";
  const message = e instanceof Error ? e.message : String(e);
  const lower = message.toLowerCase();

  if (code === "P2021" || lower.includes("does not exist") || lower.includes("unknown table")) {
    return "Funcionalidad no disponible: faltan migraciones en la base de datos.";
  }
  if (lower.includes("permission denied") || lower.includes("was denied access")) {
    return "Sin permisos para acceder a la base de datos (schema/tablas).";
  }
  if (lower.includes("can't reach database server") || lower.includes("connect") || lower.includes("timeout")) {
    return "No se pudo conectar a la base de datos. Revisa conexión/red.";
  }
  return "No se pudo acceder a la base de datos. Intenta nuevamente.";
}

export type CustomProjectSectionListItem = {
  id: string;
  name: string;
  enabled: boolean;
  createdAt: string;
};

export async function listCustomProjectSections(args: { projectId: string }) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canView) return { success: false as const, error: "Sin permisos" };

  let rows: { id: string; name: string; enabled: boolean; createdAt: Date }[] = [];
  try {
    rows = await prisma.customProjectSection.findMany({
      where: { projectId: args.projectId },
      select: { id: true, name: true, enabled: true, createdAt: true },
      orderBy: [{ createdAt: "asc" }],
    });
  } catch (e) {
    return { success: false as const, error: getDbErrorMessage(e) };
  }

  return {
    success: true as const,
    canManage: access.canManage,
    sections: rows.map((r) => ({
      id: r.id,
      name: r.name,
      enabled: r.enabled,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function createCustomProjectSection(args: { projectId: string; name: string }) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canManage) return { success: false as const, error: "Sin permisos" };

  const name = args.name.trim();
  if (!name) return { success: false as const, error: "Nombre requerido." };

  try {
    const now = new Date();
    const created = await prisma.customProjectSection.create({
      data: {
        projectId: args.projectId,
        name,
        enabled: true,
        enabledAt: now,
        enabledBy: user.id,
      },
      select: { id: true },
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE_CUSTOM_SECTION",
        entity: "CustomProjectSection",
        entityId: created.id,
        performedBy: user.id,
        details: JSON.stringify({ projectId: args.projectId, name }),
      },
    });

    revalidatePath(`/projects/${args.projectId}`);
    return { success: true as const, sectionId: created.id };
  } catch (e) {
    return { success: false as const, error: getDbErrorMessage(e) };
  }
}

export async function setCustomProjectSectionEnabled(args: { projectId: string; sectionId: string; enabled: boolean }) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canManage) return { success: false as const, error: "Sin permisos" };

  let section: { id: string; projectId: string; enabled: boolean; name: string } | null = null;
  try {
    section = await prisma.customProjectSection.findUnique({
      where: { id: args.sectionId },
      select: { id: true, projectId: true, enabled: true, name: true },
    });
  } catch (e) {
    return { success: false as const, error: getDbErrorMessage(e) };
  }
  if (!section || section.projectId !== args.projectId) {
    return { success: false as const, error: "Sección no encontrada." };
  }

  if (section.enabled === args.enabled) return { success: true as const };

  try {
    const now = new Date();
    await prisma.customProjectSection.update({
      where: { id: args.sectionId },
      data: args.enabled
        ? { enabled: true, enabledAt: now, enabledBy: user.id, disabledAt: null, disabledBy: null }
        : { enabled: false, disabledAt: now, disabledBy: user.id },
    });

    await prisma.auditLog.create({
      data: {
        action: args.enabled ? "ENABLE_CUSTOM_SECTION" : "DISABLE_CUSTOM_SECTION",
        entity: "CustomProjectSection",
        entityId: args.sectionId,
        performedBy: user.id,
        details: JSON.stringify({ projectId: args.projectId, name: section.name }),
      },
    });

    revalidatePath(`/projects/${args.projectId}`);
    return { success: true as const };
  } catch (e) {
    return { success: false as const, error: getDbErrorMessage(e) };
  }
}

export type CustomSectionActivityListItem = {
  id: string;
  name: string;
  dueDate: string | null;
  documentName: string | null;
  documentUrl: string | null;
  createdAt: string;
};

export async function listCustomProjectSectionActivities(args: { projectId: string; sectionId: string }) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canView) return { success: false as const, error: "Sin permisos" };

  let section: { id: string; projectId: string; enabled: boolean; name: string } | null = null;
  try {
    section = await prisma.customProjectSection.findUnique({
      where: { id: args.sectionId },
      select: { id: true, projectId: true, enabled: true, name: true },
    });
  } catch (e) {
    return { success: false as const, error: getDbErrorMessage(e) };
  }
  if (!section || section.projectId !== args.projectId) {
    return { success: false as const, error: "Sección no encontrada." };
  }

  let rows: { id: string; name: string; dueDate: Date | null; documentName: string | null; documentUrl: string | null; createdAt: Date }[] = [];
  try {
    rows = await prisma.customProjectSectionActivity.findMany({
      where: { sectionId: args.sectionId, deletedAt: null },
      select: { id: true, name: true, dueDate: true, documentName: true, documentUrl: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }],
    });
  } catch (e) {
    return { success: false as const, error: getDbErrorMessage(e) };
  }

  return {
    success: true as const,
    section: { id: section.id, name: section.name, enabled: section.enabled },
    canManage: access.canManage,
    activities: rows.map((r) => ({
      id: r.id,
      name: r.name,
      dueDate: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : null,
      documentName: r.documentName ?? null,
      documentUrl: r.documentUrl ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export type CustomSectionActivityDocumentItem = {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
  version: number;
};

export async function listCustomProjectSectionActivityDocuments(args: { projectId: string; activityId: string }) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canView) return { success: false as const, error: "Sin permisos" };

  let activity:
    | {
        id: string;
        documentName: string | null;
        documentUrl: string | null;
        documentKey: string | null;
        documentSizeBytes: number | null;
        documentUploadedAt: Date | null;
        section: { projectId: string };
      }
    | null = null;
  try {
    activity = await prisma.customProjectSectionActivity.findUnique({
      where: { id: args.activityId },
      select: {
        id: true,
        documentName: true,
        documentUrl: true,
        documentKey: true,
        documentSizeBytes: true,
        documentUploadedAt: true,
        section: { select: { projectId: true } },
      },
    });
  } catch (e) {
    return { success: false as const, error: getDbErrorMessage(e) };
  }
  if (!activity || activity.section.projectId !== args.projectId) {
    return { success: false as const, error: "Actividad no encontrada." };
  }

  let rows: { id: string; name: string; url: string; uploadedAt: Date; version: number }[] = [];
  try {
    rows = await prisma.customProjectSectionActivityDocument.findMany({
      where: { activityId: args.activityId, deletedAt: null },
      select: { id: true, name: true, url: true, uploadedAt: true, version: true },
      orderBy: [{ version: "asc" }],
    });
  } catch (e) {
    return { success: false as const, error: getDbErrorMessage(e) };
  }

  if (
    rows.length === 0 &&
    activity.documentName &&
    activity.documentUrl &&
    activity.documentKey
  ) {
    try {
      const created = await prisma.customProjectSectionActivityDocument.create({
        data: {
          activityId: args.activityId,
          name: activity.documentName,
          url: activity.documentUrl,
          key: activity.documentKey,
          sizeBytes: typeof activity.documentSizeBytes === "number" ? activity.documentSizeBytes : null,
          uploadedAt: activity.documentUploadedAt ?? new Date(),
          uploadedByUserId: null,
          version: 1,
        },
        select: { id: true, name: true, url: true, uploadedAt: true, version: true },
      });
      rows = [created];
    } catch (e) {
      return { success: false as const, error: getDbErrorMessage(e) };
    }
  }

  return {
    success: true as const,
    documents: rows.map((r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      uploadedAt: r.uploadedAt.toISOString(),
      version: r.version,
    })),
  };
}

export async function createCustomSectionUploadRequest(args: {
  projectId: string;
  sectionId: string;
  file: { name: string; type: string; sizeBytes: number };
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canManage) return { success: false as const, error: "Sin permisos" };

  let section: { id: string; projectId: string } | null = null;
  try {
    section = await prisma.customProjectSection.findUnique({
      where: { id: args.sectionId },
      select: { id: true, projectId: true },
    });
  } catch (e) {
    return { success: false as const, error: getDbErrorMessage(e) };
  }
  if (!section || section.projectId !== args.projectId) return { success: false as const, error: "Sección no encontrada." };

  const name = args.file?.name || "";
  const type = args.file?.type || "";
  const sizeBytes = args.file?.sizeBytes;
  if (!name || !type) return { success: false as const, error: "Archivo inválido" };
  if (typeof sizeBytes !== "number" || sizeBytes <= 0) return { success: false as const, error: "Tamaño inválido" };
  if (sizeBytes > 20 * 1024 * 1024) return { success: false as const, error: "Máximo 20MB" };

  const ext = name.includes(".") ? name.split(".").pop() : undefined;
  const safeExt = ext ? `.${ext}` : "";
  const key = `custom-sections/${args.projectId}/${args.sectionId}/${randomUUID()}${safeExt}`;
  const uploadUrl = await getPresignedUploadUrl(key, type);
  const url = getPublicUrl(key);

  return { success: true as const, upload: { uploadUrl, url, key, name, type, sizeBytes } };
}

export async function createCustomProjectSectionActivity(args: {
  projectId: string;
  sectionId: string;
  name: string;
  dueDate?: string | null;
  document?: { name: string; url: string; key: string; sizeBytes?: number | null } | null;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canManage) return { success: false as const, error: "Sin permisos" };

  let section: { id: string; projectId: string } | null = null;
  try {
    section = await prisma.customProjectSection.findUnique({
      where: { id: args.sectionId },
      select: { id: true, projectId: true },
    });
  } catch (e) {
    return { success: false as const, error: getDbErrorMessage(e) };
  }
  if (!section || section.projectId !== args.projectId) return { success: false as const, error: "Sección no encontrada." };

  const name = args.name.trim();
  if (!name) return { success: false as const, error: "Nombre requerido." };

  const dueDate = args.dueDate ? new Date(args.dueDate) : null;
  if (dueDate && isNaN(dueDate.getTime())) return { success: false as const, error: "Fecha inválida." };

  try {
    const created = await prisma.customProjectSectionActivity.create({
      data: { sectionId: args.sectionId, name, dueDate },
      select: { id: true },
    });

    if (args.document) {
      const now = new Date();
      await prisma.$transaction([
        prisma.customProjectSectionActivityDocument.create({
          data: {
            activityId: created.id,
            name: args.document.name,
            url: args.document.url,
            key: args.document.key,
            sizeBytes: typeof args.document.sizeBytes === "number" ? args.document.sizeBytes : null,
            uploadedAt: now,
            uploadedByUserId: user.id,
            version: 1,
          },
          select: { id: true },
        }),
        prisma.customProjectSectionActivity.update({
          where: { id: created.id },
          data: {
            documentName: args.document.name,
            documentUrl: args.document.url,
            documentKey: args.document.key,
            documentSizeBytes: typeof args.document.sizeBytes === "number" ? args.document.sizeBytes : null,
            documentUploadedAt: now,
          },
          select: { id: true },
        }),
      ]);
    }

    await prisma.auditLog.create({
      data: {
        action: "CREATE_CUSTOM_SECTION_ACTIVITY",
        entity: "CustomProjectSectionActivity",
        entityId: created.id,
        performedBy: user.id,
        details: JSON.stringify({ projectId: args.projectId, sectionId: args.sectionId }),
      },
    });

    revalidatePath(`/projects/${args.projectId}`);
    return { success: true as const, activityId: created.id };
  } catch (e) {
    return { success: false as const, error: getDbErrorMessage(e) };
  }
}

export async function updateCustomProjectSectionActivity(args: {
  projectId: string;
  activityId: string;
  name: string;
  dueDate?: string | null;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canManage) return { success: false as const, error: "Sin permisos" };

  let activity: { id: string; section: { id: string; projectId: string } } | null = null;
  try {
    activity = await prisma.customProjectSectionActivity.findUnique({
      where: { id: args.activityId },
      select: { id: true, section: { select: { id: true, projectId: true } } },
    });
  } catch (e) {
    return { success: false as const, error: getDbErrorMessage(e) };
  }
  if (!activity || activity.section.projectId !== args.projectId) {
    return { success: false as const, error: "Actividad no encontrada." };
  }

  const name = args.name.trim();
  if (!name) return { success: false as const, error: "Nombre requerido." };

  const dueDate = args.dueDate ? new Date(args.dueDate) : null;
  if (dueDate && isNaN(dueDate.getTime())) return { success: false as const, error: "Fecha inválida." };

  try {
    await prisma.customProjectSectionActivity.update({
      where: { id: args.activityId },
      data: { name, dueDate },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE_CUSTOM_SECTION_ACTIVITY",
        entity: "CustomProjectSectionActivity",
        entityId: args.activityId,
        performedBy: user.id,
        details: JSON.stringify({ projectId: args.projectId, sectionId: activity.section.id }),
      },
    });

    revalidatePath(`/projects/${args.projectId}`);
    return { success: true as const };
  } catch (e) {
    return { success: false as const, error: getDbErrorMessage(e) };
  }
}

export async function attachCustomProjectSectionActivityDocument(args: {
  projectId: string;
  activityId: string;
  document: { name: string; url: string; key: string; sizeBytes?: number | null };
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canManage) return { success: false as const, error: "Sin permisos" };

  let activity: { id: string; section: { id: string; projectId: string } } | null = null;
  try {
    activity = await prisma.customProjectSectionActivity.findUnique({
      where: { id: args.activityId },
      select: { id: true, section: { select: { id: true, projectId: true } } },
    });
  } catch (e) {
    return { success: false as const, error: getDbErrorMessage(e) };
  }
  if (!activity || activity.section.projectId !== args.projectId) {
    return { success: false as const, error: "Actividad no encontrada." };
  }

  try {
    const now = new Date();
    const max = await prisma.customProjectSectionActivityDocument.aggregate({
      where: { activityId: args.activityId },
      _max: { version: true },
    });
    const nextVersion = (max._max.version ?? 0) + 1;

    await prisma.$transaction([
      prisma.customProjectSectionActivityDocument.create({
        data: {
          activityId: args.activityId,
          name: args.document.name,
          url: args.document.url,
          key: args.document.key,
          sizeBytes: typeof args.document.sizeBytes === "number" ? args.document.sizeBytes : null,
          uploadedAt: now,
          uploadedByUserId: user.id,
          version: nextVersion,
        },
        select: { id: true },
      }),
      prisma.customProjectSectionActivity.update({
        where: { id: args.activityId },
        data: {
          documentName: args.document.name,
          documentUrl: args.document.url,
          documentKey: args.document.key,
          documentSizeBytes: typeof args.document.sizeBytes === "number" ? args.document.sizeBytes : null,
          documentUploadedAt: now,
        },
        select: { id: true },
      }),
    ]);

    await prisma.auditLog.create({
      data: {
        action: "ATTACH_CUSTOM_SECTION_ACTIVITY_DOCUMENT",
        entity: "CustomProjectSectionActivity",
        entityId: args.activityId,
        performedBy: user.id,
        details: JSON.stringify({ projectId: args.projectId, sectionId: activity.section.id, file: args.document.name }),
      },
    });

    revalidatePath(`/projects/${args.projectId}`);
    return { success: true as const };
  } catch (e) {
    return { success: false as const, error: getDbErrorMessage(e) };
  }
}

export async function removeCustomProjectSectionActivityDocument(args: { projectId: string; activityId: string }) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canManage) return { success: false as const, error: "Sin permisos" };

  let activity: { id: string; documentName: string | null; section: { id: string; projectId: string } } | null = null;
  try {
    activity = await prisma.customProjectSectionActivity.findUnique({
      where: { id: args.activityId },
      select: {
        id: true,
        documentName: true,
        section: { select: { id: true, projectId: true } },
      },
    });
  } catch (e) {
    return { success: false as const, error: getDbErrorMessage(e) };
  }
  if (!activity || activity.section.projectId !== args.projectId) {
    return { success: false as const, error: "Actividad no encontrada." };
  }

  try {
    const now = new Date();
    const latest = await prisma.customProjectSectionActivityDocument.findFirst({
      where: { activityId: args.activityId, deletedAt: null },
      select: { id: true, name: true, url: true, key: true, sizeBytes: true },
      orderBy: [{ version: "desc" }],
    });

    if (latest) {
      await prisma.customProjectSectionActivityDocument.update({
        where: { id: latest.id },
        data: { deletedAt: now },
      });
    }

    const nextLatest = await prisma.customProjectSectionActivityDocument.findFirst({
      where: { activityId: args.activityId, deletedAt: null },
      select: { id: true, name: true, url: true, key: true, sizeBytes: true, uploadedAt: true },
      orderBy: [{ version: "desc" }],
    });

    await prisma.customProjectSectionActivity.update({
      where: { id: args.activityId },
      data: nextLatest
        ? {
            documentName: nextLatest.name,
            documentUrl: nextLatest.url,
            documentKey: nextLatest.key,
            documentSizeBytes: typeof nextLatest.sizeBytes === "number" ? nextLatest.sizeBytes : null,
            documentUploadedAt: nextLatest.uploadedAt,
          }
        : {
            documentName: null,
            documentUrl: null,
            documentKey: null,
            documentSizeBytes: null,
            documentUploadedAt: null,
          },
      select: { id: true },
    });

    await prisma.auditLog.create({
      data: {
        action: "REMOVE_CUSTOM_SECTION_ACTIVITY_DOCUMENT",
        entity: "CustomProjectSectionActivity",
        entityId: args.activityId,
        performedBy: user.id,
        details: JSON.stringify({ projectId: args.projectId, sectionId: activity.section.id, file: activity.documentName }),
      },
    });

    revalidatePath(`/projects/${args.projectId}`);
    return { success: true as const };
  } catch (e) {
    return { success: false as const, error: getDbErrorMessage(e) };
  }
}

export async function softDeleteCustomProjectSectionActivity(args: { projectId: string; activityId: string }) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canManage) return { success: false as const, error: "Sin permisos" };

  let activity: { id: string; section: { id: string; projectId: string } } | null = null;
  try {
    activity = await prisma.customProjectSectionActivity.findUnique({
      where: { id: args.activityId },
      select: { id: true, section: { select: { id: true, projectId: true } } },
    });
  } catch (e) {
    return { success: false as const, error: getDbErrorMessage(e) };
  }
  if (!activity || activity.section.projectId !== args.projectId) {
    return { success: false as const, error: "Actividad no encontrada." };
  }

  try {
    await prisma.customProjectSectionActivity.update({
      where: { id: args.activityId },
      data: { deletedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        action: "DELETE_CUSTOM_SECTION_ACTIVITY",
        entity: "CustomProjectSectionActivity",
        entityId: args.activityId,
        performedBy: user.id,
        details: JSON.stringify({ projectId: args.projectId, sectionId: activity.section.id }),
      },
    });

    revalidatePath(`/projects/${args.projectId}`);
    return { success: true as const };
  } catch (e) {
    return { success: false as const, error: getDbErrorMessage(e) };
  }
}

export type CustomSectionActivityHistoryItem = {
  id: string;
  action: string;
  details: string | null;
  performedBy: { id: string; name: string | null; role: string } | null;
  createdAt: string;
};

export async function getCustomProjectSectionActivityHistory(args: { projectId: string; activityId: string }) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canView) return { success: false as const, error: "Sin permisos" };

  let activity: { id: string; section: { projectId: string } } | null = null;
  try {
    activity = await prisma.customProjectSectionActivity.findUnique({
      where: { id: args.activityId },
      select: { id: true, section: { select: { projectId: true } } },
    });
  } catch (e) {
    return { success: false as const, error: getDbErrorMessage(e) };
  }
  if (!activity || activity.section.projectId !== args.projectId) {
    return { success: false as const, error: "Actividad no encontrada." };
  }

  let rows: { id: string; action: string; details: string | null; performedBy: string; createdAt: Date }[] = [];
  try {
    rows = await prisma.auditLog.findMany({
      where: { entity: "CustomProjectSectionActivity", entityId: args.activityId },
      select: { id: true, action: true, details: true, performedBy: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
    });
  } catch (e) {
    return { success: false as const, error: getDbErrorMessage(e) };
  }

  const userIds = Array.from(new Set(rows.map((r) => r.performedBy).filter(Boolean)));
  let users: { id: string; name: string | null; role: string }[] = [];
  try {
    users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, role: true },
        })
      : [];
  } catch (e) {
    return { success: false as const, error: getDbErrorMessage(e) };
  }
  const map = new Map(users.map((u) => [u.id, u]));

  return {
    success: true as const,
    history: rows.map((r) => {
      const u = map.get(r.performedBy);
      return {
        id: r.id,
        action: r.action,
        details: r.details ?? null,
        performedBy: u ? { id: u.id, name: u.name, role: u.role } : null,
        createdAt: r.createdAt.toISOString(),
      };
    }),
  };
}
