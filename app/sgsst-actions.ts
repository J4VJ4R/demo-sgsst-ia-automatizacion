'use server'

import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/app/auth-actions";
import { revalidatePath } from "next/cache";
import { getPresignedUploadUrl, getPublicUrl } from "@/lib/s3";
import { allowedSgSstMimeTypes, maxSgSstFileSizeBytes } from "@/lib/sgsst-logic";
import { getDefaultSgSstDesignSections } from "@/lib/sgsst-design-defaults";
import { validateSgSstDueDate } from "@/lib/sgsst-due-logic";
import { isValidPeriodicity, normalizePeriodicity } from "@/lib/periodicity";

type CurrentUser = { id: string; role: string };

function isMissingTableError(error: unknown) {
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code === "P2021";
}

function missingTableMessage() {
  return "La base de datos no tiene la tabla sgsst_design_section. Aplica las migraciones (prisma migrate deploy) y vuelve a intentar.";
}

async function getProjectAccess(user: CurrentUser, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, consultantId: true, clientUserId: true },
  });
  if (!project) return { ok: false as const, error: "Empresa no encontrada." };

  const isAdmin = user.role === "ADMIN_PMD";
  const isProjectConsultant = user.role === "CONSULTANT" && project.consultantId === user.id;
  const isProjectClient = user.role === "CLIENT_VIEWER" && project.clientUserId === user.id;

  const canView = isAdmin || isProjectConsultant || isProjectClient;
  const canManage = isAdmin || isProjectConsultant;

  return { ok: true as const, projectId: project.id, canView, canManage };
}

async function getSectionAccess(user: CurrentUser, sectionId: string) {
  let section: {
    id: string;
    projectId: string;
    isDefault: boolean;
    project: { consultantId: string | null; clientUserId: string | null };
  } | null = null;
  try {
    section = await prisma.sgSstDesignSection.findUnique({
      where: { id: sectionId },
      select: {
        id: true,
        projectId: true,
        isDefault: true,
        project: { select: { consultantId: true, clientUserId: true } },
      },
    });
  } catch (error) {
    if (isMissingTableError(error)) return { ok: false as const, error: missingTableMessage() };
    throw error;
  }
  if (!section) return { ok: false as const, error: "Subsección no encontrada" };

  const isAdmin = user.role === "ADMIN_PMD";
  const isProjectConsultant = user.role === "CONSULTANT" && section.project.consultantId === user.id;
  const isProjectClient = user.role === "CLIENT_VIEWER" && section.project.clientUserId === user.id;

  const canView = isAdmin || isProjectConsultant || isProjectClient;
  const canManage = isAdmin || isProjectConsultant;

  return { ok: true as const, section, canView, canManage };
}

export async function getSgSstDesignSections(projectId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "No autenticado" } as const;

  const access = await getProjectAccess(user, projectId);
  if (!access.ok) return { success: false, error: access.error } as const;
  if (!access.canView) return { success: false, error: "Sin permisos" } as const;

  try {
    await prisma.$executeRaw`SELECT sgsst_refresh_estado_vencimiento(${projectId})`;
  } catch (error) {
    if (isMissingTableError(error)) return { success: false, error: missingTableMessage() } as const;
  }

  let sections;
  try {
    sections = await prisma.sgSstDesignSection.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        files: {
          where: { deletedAt: null },
          orderBy: { uploadedAt: "desc" },
          take: 1,
        },
        _count: {
          select: {
            files: {
              where: { deletedAt: null },
            },
          },
        },
      },
    });
  } catch (error) {
    if (isMissingTableError(error)) return { success: false, error: missingTableMessage() } as const;
    throw error;
  }

  return { success: true, sections } as const;
}

export async function updateSgSstDesignDueDate(sectionId: string, dueDate: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "No autenticado" } as const;

  const access = await getSectionAccess(user, sectionId);
  if (!access.ok) return { success: false, error: access.error } as const;
  if (!access.canManage) return { success: false, error: "Sin permisos" } as const;

  const parsed = validateSgSstDueDate(dueDate);
  if (!parsed.ok) return { success: false, error: parsed.error } as const;

  try {
    await prisma.sgSstDesignSection.update({
      where: { id: sectionId },
      data: { dueDate: parsed.date },
    });
    await prisma.$executeRaw`SELECT sgsst_refresh_estado_vencimiento(${access.section.projectId})`;
  } catch (error) {
    if (isMissingTableError(error)) return { success: false, error: missingTableMessage() } as const;
    throw error;
  }

  revalidatePath(`/projects/${access.section.projectId}`);
  return { success: true } as const;
}

