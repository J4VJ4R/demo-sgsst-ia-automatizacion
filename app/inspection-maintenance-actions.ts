'use server'

import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/app/auth-actions";
import { getPresignedUploadUrl, getPublicUrl } from "@/lib/s3";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { DEFAULT_INSPECTION_EQUIPMENT_ACTIVITIES } from "@/lib/inspection-maintenance-default-activities";
import { getInspectionMaintenancePriority } from "@/lib/inspection-maintenance-logic";

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

export async function getInspectionEquipments(projectId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canView) return { success: false as const, error: "Sin permisos" };

  const equipments = await prisma.inspectionEquipment.findMany({
    where: { projectId },
    orderBy: { name: "asc" },
    include: {
      photos: {
        where: { deletedAt: null },
        orderBy: { uploadedAt: "desc" },
      },
    },
  });

  return {
    success: true as const,
    equipments: equipments.map((e) => ({
      id: e.id,
      name: e.name,
      code: e.code,
      location: e.location,
      brand: e.brand,
      model: e.model,
      serial: e.serial,
      teamResponsible: e.teamResponsible,
      teamUser: e.teamUser,
      verificationPeriodicity: e.verificationPeriodicity,
      maintenancePeriodicity: e.maintenancePeriodicity,
      observations: e.observations,
      createdAt: e.createdAt.toISOString(),
      photos: e.photos.map((p) => ({
        id: p.id,
        name: p.name,
        url: p.url,
        uploadedAt: p.uploadedAt.toISOString(),
        sizeBytes: p.sizeBytes ?? null,
      })),
    })),
  };
}

export async function createInspectionEquipmentUploadRequest(args: {
  projectId: string;
  files: Array<{ name: string; type: string; sizeBytes: number }>;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canManage) return { success: false as const, error: "Sin permisos" };

  if (!Array.isArray(args.files)) return { success: false as const, error: "Archivos inválidos" };

  for (const f of args.files) {
    if (!f?.name || !f?.type) return { success: false as const, error: "Archivo inválido" };
    if (typeof f.sizeBytes !== "number" || f.sizeBytes <= 0) return { success: false as const, error: "Tamaño inválido" };
    if (f.sizeBytes > 20 * 1024 * 1024) return { success: false as const, error: "Máximo 20MB por archivo" };
  }

  const uploads = await Promise.all(
    args.files.map(async (f) => {
      const ext = f.name.includes(".") ? f.name.split(".").pop() : undefined;
      const safeExt = ext ? `.${ext}` : "";
      const key = `inspection-equipment/${args.projectId}/${randomUUID()}${safeExt}`;
      const uploadUrl = await getPresignedUploadUrl(key, f.type);
      const url = getPublicUrl(key);
      return { name: f.name, key, uploadUrl, url, sizeBytes: f.sizeBytes, type: f.type };
    })
  );

  return { success: true as const, uploads };
}

export async function createInspectionEquipment(args: {
  projectId: string;
  name: string;
  code?: string | null;
  location?: string | null;
  brand?: string | null;
  model?: string | null;
  serial?: string | null;
  teamResponsible: string;
  teamUser: string;
  verificationPeriodicity: string;
  maintenancePeriodicity: string;
  observations?: string | null;
  photos?: Array<{ name: string; url: string; key: string; sizeBytes?: number | null }>;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canManage) return { success: false as const, error: "Sin permisos" };

  const name = args.name.trim();
  const teamResponsible = args.teamResponsible.trim();
  const teamUser = args.teamUser.trim();
  const verificationPeriodicity = args.verificationPeriodicity.trim();
  const maintenancePeriodicity = args.maintenancePeriodicity.trim();

  if (!name) return { success: false as const, error: "Nombre del equipo requerido" };
  if (!teamResponsible) return { success: false as const, error: "Responsable del equipo requerido" };
  if (!teamUser) return { success: false as const, error: "Usuario del equipo requerido" };
  if (!verificationPeriodicity) return { success: false as const, error: "Periodicidad de verificación requerida" };
  if (!maintenancePeriodicity) return { success: false as const, error: "Periodicidad de mantenimiento requerida" };

  const photos = Array.isArray(args.photos) ? args.photos : [];
  for (const p of photos) {
    if (!p?.name || !p?.url || !p?.key) return { success: false as const, error: "Foto inválida" };
    if (typeof p.sizeBytes === "number" && p.sizeBytes > 20 * 1024 * 1024) return { success: false as const, error: "Máximo 20MB por foto" };
  }

  const result = await prisma.$transaction(async (tx) => {
    const equipment = await tx.inspectionEquipment.create({
      data: {
        projectId: args.projectId,
        name,
        code: args.code?.trim() || null,
        location: args.location?.trim() || null,
        brand: args.brand?.trim() || null,
        model: args.model?.trim() || null,
        serial: args.serial?.trim() || null,
        teamResponsible,
        teamUser,
        verificationPeriodicity,
        maintenancePeriodicity,
        observations: args.observations?.trim() || null,
      },
    });

    if (photos.length > 0) {
      await tx.inspectionEquipmentPhoto.createMany({
        data: photos.map((p) => ({
          equipmentId: equipment.id,
          name: p.name,
          url: p.url,
          key: p.key,
          sizeBytes: p.sizeBytes ?? null,
          uploadedByUserId: user.id,
        })),
      });
    }

    await tx.activity.createMany({
      data: DEFAULT_INSPECTION_EQUIPMENT_ACTIVITIES.map((title) => ({
        title,
        status: "PENDING",
        priority: "Vencido",
        projectId: args.projectId,
        inspectionEquipmentId: equipment.id,
      })),
    });

    await tx.auditLog.create({
      data: {
        action: "CREATE_INSPECTION_EQUIPMENT",
        entity: "InspectionEquipment",
        entityId: equipment.id,
        performedBy: user.id,
        details: JSON.stringify({
          projectId: args.projectId,
          name,
          photosCount: photos.length,
        }),
      },
    });

    return equipment.id;
  });

  revalidatePath(`/projects/${args.projectId}`);
  revalidatePath(`/activities`);
  revalidatePath(`/overview`);

  return { success: true as const, equipmentId: result };
}

