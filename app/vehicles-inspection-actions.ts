'use server'

import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/app/auth-actions";
import { getPresignedUploadUrl, getPublicUrl } from "@/lib/s3";
import { Prisma } from "@prisma/client";
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

export async function createVehicleInspectionUploadRequest(args: {
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
      const key = `vehicle-inspection/${args.projectId}/${randomUUID()}${safeExt}`;
      const uploadUrl = await getPresignedUploadUrl(key, f.type);
      const url = getPublicUrl(key);
      return { name: f.name, key, uploadUrl, url, sizeBytes: f.sizeBytes, type: f.type };
    })
  );

  return { success: true as const, uploads };
}

export async function listVehicleInspectionVehicles(args: { projectId: string }) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canView) return { success: false as const, error: "Sin permisos" };

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      plate: string;
      brand: string | null;
      line: string | null;
      model: string | null;
      vin: string | null;
      engineNumber: string | null;
      transitLicense: string | null;
      displacement: string | null;
      color: string | null;
      mileage: string | null;
      ownerName: string | null;
      ownerId: string | null;
      verificationDate: Date;
      soatDueDate: Date | null;
      rtmDueDate: Date | null;
      documentsCount: number;
      driverId: string | null;
      firstName: string | null;
      secondName: string | null;
      firstSurname: string | null;
      secondSurname: string | null;
      documentNumber: string | null;
    }>
  >(
    Prisma.sql`
      SELECT
        v."id" as "id",
        v."plate" as "plate",
        v."brand" as "brand",
        v."line" as "line",
        v."model" as "model",
        v."vin" as "vin",
        v."engineNumber" as "engineNumber",
        v."transitLicense" as "transitLicense",
        v."displacement" as "displacement",
        v."color" as "color",
        v."mileage" as "mileage",
        v."ownerName" as "ownerName",
        v."ownerId" as "ownerId",
        v."verificationDate" as "verificationDate",
        v."soatDueDate" as "soatDueDate",
        v."rtmDueDate" as "rtmDueDate",
        v."driverCollaboratorId" as "driverId",
        c."firstName" as "firstName",
        c."secondName" as "secondName",
        c."firstSurname" as "firstSurname",
        c."secondSurname" as "secondSurname",
        c."documentNumber" as "documentNumber",
        (
          SELECT COUNT(*)::int
          FROM vehicle_inspection_document d
          WHERE d."vehicleId" = v."id" AND d."deletedAt" IS NULL
        ) as "documentsCount"
      FROM vehicle_inspection_vehicle v
      LEFT JOIN "Collaborator" c ON c."id" = v."driverCollaboratorId"
      WHERE v."projectId" = ${args.projectId}
      ORDER BY v."createdAt" DESC
    `
  );

  return {
    success: true as const,
    vehicles: rows.map((r) => ({
      id: r.id,
      plate: r.plate,
      brand: r.brand,
      line: r.line,
      model: r.model,
      vin: r.vin,
      engineNumber: r.engineNumber,
      transitLicense: r.transitLicense,
      displacement: r.displacement,
      color: r.color,
      mileage: r.mileage,
      ownerName: r.ownerName,
      ownerId: r.ownerId,
      verificationDate: r.verificationDate.toISOString(),
      soatDueDate: r.soatDueDate ? r.soatDueDate.toISOString() : null,
      rtmDueDate: r.rtmDueDate ? r.rtmDueDate.toISOString() : null,
      documentsCount: r.documentsCount,
      driver:
        r.driverId && r.firstName && r.firstSurname
          ? {
              id: r.driverId,
              name: `${r.firstName}${r.secondName ? ` ${r.secondName}` : ""} ${r.firstSurname}${r.secondSurname ? ` ${r.secondSurname}` : ""}${r.documentNumber ? ` (${r.documentNumber})` : ""}`,
            }
          : null,
    })),
  };
}