export async function createSgSstDesignSection(projectId: string, name: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "No autenticado" } as const;
  const access = await getProjectAccess(user, projectId);
  if (!access.ok) return { success: false, error: access.error } as const;
  if (!access.canManage) return { success: false, error: "Sin permisos" } as const;

  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: "Nombre requerido" } as const;

  const max = await prisma.sgSstDesignSection.aggregate({
    where: { projectId },
    _max: { sortOrder: true },
  });

  const section = await prisma.sgSstDesignSection.create({
    data: {
      projectId,
      name: trimmed,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
      isDefault: false,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true, section } as const;
}

export async function createSgSstDesignActivity(projectId: string, title: string, dueDate?: string, periodicity?: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "No autenticado" } as const;
  const access = await getProjectAccess(user, projectId);
  if (!access.ok) return { success: false, error: access.error } as const;
  if (!access.canManage) return { success: false, error: "Sin permisos" } as const;

  const trimmedTitle = title.trim();
  if (!trimmedTitle) return { success: false, error: "El nombre de la actividad es obligatorio." } as const;

  const trimmedDue = (dueDate || "").trim();
  const parsedDue = trimmedDue ? validateSgSstDueDate(trimmedDue) : null;
  if (parsedDue && !parsedDue.ok) return { success: false, error: parsedDue.error } as const;

  const periodicityValue = normalizePeriodicity((periodicity || "").trim());
  if (periodicityValue && !isValidPeriodicity(periodicityValue)) {
    return { success: false, error: "Periodicidad inválida." } as const;
  }

  try {
    const max = await prisma.sgSstDesignSection.aggregate({
      where: { projectId },
      _max: { sortOrder: true },
    });

    const section = await prisma.sgSstDesignSection.create({
      data: {
        projectId,
        name: trimmedTitle,
        sortOrder: (max._max.sortOrder ?? 0) + 1,
        isDefault: false,
        dueDate: parsedDue && parsedDue.ok ? parsedDue.date : undefined,
        periodicity: periodicityValue || null,
      },
    });

    try {
      await prisma.$executeRaw`SELECT sgsst_refresh_estado_vencimiento(${projectId})`;
    } catch {}

    revalidatePath(`/projects/${projectId}`);
    return { success: true, section } as const;
  } catch (error) {
    if (isMissingTableError(error)) return { success: false, error: missingTableMessage() } as const;
    throw error;
  }
}

export async function ensureDefaultSgSstDesignSections(projectId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "No autenticado" } as const;

  const access = await getProjectAccess(user, projectId);
  if (!access.ok) return { success: false, error: access.error } as const;
  if (!access.canManage) return { success: false, error: "Sin permisos" } as const;

  let existing;
  try {
    existing = await prisma.sgSstDesignSection.findMany({
      where: { projectId },
      select: { id: true, name: true },
    });
  } catch (error) {
    if (isMissingTableError(error)) return { success: false, error: missingTableMessage() } as const;
    throw error;
  }
  const existingNames = new Set(existing.map((s) => s.name));

  const defaults = getDefaultSgSstDesignSections();
  const toCreate = defaults.filter((name) => !existingNames.has(name));
  if (toCreate.length === 0) return { success: true, created: 0 } as const;

  const max = await prisma.sgSstDesignSection.aggregate({
    where: { projectId },
    _max: { sortOrder: true },
  });
  const start = max._max.sortOrder ?? -1;
  const base = existing.length === 0 ? -1 : start;

  await prisma.sgSstDesignSection.createMany({
    data: toCreate.map((name, idx) => ({
      projectId,
      name,
      sortOrder: existing.length === 0 ? defaults.indexOf(name) : base + idx + 1,
      isDefault: true,
    })),
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true, created: toCreate.length } as const;
}

export async function updateSgSstDesignSection(sectionId: string, name: string, periodicity?: string | null) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "No autenticado" } as const;
  const access = await getSectionAccess(user, sectionId);
  if (!access.ok) return { success: false, error: access.error } as const;
  if (!access.canManage) return { success: false, error: "Sin permisos" } as const;

  const trimmed = name.trim();
  if (!trimmed) return { success: false, error: "Nombre requerido" } as const;

  const periodicityValue = normalizePeriodicity((periodicity || "").trim());
  if (periodicityValue && !isValidPeriodicity(periodicityValue)) {
    return { success: false, error: "Periodicidad inválida." } as const;
  }

  const section = await prisma.sgSstDesignSection.update({
    where: { id: sectionId },
    data: { name: trimmed, periodicity: periodicityValue || null },
  });

  revalidatePath(`/projects/${section.projectId}`);
  return { success: true, section } as const;
}