export async function updateInspectionEquipment(args: {
  projectId: string;
  equipmentId: string;
  name: string;
  code?: string | null;
  location?: string | null;
  brand?: string | null;
  model?: string | null;
  serial?: string | null;
  teamResponsible: string;
  teamUser: string;
  verificationPeriodicity: string;
  maintenancePeriodicity: string;
  observations?: string | null;
  newPhotos?: Array<{ name: string; url: string; key: string; sizeBytes?: number | null }>;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canManage) return { success: false as const, error: "Sin permisos" };

  const equipment = await prisma.inspectionEquipment.findUnique({
    where: { id: args.equipmentId },
    select: { id: true, projectId: true },
  });
  if (!equipment || equipment.projectId !== args.projectId) {
    return { success: false as const, error: "Equipo no encontrado" };
  }

  const name = args.name.trim();
  const teamResponsible = args.teamResponsible.trim();
  const teamUser = args.teamUser.trim();
  const verificationPeriodicity = args.verificationPeriodicity.trim();
  const maintenancePeriodicity = args.maintenancePeriodicity.trim();

  if (!name) return { success: false as const, error: "Nombre del equipo requerido" };
  if (!teamResponsible) return { success: false as const, error: "Responsable del equipo requerido" };
  if (!teamUser) return { success: false as const, error: "Usuario del equipo requerido" };
  if (!verificationPeriodicity) return { success: false as const, error: "Periodicidad de verificación requerida" };
  if (!maintenancePeriodicity) return { success: false as const, error: "Periodicidad de mantenimiento requerida" };

  const newPhotos = Array.isArray(args.newPhotos) ? args.newPhotos : [];
  for (const p of newPhotos) {
    if (!p?.name || !p?.url || !p?.key) return { success: false as const, error: "Foto inválida" };
    if (typeof p.sizeBytes === "number" && p.sizeBytes > 20 * 1024 * 1024) return { success: false as const, error: "Máximo 20MB por foto" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.inspectionEquipment.update({
      where: { id: args.equipmentId },
      data: {
        name,
        code: args.code?.trim() || null,
        location: args.location?.trim() || null,
        brand: args.brand?.trim() || null,
        model: args.model?.trim() || null,
        serial: args.serial?.trim() || null,
        teamResponsible,
        teamUser,
        verificationPeriodicity,
        maintenancePeriodicity,
        observations: args.observations?.trim() || null,
      },
    });

    if (newPhotos.length > 0) {
      await tx.inspectionEquipmentPhoto.createMany({
        data: newPhotos.map((p) => ({
          equipmentId: args.equipmentId,
          name: p.name,
          url: p.url,
          key: p.key,
          sizeBytes: p.sizeBytes ?? null,
          uploadedByUserId: user.id,
        })),
      });
    }

    await tx.auditLog.create({
      data: {
        action: "UPDATE_INSPECTION_EQUIPMENT",
        entity: "InspectionEquipment",
        entityId: args.equipmentId,
        performedBy: user.id,
        details: JSON.stringify({
          projectId: args.projectId,
          name,
          newPhotosCount: newPhotos.length,
        }),
      },
    });
  });

  revalidatePath(`/projects/${args.projectId}`);
  revalidatePath(`/projects/${args.projectId}/inspection-maintenance/${args.equipmentId}/activities`);
  revalidatePath(`/activities`);
  revalidatePath(`/overview`);

  return { success: true as const };
}