export async function listVehicleInspectionDocuments(args: { projectId: string; vehicleId: string }) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canView) return { success: false as const, error: "Sin permisos" };

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      kind: string;
      name: string;
      url: string;
      key: string;
      sizeBytes: number | null;
      uploadedAt: Date;
    }>
  >(
    Prisma.sql`
      SELECT d."id", d."kind", d."name", d."url", d."key", d."sizeBytes", d."uploadedAt"
      FROM vehicle_inspection_document d
      INNER JOIN vehicle_inspection_vehicle v ON v."id" = d."vehicleId"
      WHERE
        v."projectId" = ${args.projectId}
        AND d."vehicleId" = ${args.vehicleId}
        AND d."deletedAt" IS NULL
      ORDER BY d."uploadedAt" DESC
    `
  );

  return {
    success: true as const,
    documents: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      name: r.name,
      url: r.url,
      key: r.key,
      sizeBytes: r.sizeBytes,
      uploadedAt: r.uploadedAt.toISOString(),
    })),
  };
}

export async function createVehicleInspectionVehicle(args: {
  projectId: string;
  verificationDate: string;
  plate: string;
  vin?: string | null;
  engineNumber?: string | null;
  model?: string | null;
  transitLicense?: string | null;
  brand?: string | null;
  line?: string | null;
  displacement?: string | null;
  color?: string | null;
  mileage?: string | null;
  ownerName?: string | null;
  ownerId?: string | null;
  driverCollaboratorId?: string | null;
  soatDueDate?: string | null;
  rtmDueDate?: string | null;
  documents?: Array<{ kind: "SOAT" | "RTM" | "PROPERTY_CARD"; name: string; url: string; key: string; sizeBytes?: number | null }>;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canManage) return { success: false as const, error: "Sin permisos" };

  const verificationDate = new Date(args.verificationDate);
  if (isNaN(verificationDate.getTime())) {
    return { success: false as const, error: "Fecha de verificación inválida." };
  }

  const plate = args.plate.trim().toUpperCase();
  if (!plate) return { success: false as const, error: "Placa requerida." };

  const soatDueDate = args.soatDueDate ? new Date(args.soatDueDate) : null;
  if (soatDueDate && isNaN(soatDueDate.getTime())) return { success: false as const, error: "Fecha SOAT inválida." };

  const rtmDueDate = args.rtmDueDate ? new Date(args.rtmDueDate) : null;
  if (rtmDueDate && isNaN(rtmDueDate.getTime())) return { success: false as const, error: "Fecha RTM inválida." };

  const documents = Array.isArray(args.documents) ? args.documents : [];

  const createdId = await prisma.$transaction(async (tx) => {
    const vehicleId = randomUUID();
    const now = new Date();
    await tx.$executeRaw(
      Prisma.sql`
        INSERT INTO vehicle_inspection_vehicle (
          "id",
          "projectId",
          "verificationDate",
          "plate",
          "vin",
          "engineNumber",
          "model",
          "transitLicense",
          "brand",
          "line",
          "displacement",
          "color",
          "mileage",
          "ownerName",
          "ownerId",
          "driverCollaboratorId",
          "soatDueDate",
          "rtmDueDate",
          "createdAt",
          "updatedAt"
        ) VALUES (
          ${vehicleId},
          ${args.projectId},
          ${verificationDate},
          ${plate},
          ${args.vin?.trim() || null},
          ${args.engineNumber?.trim() || null},
          ${args.model?.trim() || null},
          ${args.transitLicense?.trim() || null},
          ${args.brand?.trim() || null},
          ${args.line?.trim() || null},
          ${args.displacement?.trim() || null},
          ${args.color?.trim() || null},
          ${args.mileage?.trim() || null},
          ${args.ownerName?.trim() || null},
          ${args.ownerId?.trim() || null},
          ${args.driverCollaboratorId?.trim() || null},
          ${soatDueDate},
          ${rtmDueDate},
          ${now},
          ${now}
        )
      `
    );

    if (documents.length > 0) {
      for (const d of documents) {
        const docId = randomUUID();
        await tx.$executeRaw(
          Prisma.sql`
            INSERT INTO vehicle_inspection_document (
              "id",
              "vehicleId",
              "kind",
              "name",
              "url",
              "key",
              "sizeBytes",
              "uploadedAt",
              "deletedAt"
            ) VALUES (
              ${docId},
              ${vehicleId},
              ${d.kind},
              ${d.name},
              ${d.url},
              ${d.key},
              ${d.sizeBytes ?? null},
              ${now},
              NULL
            )
          `
        );
      }
    }

    await tx.auditLog.create({
      data: {
        action: "CREATE_VEHICLE_INSPECTION_VEHICLE",
        entity: "VehicleInspectionVehicle",
        entityId: vehicleId,
        performedBy: user.id,
        details: JSON.stringify({
          projectId: args.projectId,
          plate,
          docsCount: documents.length,
        }),
      },
    });

    return vehicleId;
  });

  revalidatePath(`/projects/${args.projectId}`);

  return { success: true as const, vehicleId: createdId };
}

