'use server'

import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/app/auth-actions";
import { getPresignedUploadUrl, getPublicUrl } from "@/lib/s3";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { publishDriversEvent } from "@/lib/realtime/drivers-bus";

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

export async function createDriverInspectionUploadRequest(args: {
  projectId: string;
  files: Array<{ name: string; type: string; sizeBytes: number; kind: "LICENSE" | "EVALUATION" }>;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canManage) return { success: false as const, error: "Sin permisos" };

  if (!Array.isArray(args.files)) return { success: false as const, error: "Archivos inválidos" };

  for (const f of args.files) {
    if (!f?.name || !f?.type || !f?.kind) return { success: false as const, error: "Archivo inválido" };
    if (typeof f.sizeBytes !== "number" || f.sizeBytes <= 0) return { success: false as const, error: "Tamaño inválido" };
    if (f.sizeBytes > 20 * 1024 * 1024) return { success: false as const, error: "Máximo 20MB por archivo" };
  }

  const uploads = await Promise.all(
    args.files.map(async (f) => {
      const ext = f.name.includes(".") ? f.name.split(".").pop() : undefined;
      const safeExt = ext ? `.${ext}` : "";
      const key = `drivers-inspection/${args.projectId}/${f.kind.toLowerCase()}/${randomUUID()}${safeExt}`;
      const uploadUrl = await getPresignedUploadUrl(key, f.type);
      const url = getPublicUrl(key);
      return { kind: f.kind, name: f.name, key, uploadUrl, url, sizeBytes: f.sizeBytes, type: f.type };
    })
  );

  return { success: true as const, uploads };
}

export async function syncDriverInspectionDriversFromCollaborators(args: { projectId: string }) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canManage) return { success: false as const, error: "Sin permisos" };

  const collaborators = await prisma.collaborator.findMany({
    where: { projectId: args.projectId, driverRole: "CONDUCTOR", status: "ACTIVE" },
    select: {
      documentType: true,
      documentNumber: true,
      firstName: true,
      secondName: true,
      firstSurname: true,
      secondSurname: true,
      position: true,
    },
  });

  const now = new Date();

  for (const c of collaborators) {
    const fullName = [c.firstName, c.secondName, c.firstSurname, c.secondSurname].filter(Boolean).join(" ").trim();
    const documentNumber = c.documentNumber.trim();

    await prisma.$executeRaw(
      Prisma.sql`
        UPDATE driver_inspection_driver
        SET
          fullname = ${fullName},
          documenttype = ${c.documentType},
          position = ${c.position},
          updatedat = ${now}
        WHERE projectid = ${args.projectId}
          AND documentnumber = ${documentNumber}
      `
    );

    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO driver_inspection_driver (
          id,
          projectid,
          fullname,
          documenttype,
          documentnumber,
          position,
          createdat,
          updatedat
        )
        SELECT
          ${randomUUID()},
          ${args.projectId},
          ${fullName},
          ${c.documentType},
          ${documentNumber},
          ${c.position},
          ${now},
          ${now}
        WHERE NOT EXISTS (
          SELECT 1
          FROM driver_inspection_driver d
          WHERE d.projectid = ${args.projectId}
            AND d.documentnumber = ${documentNumber}
        )
      `
    );
  }

  revalidatePath(`/projects/${args.projectId}`);
  publishDriversEvent({ type: "drivers_inspection_changed", payload: { projectId: args.projectId, ts: Date.now() } });
  return { success: true as const, processed: collaborators.length };
}

export async function listDriverInspectionDrivers(args: { projectId: string }) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canView) return { success: false as const, error: "Sin permisos" };

  try {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        fullName: string;
        documentType: string;
        documentNumber: string;
        position: string | null;
        licenseCategory: string | null;
        licenseDueDate: Date | null;
        licenseStatus: string | null;
        roadSafetyTraining: boolean | null;
        evaluationDueDate: Date | null;
        vehiclePlate: string | null;
        missionTripsPlanner: string | null;
        documentsCount: number;
        createdAt: Date;
      }>
    >(
      Prisma.sql`
        SELECT
          d.id as "id",
          d.fullname as "fullName",
          d.documenttype as "documentType",
          d.documentnumber as "documentNumber",
          d.position as "position",
          d.licensecategory as "licenseCategory",
          d.licenseduedate as "licenseDueDate",
          d.licensestatus as "licenseStatus",
          d.roadsafetytraining as "roadSafetyTraining",
          d.evaluationduedate as "evaluationDueDate",
          d.vehicleplate as "vehiclePlate",
          d.missiontripsplanner as "missionTripsPlanner",
          (
            SELECT COUNT(*)::int
            FROM driver_inspection_document dd
            WHERE dd.driverid = d.id AND dd.deletedat IS NULL
          ) as "documentsCount",
          d.createdat as "createdAt"
        FROM driver_inspection_driver d
        WHERE d.projectid = ${args.projectId}
        ORDER BY d.createdat DESC
      `
    );

    return {
      success: true as const,
      drivers: rows.map((r) => ({
        id: r.id,
        fullName: r.fullName,
        documentType: r.documentType,
        documentNumber: r.documentNumber,
        position: r.position,
        licenseCategory: r.licenseCategory,
        licenseDueDate: r.licenseDueDate ? r.licenseDueDate.toISOString() : null,
        licenseStatus: r.licenseStatus,
        roadSafetyTraining: r.roadSafetyTraining,
        evaluationDueDate: r.evaluationDueDate ? r.evaluationDueDate.toISOString() : null,
        vehiclePlate: r.vehiclePlate,
        missionTripsPlanner: r.missionTripsPlanner,
        documentsCount: r.documentsCount,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudieron cargar los conductores.";
    return { success: false as const, error: message };
  }
}

export async function listDriverInspectionDocuments(args: { projectId: string; driverId: string }) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canView) return { success: false as const, error: "Sin permisos" };

  try {
    const rows = await prisma.$queryRaw<
      Array<{ id: string; kind: string; name: string; url: string; key: string; sizeBytes: number | null; uploadedAt: Date }>
    >(
      Prisma.sql`
        SELECT dd.id, dd.kind, dd.name, dd.url, dd.key, dd.sizebytes as "sizeBytes", dd.uploadedat as "uploadedAt"
        FROM driver_inspection_document dd
        INNER JOIN driver_inspection_driver d ON d.id = dd.driverid
        WHERE d.projectid = ${args.projectId}
          AND dd.driverid = ${args.driverId}
          AND dd.deletedat IS NULL
        ORDER BY dd.uploadedat DESC
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
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudieron cargar los documentos.";
    return { success: false as const, error: message };
  }
}