export async function deleteSgSstDesignSection(sectionId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "No autenticado" } as const;
  const access = await getSectionAccess(user, sectionId);
  if (!access.ok) return { success: false, error: access.error } as const;
  if (!access.canManage) return { success: false, error: "Sin permisos" } as const;

  const section = await prisma.sgSstDesignSection.findUnique({
    where: { id: sectionId },
    include: { files: { where: { deletedAt: null } } },
  });
  if (!section) return { success: false, error: "No encontrado" } as const;
  if (section.isDefault) return { success: false, error: "No se puede eliminar una subsección precargada" } as const;
  if (section.files.length > 0) return { success: false, error: "Elimina los archivos antes de borrar la subsección" } as const;

  await prisma.sgSstDesignSection.delete({ where: { id: sectionId } });
  revalidatePath(`/projects/${section.projectId}`);
  return { success: true } as const;
}

export async function createSgSstDesignUploadRequest(input: {
  sectionId: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "No autenticado" } as const;
  const access = await getSectionAccess(user, input.sectionId);
  if (!access.ok) return { success: false, error: access.error } as const;
  if (!access.canManage) return { success: false, error: "Sin permisos" } as const;

  const mimeOk = (allowedSgSstMimeTypes as readonly string[]).includes(input.mimeType);
  if (!mimeOk) return { success: false, error: "Tipo de archivo no permitido" } as const;
  if (typeof input.sizeBytes === "number" && input.sizeBytes > maxSgSstFileSizeBytes) {
    return { success: false, error: "El archivo supera el tamaño máximo permitido" } as const;
  }

  const key = `sgsst-design/${access.section.projectId}/${access.section.id}/${Date.now()}-${input.fileName}`;
  const uploadUrl = await getPresignedUploadUrl(key, input.mimeType);
  const publicUrl = getPublicUrl(key);

  return { success: true, uploadUrl, publicUrl, key } as const;
}

export async function finalizeSgSstDesignUpload(input: {
  sectionId: string;
  key: string;
  name: string;
  url: string;
  sizeBytes?: number;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "No autenticado" } as const;
  const access = await getSectionAccess(user, input.sectionId);
  if (!access.ok) return { success: false, error: access.error } as const;
  if (!access.canManage) return { success: false, error: "Sin permisos" } as const;

  const latest = await prisma.sgSstDesignFile.findFirst({
    where: { sectionId: input.sectionId, deletedAt: null },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const file = await prisma.sgSstDesignFile.create({
    data: {
      sectionId: input.sectionId,
      name: input.name,
      url: input.url,
      key: input.key,
      version: (latest?.version ?? 0) + 1,
      sizeBytes: input.sizeBytes,
      uploadedByUserId: user.id,
    },
  });

  revalidatePath(`/projects/${access.section.projectId}`);
  return { success: true, file } as const;
}

export async function getSgSstDesignHistory(sectionId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "No autenticado" } as const;
  const access = await getSectionAccess(user, sectionId);
  if (!access.ok) return { success: false, error: access.error } as const;
  if (!access.canView) return { success: false, error: "Sin permisos" } as const;

  const files = await prisma.sgSstDesignFile.findMany({
    where: { sectionId, deletedAt: null },
    orderBy: [{ version: "desc" }, { uploadedAt: "desc" }],
    include: {
      uploadedByUser: { select: { name: true, role: true } },
    },
  });

  return { success: true, files } as const;
}

export async function softDeleteSgSstDesignFile(fileId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "No autenticado" } as const;
  if (user.role !== "ADMIN_PMD" && user.role !== "CONSULTANT") return { success: false, error: "Sin permisos" } as const;

  const file = await prisma.sgSstDesignFile.findUnique({
    where: { id: fileId },
    include: { section: { select: { id: true, projectId: true, project: { select: { consultantId: true } } } } },
  });
  if (!file) return { success: false, error: "Archivo no encontrado" } as const;

  const canManage =
    user.role === "ADMIN_PMD" ||
    (user.role === "CONSULTANT" && file.section.project.consultantId === user.id);
  if (!canManage) return { success: false, error: "Sin permisos" } as const;

  await prisma.sgSstDesignFile.update({
    where: { id: fileId },
    data: { deletedAt: new Date() },
  });

  revalidatePath(`/projects/${file.section.projectId}`);
  return { success: true } as const;
}