export async function updateVehicleInspectionVehicle(args: {
  projectId: string;
  vehicleId: string;
  verificationDate: string;
  plate: string;
  vin?: string | null;
  engineNumber?: string | null;
  model?: string | null;
  transitLicense?: string | null;
  brand?: string | null;
  line?: string | null;
  displacement?: string | null;
  color?: string | null;
  mileage?: string | null;
  ownerName?: string | null;
  ownerId?: string | null;
  driverCollaboratorId?: string | null;
  soatDueDate?: string | null;
  rtmDueDate?: string | null;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canManage) return { success: false as const, error: "Sin permisos" };

  const verificationDate = new Date(args.verificationDate);
  if (isNaN(verificationDate.getTime())) return { success: false as const, error: "Fecha de verificación inválida." };

  const plate = args.plate.trim().toUpperCase();
  if (!plate) return { success: false as const, error: "Placa requerida." };

  const soatDueDate = args.soatDueDate ? new Date(args.soatDueDate) : null;
  if (soatDueDate && isNaN(soatDueDate.getTime())) return { success: false as const, error: "Fecha SOAT inválida." };
  const rtmDueDate = args.rtmDueDate ? new Date(args.rtmDueDate) : null;
  if (rtmDueDate && isNaN(rtmDueDate.getTime())) return { success: false as const, error: "Fecha RTM inválida." };

  const now = new Date();
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE vehicle_inspection_vehicle
      SET
        "verificationDate" = ${verificationDate},
        "plate" = ${plate},
        "vin" = ${args.vin?.trim() || null},
        "engineNumber" = ${args.engineNumber?.trim() || null},
        "model" = ${args.model?.trim() || null},
        "transitLicense" = ${args.transitLicense?.trim() || null},
        "brand" = ${args.brand?.trim() || null},
        "line" = ${args.line?.trim() || null},
        "displacement" = ${args.displacement?.trim() || null},
        "color" = ${args.color?.trim() || null},
        "mileage" = ${args.mileage?.trim() || null},
        "ownerName" = ${args.ownerName?.trim() || null},
        "ownerId" = ${args.ownerId?.trim() || null},
        "driverCollaboratorId" = ${args.driverCollaboratorId?.trim() || null},
        "soatDueDate" = ${soatDueDate},
        "rtmDueDate" = ${rtmDueDate},
        "updatedAt" = ${now}
      WHERE "id" = ${args.vehicleId} AND "projectId" = ${args.projectId}
    `
  );

  await prisma.auditLog.create({
    data: {
      action: "UPDATE_VEHICLE_INSPECTION_VEHICLE",
      entity: "VehicleInspectionVehicle",
      entityId: args.vehicleId,
      performedBy: user.id,
      details: JSON.stringify({ projectId: args.projectId, plate }),
    },
  });

  revalidatePath(`/projects/${args.projectId}`);
  return { success: true as const };
}

export async function deleteVehicleInspectionVehicle(args: { projectId: string; vehicleId: string }) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canManage) return { success: false as const, error: "Sin permisos" };

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`DELETE FROM vehicle_inspection_document WHERE "vehicleId" = ${args.vehicleId}`);
    await tx.$executeRaw(
      Prisma.sql`DELETE FROM vehicle_inspection_vehicle WHERE "id" = ${args.vehicleId} AND "projectId" = ${args.projectId}`
    );
    await tx.auditLog.create({
      data: {
        action: "DELETE_VEHICLE_INSPECTION_VEHICLE",
        entity: "VehicleInspectionVehicle",
        entityId: args.vehicleId,
        performedBy: user.id,
        details: JSON.stringify({ projectId: args.projectId }),
      },
    });
  });

  revalidatePath(`/projects/${args.projectId}`);
  return { success: true as const };
}