export async function createDriverInspectionDriver(args: {
  projectId: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
  position?: string | null;
  licenseCategory?: string | null;
  licenseDueDate?: string | null;
  licenseStatus?: "Alta" | "Media" | "Baja" | null;
  roadSafetyTraining?: boolean | null;
  evaluationDueDate?: string | null;
  vehiclePlate?: string | null;
  missionTripsPlanner?: string | null;
  documents?: Array<{ kind: "LICENSE" | "EVALUATION"; name: string; url: string; key: string; sizeBytes?: number | null }>;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canManage) return { success: false as const, error: "Sin permisos" };

  const fullName = args.fullName.trim();
  if (!fullName) return { success: false as const, error: "Nombres requeridos." };
  const documentType = args.documentType.trim();
  if (!documentType) return { success: false as const, error: "Tipo de documento requerido." };
  const documentNumber = args.documentNumber.trim();
  if (!documentNumber) return { success: false as const, error: "N° de documento requerido." };

  const licenseDueDate = args.licenseDueDate ? new Date(args.licenseDueDate) : null;
  if (licenseDueDate && isNaN(licenseDueDate.getTime())) return { success: false as const, error: "Fecha vencimiento licencia inválida." };

  const evaluationDueDate = args.evaluationDueDate ? new Date(args.evaluationDueDate) : null;
  if (evaluationDueDate && isNaN(evaluationDueDate.getTime())) return { success: false as const, error: "Fecha evaluación inválida." };

  const documents = Array.isArray(args.documents) ? args.documents : [];

  const createdId = await prisma.$transaction(async (tx) => {
    const driverId = randomUUID();
    const now = new Date();
    await tx.$executeRaw(
      Prisma.sql`
        INSERT INTO driver_inspection_driver (
          id,
          projectid,
          fullname,
          documenttype,
          documentnumber,
          position,
          licensecategory,
          licenseduedate,
          licensestatus,
          roadsafetytraining,
          evaluationduedate,
          vehicleplate,
          missiontripsplanner,
          createdat,
          updatedat
        ) VALUES (
          ${driverId},
          ${args.projectId},
          ${fullName},
          ${documentType},
          ${documentNumber},
          ${args.position?.trim() || null},
          ${args.licenseCategory?.trim() || null},
          ${licenseDueDate},
          ${args.licenseStatus || null},
          ${typeof args.roadSafetyTraining === "boolean" ? args.roadSafetyTraining : null},
          ${evaluationDueDate},
          ${args.vehiclePlate?.trim() || null},
          ${args.missionTripsPlanner?.trim() || null},
          ${now},
          ${now}
        )
      `
    );

    for (const d of documents) {
      const docId = randomUUID();
      await tx.$executeRaw(
        Prisma.sql`
          INSERT INTO driver_inspection_document (
            id,
            driverid,
            kind,
            name,
            url,
            key,
            sizebytes,
            uploadedat,
            deletedat
          ) VALUES (
            ${docId},
            ${driverId},
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

    await tx.auditLog.create({
      data: {
        action: "CREATE_DRIVER_INSPECTION_DRIVER",
        entity: "DriverInspectionDriver",
        entityId: driverId,
        performedBy: user.id,
        details: JSON.stringify({ projectId: args.projectId, documentNumber }),
      },
    });

    return driverId;
  });

  revalidatePath(`/projects/${args.projectId}`);
  publishDriversEvent({ type: "drivers_inspection_changed", payload: { projectId: args.projectId, ts: Date.now() } });
  return { success: true as const, driverId: createdId };
}

export async function updateDriverInspectionDriver(args: {
  projectId: string;
  driverId: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
  position?: string | null;
  licenseCategory?: string | null;
  licenseDueDate?: string | null;
  licenseStatus?: "Alta" | "Media" | "Baja" | null;
  roadSafetyTraining?: boolean | null;
  evaluationDueDate?: string | null;
  vehiclePlate?: string | null;
  missionTripsPlanner?: string | null;
  documents?: Array<{ kind: "LICENSE" | "EVALUATION"; name: string; url: string; key: string; sizeBytes?: number | null }>;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canManage) return { success: false as const, error: "Sin permisos" };

  const fullName = args.fullName.trim();
  if (!fullName) return { success: false as const, error: "Nombres requeridos." };
  const documentType = args.documentType.trim();
  if (!documentType) return { success: false as const, error: "Tipo de documento requerido." };
  const documentNumber = args.documentNumber.trim();
  if (!documentNumber) return { success: false as const, error: "N° de documento requerido." };

  const licenseDueDate = args.licenseDueDate ? new Date(args.licenseDueDate) : null;
  if (licenseDueDate && isNaN(licenseDueDate.getTime())) return { success: false as const, error: "Fecha vencimiento licencia inválida." };

  const evaluationDueDate = args.evaluationDueDate ? new Date(args.evaluationDueDate) : null;
  if (evaluationDueDate && isNaN(evaluationDueDate.getTime())) return { success: false as const, error: "Fecha evaluación inválida." };

  const now = new Date();
  const docs = Array.isArray(args.documents) ? args.documents : [];

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`
        UPDATE driver_inspection_driver
        SET
          fullname = ${fullName},
          documenttype = ${documentType},
          documentnumber = ${documentNumber},
          position = ${args.position?.trim() || null},
          licensecategory = ${args.licenseCategory?.trim() || null},
          licenseduedate = ${licenseDueDate},
          licensestatus = ${args.licenseStatus || null},
          roadsafetytraining = ${typeof args.roadSafetyTraining === "boolean" ? args.roadSafetyTraining : null},
          evaluationduedate = ${evaluationDueDate},
          vehicleplate = ${args.vehiclePlate?.trim() || null},
          missiontripsplanner = ${args.missionTripsPlanner?.trim() || null},
          updatedat = ${now}
        WHERE id = ${args.driverId} AND projectid = ${args.projectId}
      `
    );

    if (docs.length > 0) {
      const byKind = new Map<"LICENSE" | "EVALUATION", Array<(typeof docs)[number]>>();
      for (const d of docs) {
        if (!d?.kind || !d?.name || !d?.url || !d?.key) continue;
        const kind = d.kind;
        const list = byKind.get(kind) || [];
        list.push(d);
        byKind.set(kind, list);
      }

      for (const [kind, list] of byKind.entries()) {
        await tx.$executeRaw(
          Prisma.sql`
            UPDATE driver_inspection_document
            SET deletedat = ${now}
            WHERE driverid = ${args.driverId}
              AND kind = ${kind}
              AND deletedat IS NULL
          `
        );

        for (const d of list) {
          await tx.$executeRaw(
            Prisma.sql`
              INSERT INTO driver_inspection_document (
                id,
                driverid,
                kind,
                name,
                url,
                key,
                sizebytes,
                uploadedat,
                deletedat
              ) VALUES (
                ${randomUUID()},
                ${args.driverId},
                ${kind},
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
    }

    await tx.auditLog.create({
      data: {
        action: "UPDATE_DRIVER_INSPECTION_DRIVER",
        entity: "DriverInspectionDriver",
        entityId: args.driverId,
        performedBy: user.id,
        details: JSON.stringify({ projectId: args.projectId, documentNumber, uploadedKinds: docs.map((d) => d.kind) }),
      },
    });
  });

  revalidatePath(`/projects/${args.projectId}`);
  publishDriversEvent({ type: "drivers_inspection_changed", payload: { projectId: args.projectId, ts: Date.now() } });
  return { success: true as const };
}

export async function deleteDriverInspectionDriver(args: { projectId: string; driverId: string }) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  const access = await getProjectAccess(user, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canManage) return { success: false as const, error: "Sin permisos" };

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`DELETE FROM driver_inspection_document WHERE driverid = ${args.driverId}`);
    await tx.$executeRaw(
      Prisma.sql`DELETE FROM driver_inspection_driver WHERE id = ${args.driverId} AND projectid = ${args.projectId}`
    );
    await tx.auditLog.create({
      data: {
        action: "DELETE_DRIVER_INSPECTION_DRIVER",
        entity: "DriverInspectionDriver",
        entityId: args.driverId,
        performedBy: user.id,
        details: JSON.stringify({ projectId: args.projectId }),
      },
    });
  });

  revalidatePath(`/projects/${args.projectId}`);
  publishDriversEvent({ type: "drivers_inspection_changed", payload: { projectId: args.projectId, ts: Date.now() } });
  return { success: true as const };
}