export async function getInspectionEquipmentDetail(args: { projectId: string; equipmentId: string }) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canView) return { success: false as const, error: "Sin permisos" };

  const equipment = await prisma.inspectionEquipment.findUnique({
    where: { id: args.equipmentId },
    include: {
      project: { select: { id: true, name: true, consultantId: true, clientUserId: true } },
      photos: { where: { deletedAt: null }, orderBy: { uploadedAt: "desc" } },
    },
  });
  if (!equipment || equipment.projectId !== args.projectId) return { success: false as const, error: "Equipo no encontrado" };

  return {
    success: true as const,
    equipment: {
      id: equipment.id,
      projectId: equipment.projectId,
      projectName: equipment.project.name,
      name: equipment.name,
      code: equipment.code,
      location: equipment.location,
      brand: equipment.brand,
      model: equipment.model,
      serial: equipment.serial,
      teamResponsible: equipment.teamResponsible,
      teamUser: equipment.teamUser,
      verificationPeriodicity: equipment.verificationPeriodicity,
      maintenancePeriodicity: equipment.maintenancePeriodicity,
      observations: equipment.observations,
      createdAt: equipment.createdAt.toISOString(),
      photos: equipment.photos.map((p) => ({
        id: p.id,
        name: p.name,
        url: p.url,
        uploadedAt: p.uploadedAt.toISOString(),
        sizeBytes: p.sizeBytes ?? null,
      })),
    },
  };
}

export async function getInspectionEquipmentActivities(args: { projectId: string; equipmentId: string }) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canView) return { success: false as const, error: "Sin permisos" };

  const equipment = await prisma.inspectionEquipment.findUnique({
    where: { id: args.equipmentId },
    select: { id: true, projectId: true, name: true, project: { select: { id: true, consultantId: true } } },
  });
  if (!equipment || equipment.projectId !== args.projectId) return { success: false as const, error: "Equipo no encontrado" };

  const existing = await prisma.activity.findMany({
    where: { projectId: args.projectId, inspectionEquipmentId: args.equipmentId },
    select: { id: true, title: true },
  });
  const existingTitles = new Set(existing.map((a) => a.title));
  const missing = DEFAULT_INSPECTION_EQUIPMENT_ACTIVITIES.filter((t) => !existingTitles.has(t));
  if (missing.length > 0) {
    await prisma.activity.createMany({
      data: missing.map((title) => ({
        title,
        status: "PENDING",
        priority: "Baja",
        projectId: args.projectId,
        inspectionEquipmentId: args.equipmentId,
      })),
    });
  }

  const activities = await prisma.activity.findMany({
    where: { projectId: args.projectId, inspectionEquipmentId: args.equipmentId },
    include: {
      documents: {
        where: { deletedAt: null },
        orderBy: { uploadedAt: "desc" },
        include: {
          uploadedByUser: {
            select: { name: true, role: true },
          },
        },
      },
    },
    orderBy: { title: "asc" },
  });

  return {
    success: true as const,
    equipmentName: equipment.name,
    activities: activities.map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      priority: a.priority,
      dueDate: a.dueDate ? a.dueDate.toISOString() : null,
      periodicity: a.periodicity ?? null,
      documents: a.documents.map((d) => ({
        id: d.id,
        name: d.name,
        url: d.url,
        uploadedAt: d.uploadedAt.toISOString(),
        version: d.version,
        sizeBytes: d.sizeBytes ?? null,
        uploadedByUser: d.uploadedByUser,
      })),
    })),
  };
}

export async function updateInspectionActivityDueDate(activityId: string, dueDateIso: string | null) {
  if (!activityId) return { success: false as const, error: "Actividad requerida." };

  const computed = getInspectionMaintenancePriority({ dueDate: dueDateIso });
  if (!computed.ok) {
    return { success: false as const, error: computed.error };
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) return { success: false as const, error: "No autenticado." };

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: { project: true },
  });
  if (!activity || !activity.inspectionEquipmentId) {
    return { success: false as const, error: "Actividad de equipo no encontrada." };
  }

  const userRole = currentUser.role;
  const userId = currentUser.id;
  const isAdmin = userRole === "ADMIN_PMD";
  const isProjectConsultant = userRole === "CONSULTANT" && activity.project.consultantId === userId;

  if (!isAdmin && !isProjectConsultant) {
    return { success: false as const, error: "No tiene permisos para actualizar esta actividad." };
  }

  const dataToUpdate = { dueDate: computed.dueDate, priority: computed.priority };

  await prisma.activity.update({
    where: { id: activityId },
    data: dataToUpdate,
  });

  const basePath = `/projects/${activity.projectId}/inspection-maintenance/${activity.inspectionEquipmentId}/activities`;
  revalidatePath(basePath);

  return { success: true as const };
}
