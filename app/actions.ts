'use server'

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { randomUUID } from "crypto";
import { getCurrentUser } from "@/app/auth-actions";
import { uploadToS3, deleteFromS3, getPresignedUploadUrl, getPublicUrl } from "@/lib/s3";
import { calculatePriority, isUploadAllowed } from "@/lib/priority-logic";
import { buildNotificationQuery } from "@/lib/notification-logic";
import { publishActivitiesEvent } from "@/lib/realtime/activities-bus";
import { publishNotificationsEvent } from "@/lib/realtime/notifications-bus";
import { isValidPeriodicity, normalizePeriodicity } from "@/lib/periodicity";
import type { Prisma } from "@prisma/client";

import { chapterActivities } from "@/lib/activities-data";
import { accidentalidadActivities } from "@/lib/accidentalidad-data";
import { getDefaultSgSstDesignSections } from "@/lib/sgsst-design-defaults";
import { Resend } from 'resend';
import { getSupportTicketEmailTemplate } from "@/lib/email-templates";
import { cookies } from "next/headers";
import { decryptJson } from "@/app/api/google-calendar/_crypto";

let cachedActivityReplyAvailability: boolean | null = null;
async function isActivityReplyAvailable() {
  if (cachedActivityReplyAvailability !== null) return cachedActivityReplyAvailability;
  try {
    await prisma.activityReply.findFirst({ select: { id: true } });
    cachedActivityReplyAvailability = true;
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const normalized = message.toLowerCase();
    if (
      normalized.includes("activityreply") &&
      (normalized.includes("does not exist") ||
        normalized.includes("no existe") ||
        normalized.includes("relation") ||
        normalized.includes("p2021"))
    ) {
      cachedActivityReplyAvailability = false;
      return false;
    }
    cachedActivityReplyAvailability = true;
    return true;
  }
}

// Initialize Resend with a check to avoid runtime errors if key is missing during build/dev
const resendApiKey = process.env.RESEND_API_KEY || 're_123456789'; // Dummy key for dev/build if missing
const resend = new Resend(resendApiKey);

export async function getActivityHistory(activityId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "No autenticado" };

    const documents = await prisma.document.findMany({
      where: {
        activityId,
        deletedAt: null, // Only fetch active documents
      },
      orderBy: { uploadedAt: "desc" },
      include: {
        uploadedByUser: {
          select: { name: true, role: true },
        },
      },
    });

    return { success: true, documents };
  } catch (error) {
    console.error("Error fetching activity history:", error);
    return { success: false, error: "Error al obtener historial" };
  }
}

export async function softDeleteDocument(documentId: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "No autenticado." };
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { activity: { include: { project: true } } },
    });

    if (!document) {
      return { success: false, error: "Documento no encontrado." };
    }

    const userRole = currentUser.role;
    const userId = currentUser.id;

    const isAdmin = userRole === "ADMIN_PMD";
    const isProjectConsultant =
      userRole === "CONSULTANT" && document.activity.project.consultantId === userId;
    const isProjectClient =
      userRole === "CLIENT_VIEWER" && document.activity.project.clientUserId === userId;
    const isUploader = document.uploadedByUserId === userId;

    // Allow if admin, or consultant of the project, or client of the project (if they uploaded it? or just if they are client?)
    // The prompt says "ver y gestionar sus propios archivos cargados".
    // So for client, it's safer to check isUploader.
    // However, if they want "same capabilities as admin" (which can delete anything), maybe client can delete anything in their project?
    // But "sus propios archivos" implies ownership.
    // Let's allow deletion if they are the uploader OR if they are admin.
    // Consultant can probably delete anything in their project.
    
    // Strict interpretation:
    // Admin: Delete any.
    // Consultant: Delete any in their project (as per deleteActivityDocument logic).
    // Client: Delete ONLY if they are the uploader? Or any in their project?
    // "mismas capacidades y restricciones que actualmente tiene el rol administrador" -> "same capabilities ... as admin".
    // Admin can delete *any* document.
    // Does client want to delete *any* document in their project? Or just theirs?
    // "Asegurar que los clientes solo puedan ver y gestionar sus propios archivos cargados"
    // "Ensure clients can only see and manage their own uploaded files".
    // This strongly suggests isUploader check for Clients.
    
    // So:
    // If Admin: OK.
    // If Consultant: OK (assuming they manage the project).
    // If Client: OK ONLY IF isUploader.

    const canDelete = isAdmin || isProjectConsultant || (isProjectClient && isUploader);

    if (!canDelete) {
      return { success: false, error: "No tiene permisos para eliminar este documento." };
    }

    await prisma.$transaction(async (tx) => {
      // Soft delete the document
      await tx.document.update({
        where: { id: documentId },
        data: { deletedAt: new Date() },
      });

      // Check remaining documents
      const remainingCount = await tx.document.count({
        where: { 
          activityId: document.activityId,
          deletedAt: null
        }
      });

      // Update activity status
      await tx.activity.update({
        where: { id: document.activityId },
        data: { status: remainingCount > 0 ? "IN_REVIEW" : "PENDING" },
      });

      // Audit log removed
      await tx.activityHistory.create({
        data: {
          activityId: document.activityId,
          field: "document_delete",
          oldValue: document.name,
          newValue: "DELETED (Soft)",
          changedByUserId: currentUser.id,
        },
      });
    });

    // Revalidate paths
    revalidatePath(`/projects/${document.activity.projectId}`);
    if (document.activity.collaboratorId) {
       revalidatePath(`/projects/${document.activity.projectId}/collaborators/${document.activity.collaboratorId}/activities`);
    }
    revalidatePath("/activities");
    revalidatePath("/overview");

    return { success: true };
  } catch (error) {
    console.error("Failed to soft delete document:", error);
    return { success: false, error: "Error al eliminar el documento." };
  }
}

export async function createCompanyLogoUploadRequest(formData: FormData) {
  try {
    const fileName = formData.get("fileName") as string;
    const fileType = (formData.get("fileType") as string) || "application/octet-stream";
    const fileSizeStr = formData.get("fileSize") as string;
    const fileSize = fileSizeStr ? parseInt(fileSizeStr, 10) : 0;

    if (!fileName) {
      return { success: false, error: "Nombre de archivo requerido" };
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    const maxSizeMB = 5;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (!allowedTypes.includes(fileType)) {
      return {
        success: false,
        error: "Tipo de archivo no permitido. Use imágenes (JPG, PNG, GIF, WEBP).",
      };
    }
    if (fileSize > maxSizeBytes) {
      return { success: false, error: `El archivo supera ${maxSizeMB}MB.` };
    }

    const extMatch = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
    const storedName = `${randomUUID()}${extMatch}`;
    const key = `logos/${storedName}`;

    const uploadUrl = await getPresignedUploadUrl(key, fileType || "application/octet-stream");
    const publicUrl = getPublicUrl(key);

    return {
      success: true,
      uploadUrl,
      publicUrl,
      key,
    };
  } catch (error) {
    console.error("Failed to create logo upload request:", error);
    return { success: false, error: "Error al preparar la subida del logo" };
  }
}

export async function createProject(formData: FormData) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "ADMIN_PMD") {
    return { success: false, error: "No tiene permisos para crear empresas." };
  }

  const name = (formData.get('name') as string | null)?.trim() || ""; // Razón Social
  const clientName = (formData.get('clientName') as string | null)?.trim() || "";
  const consultantId = (formData.get('consultantId') as string | null)?.trim() || "";
  const clientEmail = (formData.get('clientEmail') as string | null)?.trim() || "";
  const clientPassword = (formData.get('clientPassword') as string | null) || "";
  
  // New fields
  const nit = (formData.get('nit') as string | null)?.trim() || "";
  const address = (formData.get('address') as string | null)?.trim() || "";
  const department = (formData.get('department') as string | null)?.trim() || "";
  const municipality = (formData.get('municipality') as string | null)?.trim() || "";
  const phone = (formData.get('phone') as string | null)?.trim() || "";
  const workerCountStr = (formData.get('workerCount') as string | null)?.trim() || "";
  const logoUrl = (formData.get('logoUrl') as string | null)?.trim() || "";
  const chapter = (formData.get('chapter') as string | null)?.trim() || "";
  const status = (formData.get('status') as string | null)?.trim() || "ACTIVE";

  const economicActivity = (formData.get('economicActivity') as string | null)?.trim() || "";
  const ciiu = (formData.get('ciiu') as string | null)?.trim() || "";
  const contractStartDateStr = (formData.get('contractStartDate') as string | null)?.trim() || "";
  const contractNumberStr = (formData.get('contractNumber') as string | null)?.trim() || "";
  const riskLevel = (formData.get('riskLevel') as string | null)?.trim() || "";

  if (!name || !clientName || !consultantId || !clientEmail || !clientPassword || 
      !nit || !address || !department || !municipality || !phone || !workerCountStr || 
      !chapter || !economicActivity || !ciiu || !contractStartDateStr || !contractNumberStr || !riskLevel) {
    return { success: false, error: "Todos los campos obligatorios deben ser completados." };
  }

  // Validations
  if (ciiu.length !== 4 || isNaN(Number(ciiu))) {
     return { success: false, error: "El CIIU debe tener 4 dígitos numéricos" };
  }

  const contractNumber = parseInt(contractNumberStr, 10);
  if (isNaN(contractNumber)) {
     return { success: false, error: "Número de contrato inválido" };
  }
  const workerCount = parseInt(workerCountStr, 10);
  if (isNaN(workerCount)) {
     return { success: false, error: "Número de trabajadores inválido" };
  }

  if (phone.length !== 10 || isNaN(Number(phone))) {
    return { success: false, error: "El teléfono debe tener 10 dígitos numéricos" };
  }

  const existingContract = await prisma.project.findUnique({ where: { contractNumber } });
  if (existingContract) {
    return { success: false, error: "El número de contrato ya existe." };
  }

  const existingNit = await prisma.project.findUnique({ where: { nit } });
  if (existingNit) {
    return { success: false, error: "El NIT ya existe registrado." };
  }

  const contractStartDate = new Date(contractStartDateStr);
  if (isNaN(contractStartDate.getTime())) {
     return { success: false, error: "Fecha de inicio de contrato inválida" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(clientEmail)) {
    return { success: false, error: "El correo del cliente no tiene un formato válido." };
  }

  const hasMinLength = clientPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(clientPassword);
  const hasNumber = /[0-9]/.test(clientPassword);
  const hasSpecial = /[^A-Za-z0-9]/.test(clientPassword);

  if (!hasMinLength || !hasUppercase || !hasNumber || !hasSpecial) {
    return {
      success: false,
      error:
        "La contraseña debe tener mínimo 8 caracteres, una mayúscula, un número y un carácter especial.",
    };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: clientEmail },
  });
  if (existingUser) {
    return { success: false, error: "Ya existe un usuario registrado con ese correo electrónico." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const hashedPassword = await hash(clientPassword, 10);

      const clientUser = await tx.user.create({
        data: {
          name: clientName,
          email: clientEmail,
          password: hashedPassword,
          role: "CLIENT_VIEWER",
        },
      });

      const project = await tx.project.create({
        data: {
          name, // Razón Social
          clientName,
          status,
          consultantId,
          clientUserId: clientUser.id,
          contactEmail: clientEmail,
          economicActivity,
          ciiu,
          contractStartDate,
          contractNumber,
          riskLevel,
          nit,
          address,
          department,
          municipality,
          phone,
          workerCount,
          logoUrl: logoUrl || null,
          chapter,
        },
      });

      // Notify Consultant if assigned
      if (consultantId) {
          await createNotification(tx, {
              recipientId: consultantId,
              title: "Nueva Empresa Asignada",
              message: `Se te ha asignado la empresa "${name}".`,
              type: "SYSTEM_ALERT",
              priority: "HIGH",
              category: "ADMINISTRATIVE",
              functionalArea: "SST",
          });
      }

      // Seed activities based on Chapter
      // @ts-expect-error - chapter is string from form data, mapped to object keys
      const activitiesToSeed = chapterActivities[chapter] || [];
      
      if (activitiesToSeed.length > 0) {
        await tx.activity.createMany({
          data: activitiesToSeed.map((title: string) => ({
            title,
            status: "PENDING",
            projectId: project.id,
            priority: "Media",
            assignedToId: consultantId || null, // Auto-assign to project consultant if set
          })),
        });
      }

      const defaultAccidentalidadDueDate = new Date();
      defaultAccidentalidadDueDate.setDate(defaultAccidentalidadDueDate.getDate() + 31);

      await tx.accidentalidadEmpresa.createMany({
        data: accidentalidadActivities.map((actividad) => ({
          actividad,
          projectId: project.id,
          status: "PENDING",
          priority: "Cumplido",
          dueDate: defaultAccidentalidadDueDate,
        })),
      });

      const sgsstDefaults = getDefaultSgSstDesignSections();
      await tx.sgSstDesignSection.createMany({
        data: sgsstDefaults.map((name, idx) => ({
          projectId: project.id,
          name,
          sortOrder: idx,
          isDefault: true,
        })),
      });

      await tx.projectSection.createMany({
        data: [
          {
            projectId: project.id,
            sectionKey: "requirements",
            enabled: true,
            enabledAt: new Date(),
            enabledBy: currentUser.id,
          },
          { projectId: project.id, sectionKey: "accidentalidad", enabled: false },
          { projectId: project.id, sectionKey: "collaborators", enabled: false },
          { projectId: project.id, sectionKey: "sgsst-design", enabled: false },
          { projectId: project.id, sectionKey: "inspection-maintenance", enabled: false },
          { projectId: project.id, sectionKey: "minimum-indicators", enabled: false },
        ],
      });

      return { projectId: project.id, clientUserId: clientUser.id };
    });
    try {
      revalidatePath('/projects');
      revalidatePath('/users');
      revalidatePath('/activities');
    } catch (revalidateError) {
      console.error("Failed to revalidate after creating project:", revalidateError);
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to create project:", error);
    return { success: false, error: "Failed to create project" };
  }
}

export async function updateActivityStatus(id: string, status: string) {
  try {
    const actor = await getCurrentUser();
    if (!actor) {
      return { success: false, error: "No autenticado." };
    }
    if (status === "APPROVED" && actor.role !== "ADMIN_PMD") {
      return { success: false, error: "Solo auditor puede aprobar." };
    }

    const current = await prisma.activity.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!current) {
      return { success: false, error: "Actividad no encontrada." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.activity.update({
        where: { id },
        data:
          status === "IN_REVIEW"
            ? { status, returnedNote: null, returnedAt: null, rejectionReason: null }
            : status === "APPROVED"
              ? { status, returnedNote: null, returnedAt: null, rejectionReason: null, priority: "Cumplido" }
              : { status },
      });
      await tx.activityHistory.create({
        data: {
          activityId: id,
          field: "status",
          oldValue: current.status,
          newValue: status,
          changedByUserId: actor.id!,
        },
      });

      if (status === "APPROVED" && current.project.consultantId) {
          await createNotification(tx, {
              recipientId: current.project.consultantId,
              title: "Actividad Aprobada",
              message: `La actividad "${current.title}" ha sido aprobada.`,
              type: "SYSTEM_ALERT",
              priority: "LOW",
              activityId: current.id,
              category: "OPERATIONAL",
              functionalArea: "SST"
          });
      }

      // Notify Admin if status is changed to IN_REVIEW by Consultant/Client
      if (status === "IN_REVIEW" && actor.role !== "ADMIN_PMD") {
          const admins = await tx.user.findMany({ where: { role: "ADMIN_PMD" } });
          for (const admin of admins) {
              await createNotification(tx, {
                  recipientId: admin.id,
                  title: "Actividad en Revisión",
                  message: `La actividad "${current.title}" de ${current.project.name} ha cambiado a estado de revisión.`,
                  type: "ACTIVITY_REVIEW",
                  priority: "HIGH",
                  activityId: current.id,
                  category: "OPERATIONAL",
                  functionalArea: "SST"
              });
          }
      }
    });

    revalidatePath("/activities");
    revalidatePath("/overview");
    return { success: true };
  } catch (error) {
    console.error("Failed to update activity status:", error);
    return { success: false, error: "Failed to update activity status" };
  }
}

export async function returnActivityToConsultant(id: string, note: string) {
  try {
    const actor = await getCurrentUser();
    if (!actor) {
      return { success: false, error: "No autenticado." };
    }
    if (!actor.id) {
      return { success: false, error: "Sesión inválida. Vuelva a iniciar sesión." };
    }
    if (actor.role !== "ADMIN_PMD") {
      return { success: false, error: "Solo el administrador puede devolver actividades." };
    }

    const activity = await prisma.activity.findUnique({
      where: { id },
      include: {
        project: true,
        assignedTo: true,
      },
    });

    if (!activity) {
      return { success: false, error: "Actividad no encontrada." };
    }
    if (activity.status !== "IN_REVIEW") {
      return { success: false, error: "Solo se pueden devolver actividades que estén en revisión." };
    }

    const trimmedNote = note.trim();
    if (!trimmedNote) {
      return { success: false, error: "La nota es requerida para devolver la actividad." };
    }

    const primaryId = activity.assignedToId || null;
    const fallbackId = activity.project.consultantId || null;

    if (!primaryId && !fallbackId) {
      return { success: false, error: "La empresa no tiene consultor asignado para recibir la devolución." };
    }

    const consultantCandidateId = primaryId || fallbackId;
    const consultant = consultantCandidateId
      ? await prisma.user.findUnique({
          where: { id: consultantCandidateId },
          select: { id: true, role: true, name: true, deletedAt: true },
        })
      : null;

    if (!consultant || consultant.deletedAt || consultant.role !== "CONSULTANT") {
      return { success: false, error: "El consultor asignado no está disponible para recibir la devolución." };
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const updated = await tx.activity.update({
        where: { id },
        data: {
          status: "REJECTED",
          assignedToId: consultant.id,
          returnedNote: trimmedNote,
          returnedAt: now,
          rejectionReason: trimmedNote,
        },
        include: {
          project: { select: { id: true, name: true, nit: true, consultantId: true } },
          assignedTo: { select: { name: true } },
          documents: { orderBy: { uploadedAt: "desc" }, take: 1 },
        },
      });

      await tx.activityHistory.create({
        data: {
          activityId: id,
          field: "status",
          oldValue: activity.status,
          newValue: "REJECTED",
          changedByUserId: String(actor.id),
        },
      });

      return updated;
    });

    const link = `/activities?status=REJECTED&highlight=${activity.id}`;
    const message = `La actividad "${activity.title}" fue devuelta con observaciones. Motivo: ${trimmedNote}. Fecha/hora: ${now.toISOString()}. Ir a la actividad: ${link}`;

    let notification: Awaited<ReturnType<typeof createNotification>> | null = null;
    try {
      notification = await createNotification(prisma, {
        recipientId: consultant.id,
        title: "Actividad Devuelta",
        message,
        type: "ACTIVITY_RETURNED",
        priority: "HIGH",
        activityId: activity.id,
        category: "OPERATIONAL",
        functionalArea: "SST",
      });
    } catch (e) {
      console.error("Failed to create notification for activity return (non-blocking):", e);
    }

    if (notification) {
      try {
        publishNotificationsEvent({
          type: "notification_created",
          payload: {
            id: notification.id,
            recipientId: consultant.id,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            priority: notification.priority,
            category: notification.category,
            functionalArea: notification.functionalArea,
            createdAt: notification.createdAt.toISOString(),
            activityId: notification.activityId,
          },
        });
      } catch (e) {
        console.error("Failed to publish notification event (non-blocking):", e);
      }
    }

    try {
      publishActivitiesEvent({
        type: "activity_updated",
        payload: {
          kind: "ACTIVITY",
          id: updated.id,
          title: updated.title,
          status: updated.status,
          updatedAt: updated.updatedAt.toISOString(),
          priority: updated.priority,
          dueDate: updated.dueDate ? updated.dueDate.toISOString() : null,
          returnedNote: updated.returnedNote || null,
          returnedAt: updated.returnedAt ? updated.returnedAt.toISOString() : null,
          project: {
            id: updated.project.id,
            name: updated.project.name,
            nit: updated.project.nit ?? null,
            consultantId: updated.project.consultantId ?? null,
          },
          assignedTo: updated.assignedTo ? { name: updated.assignedTo.name } : null,
          documents: updated.documents.map((d: { id: string; name: string; url: string; uploadedAt: Date }) => ({
            id: d.id,
            name: d.name,
            url: d.url,
            uploadedAt: d.uploadedAt.toISOString(),
          })),
        },
      });
    } catch (e) {
      console.error("Failed to publish activity event (non-blocking):", e);
    }

    revalidatePath("/activities");
    revalidatePath("/overview");

    return { success: true };
  } catch (error) {
    console.error("Failed to return activity to consultant:", error);
    const message = error instanceof Error ? error.message : "";
    const normalized = message.toLowerCase();
    if (
      normalized.includes("column") &&
      (normalized.includes("returnednote") ||
        normalized.includes("returnedat") ||
        normalized.includes("rejectionreason") ||
        normalized.includes("deletedat"))
    ) {
      return {
        success: false,
        error:
          "La base de datos no está actualizada para devoluciones (faltan columnas). Aplique migraciones y vuelva a intentar.",
      };
    }
    return { success: false, error: "Error al devolver la actividad al consultor." };
  }
}

// Deprecated: Keeping for backward compatibility if needed, but redirects to updateActivityStatus logic
export async function approveActivity(id: string) {
  return updateActivityStatus(id, "APPROVED");
}

export async function reassignActivity(formData: FormData) {
  const activityId = formData.get("activityId") as string | null;
  const currentUserId = formData.get("currentUserId") as string | null;

  if (!activityId || !currentUserId) {
    return { success: false, error: "Actividad y usuario actual son requeridos." };
  }

  const hasAssignmentChange = formData.has("assignedToId");
  
  if (!hasAssignmentChange) {
    return { success: false, error: "No hay cambios para aplicar." };
  }

  const assignedToIdRaw = formData.get("assignedToId") as string;
  const assignedToId = assignedToIdRaw === "" ? null : assignedToIdRaw;

  const actor = await prisma.user.findUnique({
    where: { id: currentUserId },
  });

  if (!actor) {
    return { success: false, error: "Usuario no encontrado." };
  }

  if (actor.role !== "CONSULTANT" && actor.role !== "ADMIN_PMD") {
    return { success: false, error: "No tiene permisos para reasignar actividades." };
  }

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: {
      project: true,
      assignedTo: true,
    },
  });

  if (!activity) {
    return { success: false, error: "Actividad no encontrada." };
  }

  if (actor.role === "CONSULTANT" && activity.project.consultantId !== actor.id) {
    return { success: false, error: "Solo puede reasignar actividades de sus empresas." };
  }

  const updates: { assignedToId?: string | null } = {};
  /*
  const historyEntries: {
    field: string;
    oldValue: string | null;
    newValue: string;
  }[] = [];
  */

  if (hasAssignmentChange && assignedToId !== activity.assignedToId) {
    updates.assignedToId = assignedToId;

    /*
    const newAssignee = assignedToId
      ? await prisma.user.findUnique({ where: { id: assignedToId } })
      : null;

    historyEntries.push({
      field: "assignedTo",
      oldValue: activity.assignedTo ? activity.assignedTo.name : "Sin asignar",
      newValue: newAssignee ? newAssignee.name : "Sin asignar",
    });
    */
  }

  if (!Object.keys(updates).length) {
    return { success: false, error: "No hay cambios para aplicar." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.activity.update({
        where: { id: activityId },
        data: updates,
      });

      /*
      if (historyEntries.length > 0) {
        for (const entry of historyEntries) {
          await tx.activityHistory.create({
            data: {
              activityId: activityId,
              field: entry.field,
              oldValue: entry.oldValue,
              newValue: entry.newValue,
              changedByUserId: actor.id,
            },
          });
        }
      }
      */
    });

    revalidatePath("/overview");
    revalidatePath("/activities");
    revalidatePath(`/projects/${activity.projectId}`);

    return { success: true };
  } catch (error) {
    console.error("Failed to reassign activity:", error);
    return { success: false, error: "Error al reasignar la actividad." };
  }
}

export async function createCollaboratorActivity(formData: FormData) {
  try {
    const collaboratorId = formData.get("collaboratorId") as string | null;
    const projectId = formData.get("projectId") as string | null;
    const title = (formData.get("title") as string | null)?.trim() || "";
    const dueDateStr = (formData.get("dueDate") as string | null)?.trim() || "";
    const periodicityRaw = (formData.get("periodicity") as string | null)?.trim() || "";

    if (!collaboratorId || !projectId || !title) {
      return { success: false, error: "Colaborador, empresa y título son requeridos." };
    }
    if (!dueDateStr) {
      return { success: false, error: "La fecha de vencimiento es requerida." };
    }

    const periodicity = normalizePeriodicity(periodicityRaw);
    if (!periodicity) {
      return { success: false, error: "Periodicidad es requerida." };
    }
    if (!isValidPeriodicity(periodicity)) {
      return { success: false, error: "Periodicidad inválida." };
    }

    const parsedDue = new Date(dueDateStr);
    if (Number.isNaN(parsedDue.getTime())) {
      return { success: false, error: "Fecha de vencimiento inválida." };
    }
    
    const priorityResult = calculatePriority(parsedDue);
    if (!priorityResult.isValid) {
      return { success: false, error: priorityResult.error || "Fecha de vencimiento inválida." };
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "No autenticado." };
    }

    const collaborator = await prisma.collaborator.findUnique({
      where: { id: collaboratorId },
      include: {
        project: true,
      },
    });

    if (!collaborator || collaborator.projectId !== projectId) {
      return { success: false, error: "Colaborador no encontrado para esta empresa." };
    }

    const userRole = currentUser.role;
    const userId = currentUser.id;

    const isAdmin = userRole === "ADMIN_PMD";
    const isProjectConsultant =
      userRole === "CONSULTANT" && collaborator.project.consultantId === userId;

    if (!isAdmin && !isProjectConsultant) {
      return { success: false, error: "No tiene permisos para gestionar actividades de este colaborador." };
    }

    const activity = await prisma.activity.create({
      data: {
        title,
        status: "PENDING",
        priority: priorityResult.priority,
        dueDate: parsedDue,
        periodicity,
        projectId: collaborator.projectId,
        collaboratorId: collaborator.id,
      },
    });

    if (!isAdmin) {
      // Need to find admins for notification
      // Using prisma directly instead of findMany which might be mocked/unavailable in tests if not fully mocked
      const admins = await prisma.user.findMany({ where: { role: "ADMIN_PMD" } });
      const createdOn = new Date().toISOString().slice(0, 10);
      const creator = currentUser.name || currentUser.email || "Usuario";
      for (const admin of admins) {
        await createNotification(prisma, {
          recipientId: admin.id,
          title: "Nueva Actividad de Colaborador",
          message: `Nueva actividad creada · Tipo: Colaborador · Actividad: "${title}" · Empresa: ${collaborator.project.name} · Colaborador: ${collaborator.firstName} ${collaborator.firstSurname} · Fecha: ${createdOn} · Responsable: ${creator}`,
          type: "ACTIVITY_CREATED",
          priority: "MEDIUM",
          activityId: activity.id,
          category: "OPERATIONAL",
          functionalArea: "SST",
        });
      }
    }

    const basePath = `/projects/${collaborator.projectId}/collaborators/${collaborator.id}/activities`;

    revalidatePath(`/projects/${collaborator.projectId}`);
    revalidatePath(basePath);
    revalidatePath("/activities");

    publishActivitiesEvent({
      type: "activity_created",
      payload: {
        kind: "ACTIVITY",
        id: activity.id,
        title: activity.title,
        status: activity.status,
        updatedAt: activity.updatedAt.toISOString(),
        priority: activity.priority,
        dueDate: activity.dueDate ? activity.dueDate.toISOString() : null,
        returnedNote: null,
        returnedAt: null,
        project: {
          id: collaborator.projectId,
          name: collaborator.project.name,
          nit: collaborator.project.nit ?? null,
          consultantId: collaborator.project.consultantId ?? null,
        },
        assignedTo: null,
        documents: [],
      },
    });

    return { success: true, activityId: activity.id };
  } catch (error) {
    console.error("Failed to create collaborator activity:", error);
    return { success: false, error: "Error al crear la actividad del colaborador." };
  }
}

export async function updateCollaboratorActivity(id: string, formData: FormData) {
  try {
    const normalizedTitle = ((formData.get("title") as string | null) || "").trim();
    const periodicityRaw = (formData.get("periodicity") as string | null)?.trim();

    if (!id || !normalizedTitle) {
      return { success: false, error: "Actividad y nombre son requeridos." };
    }

    if (periodicityRaw !== undefined) {
      const periodicity = normalizePeriodicity(periodicityRaw || "");
      if (periodicity && !isValidPeriodicity(periodicity)) {
        return { success: false, error: "Periodicidad inválida." };
      }
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "No autenticado." };
    }

    const activity = await prisma.activity.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!activity || !activity.collaboratorId) {
      if (!activity || !activity.inspectionEquipmentId) {
        return { success: false, error: "Actividad no encontrada." };
      }
    }

    const userRole = currentUser.role;
    const userId = currentUser.id;

    const isAdmin = userRole === "ADMIN_PMD";
    const isProjectConsultant =
      userRole === "CONSULTANT" && activity.project.consultantId === userId;

    if (!isAdmin && !isProjectConsultant) {
      return { success: false, error: "No tiene permisos para editar esta actividad." };
    }

    await prisma.activity.update({
      where: { id },
      data: {
        title: normalizedTitle,
        periodicity: periodicityRaw ? normalizePeriodicity(periodicityRaw) : null,
      },
    });

    const basePath = activity.collaboratorId
      ? `/projects/${activity.projectId}/collaborators/${activity.collaboratorId}/activities`
      : activity.inspectionEquipmentId
        ? `/projects/${activity.projectId}/inspection-maintenance/${activity.inspectionEquipmentId}/activities`
        : `/projects/${activity.projectId}`;

    revalidatePath(`/projects/${activity.projectId}`);
    revalidatePath(basePath);

    return { success: true };
  } catch (error) {
    console.error("Failed to update collaborator activity:", error);
    return { success: false, error: "Error al actualizar la actividad del colaborador." };
  }
}

export async function updateActivityDueDate(
  activityId: string,
  dueDateIso: string | null
) {
  try {
    if (!activityId) {
      return { success: false, error: "Actividad requerida." };
    }
    
    let parsedDue: Date | null = null;
    let priority: string | undefined = undefined;

    if (dueDateIso) {
      parsedDue = new Date(dueDateIso);
      if (Number.isNaN(parsedDue.getTime())) {
        return { success: false, error: "Fecha inválida" };
      }
      
      const priorityResult = calculatePriority(parsedDue);
      if (!priorityResult.isValid) {
        return { success: false, error: priorityResult.error || "Fecha de vencimiento inválida." };
      }
      priority = priorityResult.priority;
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "No autenticado." };
    }

    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        project: true,
      },
    });

    if (!activity || !activity.collaboratorId) {
      return {
        success: false,
        error: "Actividad de colaborador no encontrada.",
      };
    }

    const userRole = currentUser.role;
    const userId = currentUser.id;

    const isAdmin = userRole === "ADMIN_PMD";
    const isProjectConsultant =
      userRole === "CONSULTANT" && activity.project.consultantId === userId;

    if (!isAdmin && !isProjectConsultant) {
      return {
        success: false,
        error: "No tiene permisos para actualizar esta actividad.",
      };
    }

    const dataToUpdate: Prisma.ActivityUpdateInput = { dueDate: parsedDue };
    if (priority) {
      dataToUpdate.priority = priority;
    } else if (parsedDue === null) {
      // If date is cleared, reset priority to default (Media)
      dataToUpdate.priority = "Media";
    }

    await prisma.activity.update({
      where: { id: activityId },
      data: dataToUpdate,
    });

    const basePath = `/projects/${activity.projectId}/collaborators/${activity.collaboratorId}/activities`;
    revalidatePath(basePath);

    return { success: true };
  } catch (error) {
    console.error("Failed to update activity due date:", error);
    let message = "Error al actualizar la fecha de vencimiento de la actividad.";
    if (process.env.NODE_ENV !== "production" && error instanceof Error) {
      message = `${message} Detalles: ${error.message}`;
    }
    return {
      success: false,
      error: message,
    };
  }
}

export async function deleteCollaboratorActivity(id: string) {
  try {
    if (!id) {
      return { success: false, error: "Actividad requerida." };
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "No autenticado." };
    }

    const activity = await prisma.activity.findUnique({
      where: { id },
      include: {
        project: true,
        collaborator: true,
      },
    });

    if (!activity || !activity.collaboratorId) {
      return { success: false, error: "Actividad de colaborador no encontrada." };
    }

    const userRole = currentUser.role;
    const userId = currentUser.id;

    const isAdmin = userRole === "ADMIN_PMD";
    const isProjectConsultant =
      userRole === "CONSULTANT" && activity.project.consultantId === userId;

    if (!isAdmin && !isProjectConsultant) {
      return { success: false, error: "No tiene permisos para eliminar esta actividad." };
    }

    // Notify Admins if deleted by Consultant
    if (!isAdmin) {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN_PMD" } });
      const collaboratorName = activity.collaborator 
        ? `${activity.collaborator.firstName} ${activity.collaborator.firstSurname}` 
        : "Desconocido";

      for (const admin of admins) {
        await createNotification(prisma, {
          recipientId: admin.id,
          title: "Actividad de Colaborador Eliminada",
          message: `Se ha eliminado la actividad "${activity.title}" del colaborador ${collaboratorName}.`,
          type: "ACTIVITY_DELETED",
          priority: "HIGH",
          category: "OPERATIONAL",
          functionalArea: "SST",
        });
      }
    }

    await prisma.notification.deleteMany({
      where: { activityId: id },
    });

    await prisma.document.deleteMany({
      where: { activityId: id },
    });

    await prisma.activity.delete({
      where: { id },
    });

    const basePath = `/projects/${activity.projectId}/collaborators/${activity.collaboratorId}/activities`;

    revalidatePath(`/projects/${activity.projectId}`);
    revalidatePath(basePath);
    revalidatePath("/documents");
    revalidatePath("/activities");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete collaborator activity:", error);
    return { success: false, error: "Error al eliminar la actividad del colaborador." };
  }
}

export async function uploadDocument(_activityId: string, _fileName: string) {
  try {
    void _activityId;
    void _fileName;
    return {
      success: false,
      error:
        "Carga de documentos (legacy) deshabilitada. Use la subida por S3 con createActivityUploadRequest + finalizeActivityUpload.",
    };
  } catch (error) {
    console.error("Failed to upload document:", error);
    return { success: false, error: "Failed to upload document" };
  }
}

export async function sendSupportTicket(formData: FormData) {
  try {
    const name = (formData.get("name") as string)?.trim();
    const email = (formData.get("email") as string)?.trim();
    const subject = (formData.get("subject") as string)?.trim();
    const message = (formData.get("message") as string)?.trim();
    const priority = (formData.get("priority") as string)?.trim();
    const attachment = formData.get("attachment") as string | null;

    if (!name || !email || !subject || !message || !priority) {
      return { success: false, error: "Todos los campos son obligatorios." };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, error: "Correo electrónico inválido." };
    }

    // Simulate sending email to pmdsoporte@gmail.com
    console.log(`[SUPPORT TICKET] Sending to pmdsoporte@gmail.com`);
    
    // Use Resend API
    try {
      const htmlContent = getSupportTicketEmailTemplate({
        name,
        email,
        priority,
        subject,
        message
      });

      const { data, error } = await resend.emails.send({
        from: 'Soporte PMD <onboarding@resend.dev>',
        to: ['pmdsoporte@gmail.com'],
        subject: `[${priority}] ${subject} - Ticket de Soporte`, // Uses "Alta"
        html: htmlContent, // This uses htmlContent generated above
        attachments: attachment ? [
          {
            filename: 'screenshot.png',
            content: attachment.split(',')[1], // Remove data:image/png;base64, prefix
            // Resend API uses 'content' for attachments, 'contentType' is optional/inferred but let's stick to standard if needed
            // The type definition expects 'content' as Buffer or string. 
            // If using base64 string, Resend usually handles it.
          },
        ] : [],
      });

      if (error) {
        console.error("Resend API Error:", error);
        return { success: false, error: "Error enviando el correo." };
      }
      
      console.log("Email sent successfully:", data);
    } catch (emailError) {
      console.error("Failed to send email via Resend:", emailError);
      return { success: false, error: "Error de conexión con el servicio de correo." };
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to send support ticket:", error);
    return { success: false, error: "Error al enviar el ticket de soporte. Por favor intente nuevamente." };
  }
}

export async function sendAgendaMeetingReport(payload: {
  projectId: string;
  meetingTitle: string;
  meetingDate: string;
  meetingStart: string;
  meetingEnd: string;
  activities: string;
  tasks: string[];
  observations: string[];
  recipients: string[];
}) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "No autenticado." };
    if (user.role !== "CONSULTANT" && user.role !== "ADMIN_PMD") {
      return { success: false, error: "Sin permisos para enviar reportes." };
    }

    const resendKey = (process.env.RESEND_API_KEY || "").trim();
    if (!resendKey || resendKey === "re_123456789") {
      return { success: false, error: "Correo no configurado (falta RESEND_API_KEY en el servidor)." };
    }

    const recipients = Array.from(new Set(payload.recipients.map((x) => x.trim()).filter(Boolean)));
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = recipients.find((x) => !emailRegex.test(x));
    if (invalid) return { success: false, error: `Correo inválido: ${invalid}` };
    if (recipients.length === 0) return { success: false, error: "Debe ingresar al menos un correo." };
    if (recipients.length > 20) return { success: false, error: "Máximo 20 correos por envío." };

    const title = (payload.meetingTitle || "").trim() || "Reporte de reunión";
    const date = (payload.meetingDate || "").trim();
    const timeRange = `${(payload.meetingStart || "").trim()}${payload.meetingEnd ? ` – ${(payload.meetingEnd || "").trim()}` : ""}`.trim();
    const activities = (payload.activities || "").trim();
    const tasks = Array.isArray(payload.tasks) ? payload.tasks.map((t) => (t || "").trim()).filter(Boolean) : [];
    const observations = Array.isArray(payload.observations)
      ? payload.observations.map((t) => (t || "").trim()).filter(Boolean)
      : [];

    let projectDisplayName = "";
    let projectClientName = "";
    try {
      const project = await prisma.project.findUnique({
        where: { id: payload.projectId },
        select: { name: true, clientName: true },
      });
      projectDisplayName = (project?.name || "").trim();
      projectClientName = (project?.clientName || "").trim();
    } catch {
    }

    let replyTo: string | null = null;
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get("gcal_conn")?.value || "";
      if (token) {
        const decoded = decryptJson<{ email?: string | null }>(token);
        const candidate = typeof decoded?.email === "string" ? decoded.email.trim() : "";
        if (candidate && emailRegex.test(candidate)) replyTo = candidate;
      }
    } catch {
    }
    if (!replyTo) {
      const candidate = typeof (user as unknown as { email?: unknown })?.email === "string" ? ((user as unknown as { email: string }).email || "").trim() : "";
      if (candidate && emailRegex.test(candidate)) replyTo = candidate;
    }

    const html = `
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reporte de reunión</title>
  </head>
  <body style="font-family: Arial, Helvetica, sans-serif; background:#f4f4f5; margin:0; padding:24px; color:#0f172a;">
    <div style="max-width:720px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
      <div style="background:#0f172a; padding:18px 20px;">
        <div style="font-size:16px; font-weight:700; color:#ffffff;">PMD Servicios</div>
        <div style="margin-top:6px; font-size:14px; color:#e2e8f0;">Reporte de reunión</div>
      </div>
      <div style="padding:18px 20px;">
        <div style="font-size:16px; font-weight:700; color:#0f172a;">${escapeHtml(title)}</div>
        <div style="margin-top:6px; font-size:13px; color:#475569;">
          ${escapeHtml(date)}${timeRange ? ` · ${escapeHtml(timeRange)}` : ""}
        </div>
        <div style="margin-top:14px; font-size:13px; color:#0f172a; font-weight:700;">Actividades ejecutadas</div>
        <div style="margin-top:6px; font-size:13px; color:#334155; white-space:pre-wrap;">${escapeHtml(activities || "—")}</div>
        ${
          tasks.length > 0
            ? `<div style="margin-top:14px; font-size:13px; color:#0f172a; font-weight:700;">Tareas asignadas</div>
               <ul style="margin-top:6px; padding-left:18px; color:#334155; font-size:13px;">
                 ${tasks.map((t) => `<li style="margin:4px 0;">${escapeHtml(t)}</li>`).join("")}
               </ul>`
            : ""
        }
        ${
          observations.length > 0
            ? `<div style="margin-top:14px; font-size:13px; color:#0f172a; font-weight:700;">Observaciones</div>
               <ul style="margin-top:6px; padding-left:18px; color:#334155; font-size:13px;">
                 ${observations.map((t) => `<li style="margin:4px 0;">${escapeHtml(t)}</li>`).join("")}
               </ul>`
            : ""
        }
        <div style="margin-top:18px; font-size:12px; color:#64748b;">
          Enviado por ${escapeHtml(user.name || "Consultor")}${
            projectDisplayName
              ? ` · Empresa: ${escapeHtml(projectDisplayName)}`
              : ""
          }${
            projectClientName
              ? ` · Cliente: ${escapeHtml(projectClientName)}`
              : ""
          }
        </div>
        ${replyTo ? `<div style="margin-top:8px; font-size:12px; color:#64748b;">Responder a: ${escapeHtml(replyTo)}</div>` : ""}
      </div>
    </div>
  </body>
</html>`;

    const subject = `Reporte de reunión: ${title}`;
    const from = (process.env.RESEND_FROM || "PMD Servicios <onboarding@resend.dev>").trim();
    const { error } = await resend.emails.send({
      from,
      to: recipients,
      replyTo: replyTo || undefined,
      subject,
      html,
    });

    if (error) {
      const message = typeof (error as unknown as { message?: unknown })?.message === "string" ? (error as unknown as { message: string }).message : "";
      const norm = message.toLowerCase();
      if (
        norm.includes("invalid api key") ||
        norm.includes("unauthorized") ||
        norm.includes("forbidden") ||
        norm.includes("missing api key")
      ) {
        return { success: false, error: "Correo no configurado correctamente (RESEND_API_KEY inválida)." };
      }
      if (norm.includes("verify") && norm.includes("domain")) {
        return { success: false, error: "Dominio de envío no verificado en Resend. Verifica tu dominio o configura RESEND_FROM con un dominio verificado." };
      }
      if (norm.includes("verified recipients") || norm.includes("only send")) {
        return { success: false, error: "Resend está en modo prueba y no permite enviar a esos correos. Verifica el dominio o habilita destinatarios permitidos en Resend." };
      }
      return { success: false, error: message || "Error enviando el correo." };
    }

    return { success: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    return { success: false, error: message || "No se pudo enviar el reporte." };
  }
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function deleteActivityDocument(formData: FormData) {
  try {
    const documentId = formData.get("documentId") as string | null;

    if (!documentId) {
      return { success: false, error: "Documento requerido" };
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "No autenticado." };
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        activity: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!document || !document.activity) {
      return { success: false, error: "Documento no encontrado" };
    }

    const userRole = currentUser.role;
    const userId = currentUser.id;

    const isAdmin = userRole === "ADMIN_PMD";
    const isProjectConsultant =
      userRole === "CONSULTANT" && document.activity.project.consultantId === userId;
    const isProjectClient =
      userRole === "CLIENT_VIEWER" && document.activity.project.clientUserId === userId;
    const isUploader = document.uploadedByUserId === userId;

    const canDelete = isAdmin || isProjectConsultant || (isProjectClient && isUploader);

    if (!canDelete) {
      return { success: false, error: "No tiene permisos para eliminar este documento." };
    }

    // Soft delete logic: Update deletedAt instead of hard deleting
    await prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: documentId },
        data: { deletedAt: new Date() },
      });

      await tx.activityHistory.create({
        data: {
          activityId: document.activityId,
          field: "document_delete",
          oldValue: document.name,
          newValue: "DELETED (Soft)",
          changedByUserId: currentUser.id,
        },
      });
    });

    const remaining = await prisma.document.count({
      where: { 
        activityId: document.activityId,
        deletedAt: null 
      },
    });

    if (document.activity.status !== "REJECTED") {
      await prisma.activity.update({
        where: { id: document.activityId },
        data: { status: remaining > 0 ? "IN_REVIEW" : "PENDING" },
      });
    }

    revalidatePath("/projects");
    revalidatePath("/documents");
    revalidatePath("/activities");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete activity document:", error);
    return { success: false, error: "Error al eliminar el documento" };
  }
}

export async function uploadActivityFile(formData: FormData) {
  try {
    const activityId = formData.get('activityId') as string;
    const file = formData.get('file') as File | null;

    if (!activityId || !file) {
      return { success: false, error: "Actividad y archivo son requeridos" };
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "No autenticado." };
    }

    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        project: true,
      },
    });

    if (!activity) {
      return { success: false, error: "Actividad no encontrada." };
    }

    const userRole = currentUser.role;
    const userId = currentUser.id;

    const isAdmin = userRole === "ADMIN_PMD";
    const isProjectConsultant =
      userRole === "CONSULTANT" && activity.project.consultantId === userId;
    const isProjectClient =
      userRole === "CLIENT_VIEWER" && activity.project.clientUserId === userId;

    if (!isAdmin && !isProjectConsultant && !isProjectClient) {
      return { success: false, error: "No tiene permisos para gestionar documentos de este requisito." };
    }

    if (activity.status === "APPROVED") {
      return { success: false, error: "No se puede cargar archivos en una actividad aprobada." };
    }

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const maxSizeMB = 20;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
      return { success: false, error: "Tipo de archivo no permitido. Use PDF, imágenes (JPG, PNG, GIF) o documentos Office." };
    }
    if (file.size > maxSizeBytes) {
      return { success: false, error: `El archivo supera ${maxSizeMB}MB.` };
    }

    const originalName = file.name || "documento";
    const extMatch = originalName.includes(".")
      ? originalName.slice(originalName.lastIndexOf("."))
      : "";
    const storedName = `${randomUUID()}${extMatch}`;
    const key = `activities/${activityId}/${storedName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const publicUrl = await uploadToS3(key, buffer, file.type || "application/octet-stream");

    await prisma.document.create({
      data: {
        name: originalName,
        url: publicUrl,
        activityId,
      },
    });
    await prisma.activity.update({
      where: { id: activityId },
      data: { status: "IN_REVIEW" },
    });
    revalidatePath(`/projects`);
    return { success: true };
  } catch (error) {
    console.error("Failed to upload activity file:", error);
    return { success: false, error: "Error al subir el documento" };
  }
}

export async function createActivityUploadRequest(formData: FormData) {
  try {
    const activityId = formData.get("activityId") as string;
    const fileName = formData.get("fileName") as string;
    const fileType = (formData.get("fileType") as string) || "application/octet-stream";
    const fileSizeStr = formData.get("fileSize") as string;
    const fileSize = fileSizeStr ? parseInt(fileSizeStr, 10) : 0;

    if (!activityId || !fileName) {
      return { success: false, error: "Actividad y nombre de archivo son requeridos" };
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "No autenticado." };
    }

    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        project: true,
      },
    });

    if (!activity) {
      return { success: false, error: "Actividad no encontrada." };
    }

    if (activity.status === "APPROVED") {
      return { success: false, error: "No se puede cargar archivos en una actividad aprobada." };
    }

    const userRole = currentUser.role;
    const userId = currentUser.id;

    const isAdmin = userRole === "ADMIN_PMD";
    const isProjectConsultant =
      userRole === "CONSULTANT" && activity.project.consultantId === userId;
    const isProjectClient =
      userRole === "CLIENT_VIEWER" && activity.project.clientUserId === userId;

    if (!isAdmin && !isProjectConsultant && !isProjectClient) {
      return { success: false, error: "No tiene permisos para gestionar documentos de este requisito." };
    }

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const maxSizeMB = 20;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (!allowedTypes.includes(fileType)) {
      return {
        success: false,
        error: "Tipo de archivo no permitido. Use PDF, imágenes (JPG, PNG, GIF) o documentos Office.",
      };
    }
    if (fileSize > maxSizeBytes) {
      return { success: false, error: `El archivo supera ${maxSizeMB}MB.` };
    }

    const extMatch = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
    const storedName = `${randomUUID()}${extMatch}`;
    const key = `activities/${activityId}/${storedName}`;

    const uploadUrl = await getPresignedUploadUrl(key, fileType || "application/octet-stream");

    return {
      success: true,
      uploadUrl,
      key,
      originalName: fileName,
    };
  } catch (error) {
    console.error("Failed to create presigned upload request:", error);
    return { success: false, error: "Error al preparar la subida del documento" };
  }
}

export async function finalizeActivityUpload(formData: FormData) {
  try {
    const activityId = formData.get("activityId") as string;
    const originalName = formData.get("originalName") as string;
    const key = formData.get("key") as string;
    const fileSizeStr = (formData.get("fileSize") as string | null) || null;
    const dueDateStr = (formData.get("dueDate") as string | null) || null;

    if (!activityId || !originalName || !key) {
      return { success: false, error: "Datos incompletos para registrar el documento" };
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "No autenticado." };
    }

    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        project: true,
      },
    });

    if (!activity) {
      return { success: false, error: "Actividad no encontrada." };
    }

    if (activity.status === "APPROVED") {
      return { success: false, error: "No se puede cargar archivos en una actividad aprobada." };
    }

    const userRole = currentUser.role;
    const userId = currentUser.id;

    const isAdmin = userRole === "ADMIN_PMD";
    const isProjectConsultant =
      userRole === "CONSULTANT" && activity.project.consultantId === userId;
    const isProjectClient =
      userRole === "CLIENT_VIEWER" && activity.project.clientUserId === userId;

    if (!isAdmin && !isProjectConsultant && !isProjectClient) {
      return { success: false, error: "No tiene permisos para gestionar documentos de este requisito." };
    }

    const sizeBytes = fileSizeStr ? parseInt(fileSizeStr, 10) || null : null;
    const publicUrl = getPublicUrl(key);

    await prisma.$transaction(async (tx) => {
      const lastDoc = await tx.document.findFirst({
        where: { activityId },
        orderBy: { uploadedAt: "desc" },
      });

      const nextVersion = (lastDoc?.version ?? 0) + 1;

      const newDoc = await tx.document.create({
        data: {
          name: originalName,
          url: publicUrl,
          activityId,
          version: nextVersion,
          sizeBytes: sizeBytes ?? undefined,
          uploadedByUserId: userId,
        },
      });

      const updateData: Prisma.ActivityUpdateInput = { status: "IN_REVIEW", returnedAt: null, returnedNote: null, rejectionReason: null };
      if (dueDateStr) {
        updateData.dueDate = new Date(dueDateStr);
      }

      await tx.activity.update({
        where: { id: activityId },
        data: updateData,
      });

      // Notify Consultant
      if (activity.project.consultantId && activity.project.consultantId !== userId) {
        await createNotification(tx, {
          recipientId: activity.project.consultantId,
          title: "Actividad en Revisión",
          message: `La actividad "${activity.title}" de ${activity.project.name} requiere revisión.`,
          type: "ACTIVITY_REVIEW",
          priority: activity.priority,
          activityId: activity.id,
          category: "OPERATIONAL",
          functionalArea: "SST"
        });
      }

      // Notify Admins
      const admins = await tx.user.findMany({ where: { role: "ADMIN_PMD" } });
      for (const admin of admins) {
          // Don't notify if the admin is the one uploading
          if (admin.id !== userId) {
              await createNotification(tx, {
                  recipientId: admin.id,
                  title: "Actividad en Revisión",
                  message: `La actividad "${activity.title}" de ${activity.project.name} requiere revisión.`,
                  type: "ACTIVITY_REVIEW",
                  priority: activity.priority,
                  activityId: activity.id,
                  category: "OPERATIONAL",
                  functionalArea: "SST"
              });
          }
      }

      await tx.activityHistory.create({
        data: {
          activityId,
          field: lastDoc ? "document_replace" : "document_upload",
          oldValue: lastDoc ? lastDoc.name : null,
          newValue: newDoc.name,
          changedByUserId: userId,
        },
      });
    });

    revalidatePath("/projects");
    revalidatePath("/activities");
    revalidatePath("/documents");

    return { success: true };
  } catch (error) {
    console.error("Failed to finalize activity upload:", error);
    return { success: false, error: "Error al registrar el documento" };
  }
}

export async function finalizeActivityUploadWithReply(formData: FormData) {
  try {
    const activityId = formData.get("activityId") as string;
    const originalName = formData.get("originalName") as string;
    const key = formData.get("key") as string;
    const fileSizeStr = (formData.get("fileSize") as string | null) || null;
    const dueDateStr = (formData.get("dueDate") as string | null) || null;
    const replyMessage = (formData.get("replyMessage") as string | null) || "";

    if (!activityId || !originalName || !key) {
      return { success: false, error: "Datos incompletos para registrar el documento" };
    }

    const trimmedReply = replyMessage.trim();
    if (!trimmedReply) {
      return { success: false, error: "La respuesta es requerida." };
    }

    const activityReplyAvailable = await isActivityReplyAvailable();

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "No autenticado." };
    }

    if (currentUser.role !== "CONSULTANT") {
      return { success: false, error: "Solo el consultor puede enviar respuesta al administrador." };
    }

    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: { project: true },
    });

    if (!activity) {
      return { success: false, error: "Actividad no encontrada." };
    }

    if (activity.status === "APPROVED") {
      return { success: false, error: "No se puede cargar archivos en una actividad aprobada." };
    }

    if (activity.status !== "REJECTED" || !activity.rejectionReason) {
      return { success: false, error: "No hay un mensaje previo del administrador para responder." };
    }

    const userId = currentUser.id;
    const isProjectConsultant = activity.project.consultantId === userId;
    if (!isProjectConsultant) {
      return { success: false, error: "No tiene permisos para responder en esta actividad." };
    }

    const sizeBytes = fileSizeStr ? parseInt(fileSizeStr, 10) || null : null;
    const publicUrl = getPublicUrl(key);
    const adminMessageSnapshot = activity.rejectionReason;

    const { newDocId } = await prisma.$transaction(async (tx) => {
      const lastDoc = await tx.document.findFirst({
        where: { activityId },
        orderBy: { uploadedAt: "desc" },
      });

      const nextVersion = (lastDoc?.version ?? 0) + 1;

      const newDoc = await tx.document.create({
        data: {
          name: originalName,
          url: publicUrl,
          activityId,
          version: nextVersion,
          sizeBytes: sizeBytes ?? undefined,
          uploadedByUserId: userId,
        },
      });

      const updateData: Prisma.ActivityUpdateInput = {
        status: "IN_REVIEW",
        returnedAt: null,
        returnedNote: null,
        rejectionReason: null,
      };
      if (dueDateStr) {
        updateData.dueDate = new Date(dueDateStr);
      }

      await tx.activity.update({
        where: { id: activityId },
        data: updateData,
      });

      await tx.activityHistory.create({
        data: {
          activityId,
          field: lastDoc ? "document_replace" : "document_upload",
          oldValue: lastDoc ? lastDoc.name : null,
          newValue: newDoc.name,
          changedByUserId: userId,
        },
      });

      return {
        newDocId: newDoc.id,
      };
    });

    if (activityReplyAvailable) {
      try {
        await prisma.activityReply.create({
          data: {
            activityId,
            documentId: newDocId,
            adminMessage: adminMessageSnapshot,
            message: trimmedReply,
            createdByUserId: userId,
            isRead: false,
          },
        });
      } catch (e) {
        console.error("Failed to persist ActivityReply:", e);
      }
    }

    try {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN_PMD", deletedAt: null } });
      for (const admin of admins) {
        await createNotification(prisma, {
          recipientId: admin.id,
          title: "Respuesta a devolución",
          message: `El consultor respondió a la actividad "${activity.title}" de ${activity.project.name}.`,
          type: "ACTIVITY_REPLY",
          priority: "HIGH",
          activityId: activity.id,
          category: "OPERATIONAL",
          functionalArea: "SST",
        });
      }
    } catch (e) {
      console.error("Failed to create notifications for activity reply:", e);
    }

    try {
      await prisma.activityHistory.create({
        data: {
          activityId,
          field: "consultant_reply",
          oldValue: adminMessageSnapshot,
          newValue: trimmedReply,
          changedByUserId: userId,
        },
      });
    } catch (e) {
      console.error("Failed to persist consultant_reply history:", e);
    }

    revalidatePath("/projects");
    revalidatePath("/activities");
    revalidatePath("/overview");
    revalidatePath("/documents");

    return { success: true };
  } catch (error) {
    console.error("Failed to finalize activity upload with reply:", error);
    const message =
      error instanceof Error ? error.message : typeof error === "string" ? error : "";
    const normalized = message.toLowerCase();
    if (
      normalized.includes("activityreply") &&
      (normalized.includes("does not exist") ||
        normalized.includes("no existe") ||
        normalized.includes("relation") ||
        normalized.includes("p2021"))
    ) {
      return {
        success: false,
        error:
          "La base de datos no está actualizada (falta la tabla ActivityReply). Aplique migraciones y vuelva a intentar.",
      };
    }
    return { success: false, error: "Error al enviar la respuesta al administrador." };
  }
}

export async function finalizeActivityUploadBatchWithReply(formData: FormData) {
  try {
    const activityId = (formData.get("activityId") as string | null) || "";
    const dueDateStr = (formData.get("dueDate") as string | null) || null;
    const replyMessage = (formData.get("replyMessage") as string | null) || "";
    const filesJson = (formData.get("files") as string | null) || "[]";

    const trimmedReply = replyMessage.trim();
    if (!trimmedReply) {
      return { success: false, error: "La respuesta es requerida." };
    }

    const activityReplyAvailable = await isActivityReplyAvailable();

    let files: { originalName: string; key: string; fileSize?: string | null }[] = [];
    try {
      files = JSON.parse(filesJson) as { originalName: string; key: string; fileSize?: string | null }[];
    } catch {
      return { success: false, error: "Archivos inválidos para registrar." };
    }

    const normalizedFiles = (Array.isArray(files) ? files : [])
      .map((f) => ({
        originalName: (f?.originalName || "").trim(),
        key: (f?.key || "").trim(),
        fileSize: typeof f?.fileSize === "string" ? f.fileSize : null,
      }))
      .filter((f) => f.originalName && f.key);

    if (!activityId || normalizedFiles.length === 0) {
      return { success: false, error: "Datos incompletos para registrar el documento" };
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "No autenticado." };
    }

    if (currentUser.role !== "CONSULTANT") {
      return { success: false, error: "Solo el consultor puede enviar respuesta al administrador." };
    }

    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: { project: true },
    });

    if (!activity) {
      return { success: false, error: "Actividad no encontrada." };
    }

    if (activity.status === "APPROVED") {
      return { success: false, error: "No se puede cargar archivos en una actividad aprobada." };
    }

    if (activity.status !== "REJECTED" || !activity.rejectionReason) {
      return { success: false, error: "No hay un mensaje previo del administrador para responder." };
    }

    const userId = currentUser.id;
    if (activity.project.consultantId !== userId) {
      return { success: false, error: "No tiene permisos para responder en esta actividad." };
    }

    const adminMessageSnapshot = activity.rejectionReason;

    const createdDocs = await prisma.$transaction(async (tx) => {
      const lastDoc = await tx.document.findFirst({
        where: { activityId },
        orderBy: { uploadedAt: "desc" },
      });

      let previousName: string | null = lastDoc?.name ?? null;
      let nextVersion = (lastDoc?.version ?? 0) + 1;

      const createdDocs: { id: string; name: string }[] = [];

      for (const file of normalizedFiles) {
        const sizeBytes =
          file.fileSize ? parseInt(file.fileSize, 10) || null : null;
        const publicUrl = getPublicUrl(file.key);

        const newDoc = await tx.document.create({
          data: {
            name: file.originalName,
            url: publicUrl,
            activityId,
            version: nextVersion,
            sizeBytes: sizeBytes ?? undefined,
            uploadedByUserId: userId,
          },
        });

        createdDocs.push({ id: newDoc.id, name: newDoc.name });

        await tx.activityHistory.create({
          data: {
            activityId,
            field: previousName ? "document_replace" : "document_upload",
            oldValue: previousName,
            newValue: newDoc.name,
            changedByUserId: userId,
          },
        });

        previousName = newDoc.name;
        nextVersion += 1;
      }

      const updateData: Prisma.ActivityUpdateInput = {
        status: "IN_REVIEW",
        returnedAt: null,
        returnedNote: null,
        rejectionReason: null,
      };
      if (dueDateStr) {
        updateData.dueDate = new Date(dueDateStr);
      }

      await tx.activity.update({
        where: { id: activityId },
        data: updateData,
      });

      return createdDocs;
    });

    if (activityReplyAvailable) {
      for (const doc of createdDocs) {
        try {
          await prisma.activityReply.create({
            data: {
              activityId,
              documentId: doc.id,
              adminMessage: adminMessageSnapshot,
              message: trimmedReply,
              createdByUserId: userId,
              isRead: false,
            },
          });
        } catch (e) {
          console.error("Failed to persist ActivityReply:", e);
        }
      }
    }

    try {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN_PMD", deletedAt: null } });
      for (const admin of admins) {
        await createNotification(prisma, {
          recipientId: admin.id,
          title: "Respuesta a devolución",
          message: `El consultor respondió a la actividad "${activity.title}" de ${activity.project.name}.`,
          type: "ACTIVITY_REPLY",
          priority: "HIGH",
          activityId: activity.id,
          category: "OPERATIONAL",
          functionalArea: "SST",
        });
      }
    } catch (e) {
      console.error("Failed to create notifications for batch activity reply:", e);
    }

    try {
      await prisma.activityHistory.create({
        data: {
          activityId,
          field: "consultant_reply",
          oldValue: adminMessageSnapshot,
          newValue: trimmedReply,
          changedByUserId: userId,
        },
      });
    } catch (e) {
      console.error("Failed to persist consultant_reply history:", e);
    }

    revalidatePath("/projects");
    revalidatePath("/activities");
    revalidatePath("/overview");
    revalidatePath("/documents");

    return { success: true };
  } catch (error) {
    console.error("Failed to finalize batch activity upload with reply:", error);
    const message =
      error instanceof Error ? error.message : typeof error === "string" ? error : "";
    const normalized = message.toLowerCase();
    if (
      normalized.includes("activityreply") &&
      (normalized.includes("does not exist") ||
        normalized.includes("no existe") ||
        normalized.includes("relation") ||
        normalized.includes("p2021"))
    ) {
      return {
        success: false,
        error:
          "La base de datos no está actualizada (falta la tabla ActivityReply). Aplique migraciones y vuelva a intentar.",
      };
    }
    return { success: false, error: "Error al enviar la respuesta al administrador." };
  }
}

export async function cancelActivityUpload(formData: FormData) {
  try {
    const key = (formData.get("key") as string | null) || "";
    if (!key) return { success: false, error: "Archivo no identificado." };

    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "No autenticado." };

    await deleteFromS3(key);
    return { success: true };
  } catch (error) {
    console.error("Failed to cancel activity upload:", error);
    return { success: false, error: "No se pudo cancelar la carga." };
  }
}

export async function cancelActivityUploads(formData: FormData) {
  try {
    const keysJson = (formData.get("keys") as string | null) || "[]";
    let keys: string[] = [];
    try {
      keys = JSON.parse(keysJson) as string[];
    } catch {
      return { success: false, error: "Archivos inválidos." };
    }

    const normalized = (Array.isArray(keys) ? keys : [])
      .map((k) => (typeof k === "string" ? k.trim() : ""))
      .filter(Boolean);

    if (normalized.length === 0) {
      return { success: false, error: "Archivo no identificado." };
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false, error: "No autenticado." };

    for (const key of normalized) {
      await deleteFromS3(key);
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to cancel activity uploads:", error);
    return { success: false, error: "No se pudo cancelar la carga." };
  }
}

export async function logClientUploadError(formData: FormData) {
  try {
    const activityId = (formData.get("activityId") as string | null) || "";
    const stage = (formData.get("stage") as string | null) || "";
    const message = (formData.get("message") as string | null) || "";
    const stack = (formData.get("stack") as string | null) || "";
    const extra = (formData.get("extra") as string | null) || "";

    console.error("Upload client error", {
      activityId,
      stage,
      message,
      stack,
      extra,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to log client upload error", error);
    return { success: false };
  }
}

// --- Notification System Actions ---

export async function getFilteredNotifications(filters?: {
  type?: string;
  priority?: string;
  category?: string;
  functionalArea?: string;
  limit?: number;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "No autenticado" };

  const where = buildNotificationQuery(user.id, user.role, filters);

  try {
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters?.limit || 20,
      include: {
        activity: {
          select: {
            id: true,
            title: true,
            project: { select: { name: true } },
            collaborator: { select: { firstName: true, firstSurname: true } }
          }
        }
      }
    });

    // Audit logging disabled
    /*
    if (notifications.length > 0) {
      await prisma.notificationAudit.createMany({
        data: notifications.map(n => ({
          notificationId: n.id,
          userId: user.id,
          action: "SHOWN",
          metadata: JSON.stringify({ context: "notification_bell", timestamp: new Date().toISOString() })
        }))
      });
    }
    */

    return { success: true, notifications };
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return { success: false, error: "Error al obtener notificaciones" };
  }
}

export async function markNotificationAsRead(notificationId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "No autenticado" };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.notification.update({
        where: { id: notificationId, recipientId: user.id },
        data: { isRead: true }
      });
      /*
      await tx.notificationAudit.create({
        data: {
          notificationId,
          userId: user.id,
          action: "READ",
          metadata: JSON.stringify({ timestamp: new Date().toISOString() })
        }
      });
      */
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to mark notification as read:", error);
    return { success: false, error: "Error al actualizar notificación" };
  }
}

export async function getActivityDeepLink(activityId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  if (!activityId) return { success: false as const, error: "Actividad inválida" };

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: {
      id: true,
      projectId: true,
      collaboratorId: true,
      inspectionEquipmentId: true,
      project: { select: { consultantId: true, clientUserId: true } },
    },
  });
  if (!activity) return { success: false as const, error: "Actividad no encontrada" };

  const isAdmin = user.role === "ADMIN_PMD" || user.role === "GESTOR";
  const isConsultant = user.role === "CONSULTANT" && activity.project.consultantId === user.id;
  const isClient = (user.role === "CLIENT" || user.role === "CLIENT_VIEWER") && activity.project.clientUserId === user.id;
  if (!isAdmin && !isConsultant && !isClient) {
    return { success: false as const, error: "Sin permisos" };
  }

  if (activity.inspectionEquipmentId) {
    return {
      success: true as const,
      url: `/projects/${activity.projectId}?view=inspection-maintenance&highlight=${activity.id}`,
    };
  }

  if (activity.collaboratorId) {
    return {
      success: true as const,
      url: `/projects/${activity.projectId}?view=collaborators&highlight=${activity.id}`,
    };
  }

  return { success: true as const, url: `/projects/${activity.projectId}?view=requirements&highlight=${activity.id}` };
}

// Internal helper for creating notifications
async function createNotification(
  tx: Prisma.TransactionClient | typeof prisma,
  data: {
    recipientId: string;
    title: string;
    message: string;
    type: string;
    priority: string;
    category?: string;
    functionalArea?: string;
    activityId?: string;
  }
) {
  return tx.notification.create({
    data: {
      recipientId: data.recipientId,
      title: data.title,
      message: data.message,
      type: data.type,
      priority: data.priority,
      category: data.category || "OPERATIONAL",
      functionalArea: data.functionalArea || "SST",
      activityId: data.activityId,
    }
  });
}

export async function removeActivityFile(formData: FormData) {
  try {
    const activityId = formData.get("activityId") as string;

    if (!activityId) {
      return { success: false, error: "Actividad requerida" };
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "No autenticado." };
    }

    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        project: true,
      },
    });

    if (!activity) {
      return { success: false, error: "Actividad no encontrada." };
    }

    const userRole = currentUser.role;
    const userId = currentUser.id;

    const isAdmin = userRole === "ADMIN_PMD";
    const isProjectConsultant =
      userRole === "CONSULTANT" && activity.project.consultantId === userId;
    const isProjectClient =
      userRole === "CLIENT_VIEWER" && activity.project.clientUserId === userId;

    if (!isAdmin && !isProjectConsultant && !isProjectClient) {
      return { success: false, error: "No tiene permisos para eliminar el documento de este requisito." };
    }

    const latestDoc = await prisma.document.findFirst({
      where: { activityId, deletedAt: null },
      orderBy: { uploadedAt: "desc" },
    });

    if (!latestDoc) {
      return { success: false, error: "No hay documento para eliminar" };
    }
    
    if (isProjectClient && latestDoc.uploadedByUserId !== userId) {
         return { success: false, error: "Solo puede eliminar documentos que usted haya cargado." };
    }

    // Soft delete logic
    await prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: latestDoc.id },
        data: { deletedAt: new Date() },
      });

      // Check if there are remaining active documents
      const remainingCount = await tx.document.count({
        where: { 
          activityId,
          deletedAt: null
        }
      });

      await tx.activity.update({
        where: { id: activityId },
        data: { status: remainingCount > 0 ? "IN_REVIEW" : "PENDING" },
      });

      await tx.activityHistory.create({
        data: {
          activityId,
          field: "document_delete",
          oldValue: latestDoc.name,
          newValue: "Eliminado (Soft)",
          changedByUserId: currentUser.id,
        },
      });
    });

    revalidatePath("/projects");
    revalidatePath("/documents");
    revalidatePath("/activities");

    return { success: true };
  } catch (error) {
    console.error("Failed to remove activity file:", error);
    return { success: false, error: "Error al eliminar el documento" };
  }
}

export async function updateProject(formData: FormData) {
  const id = formData.get('id') as string;
  const name = formData.get('name') as string;
  const clientName = formData.get('clientName') as string;
  const consultantId = formData.get('consultantId') as string;

  const economicActivity = (formData.get('economicActivity') as string | null)?.trim() || "";
  const ciiu = (formData.get('ciiu') as string | null)?.trim() || "";
  const contractStartDateStr = (formData.get('contractStartDate') as string | null)?.trim() || "";
  const contractNumberStr = (formData.get('contractNumber') as string | null)?.trim() || "";
  const riskLevel = (formData.get('riskLevel') as string | null)?.trim() || "";
  
  // New fields
  const nit = (formData.get('nit') as string | null)?.trim() || "";
  const address = (formData.get('address') as string | null)?.trim() || "";
  const department = (formData.get('department') as string | null)?.trim() || "";
  const municipality = (formData.get('municipality') as string | null)?.trim() || "";
  const phone = (formData.get('phone') as string | null)?.trim() || "";
  const workerCountStr = (formData.get('workerCount') as string | null)?.trim() || "";
  const logoUrl = (formData.get('logoUrl') as string | null)?.trim() || "";
  const chapter = (formData.get('chapter') as string | null)?.trim() || "";
  const status = (formData.get('status') as string | null)?.trim() || "ACTIVE";

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { success: false, error: "No autenticado." };
  }

  const project = await prisma.project.findUnique({
    where: { id },
    select: { consultantId: true, clientUserId: true },
  });

  if (!project) {
    return { success: false, error: "Empresa no encontrada." };
  }

  const userRole = currentUser.role;
  const userId = currentUser.id;

  const isAdmin = userRole === "ADMIN_PMD";
  const isProjectConsultant =
    userRole === "CONSULTANT" && project.consultantId === userId;

  if (!isAdmin && !isProjectConsultant) {
    return {
      success: false,
      error: "No tiene permisos para actualizar esta empresa.",
    };
  }

  if (!id || !name || !clientName || !consultantId || !economicActivity || !ciiu || !contractStartDateStr || !contractNumberStr || !riskLevel ||
      !nit || !address || !department || !municipality || !phone || !workerCountStr || !chapter) {
    return { success: false, error: "Todos los campos obligatorios son requeridos" };
  }

  if (ciiu.length !== 4 || isNaN(Number(ciiu))) {
     return { success: false, error: "El CIIU debe tener 4 dígitos numéricos" };
  }
  
  const contractNumber = parseInt(contractNumberStr, 10);
  if (isNaN(contractNumber)) {
     return { success: false, error: "Número de contrato inválido" };
  }
  const workerCount = parseInt(workerCountStr, 10);
  if (isNaN(workerCount)) {
     return { success: false, error: "Número de trabajadores inválido" };
  }

  if (phone.length !== 10 || isNaN(Number(phone))) {
    return { success: false, error: "El teléfono debe tener 10 dígitos numéricos" };
  }

  const existingContract = await prisma.project.findFirst({
    where: { 
      contractNumber,
      NOT: { id }
    },
  });
  if (existingContract) {
    return { success: false, error: "El número de contrato ya existe en otra empresa." };
  }

  const existingNit = await prisma.project.findFirst({
    where: { 
      nit,
      NOT: { id }
    },
  });
  if (existingNit) {
    return { success: false, error: "El NIT ya existe en otra empresa." };
  }

  const contractStartDate = new Date(contractStartDateStr);
  if (isNaN(contractStartDate.getTime())) {
     return { success: false, error: "Fecha de inicio de contrato inválida" };
  }

  try {
    await prisma.project.update({
      where: { id },
      data: {
        name,
        clientName,
        economicActivity,
        ciiu,
        contractStartDate,
        contractNumber,
        riskLevel,
        nit,
        address,
        department,
        municipality,
        phone,
        workerCount,
        logoUrl: logoUrl || undefined, // undefined to avoid overwriting with empty string if not provided
        chapter,
        status,
      },
    });

    // Check if consultant changed
    const oldConsultantId = project.consultantId;
    const newConsultantId = consultantId;

    if (oldConsultantId !== newConsultantId) {
      await prisma.$transaction(async (tx) => {
        // Update consultant
        await tx.$executeRaw`
          UPDATE "Project"
          SET "consultantId" = ${newConsultantId}
          WHERE "id" = ${id}
        `;

        // Notify new consultant
        if (newConsultantId) {
          await createNotification(tx, {
            recipientId: newConsultantId,
            title: "Nueva Empresa Asignada",
            message: `Se te ha asignado la empresa "${name}".`,
            type: "SYSTEM_ALERT",
            priority: "HIGH",
            category: "ADMINISTRATIVE",
            functionalArea: "SST",
          });
        }

        // Notify old consultant
        if (oldConsultantId) {
          await createNotification(tx, {
            recipientId: oldConsultantId,
            title: "Empresa Desasignada",
            message: `Se te ha retirado la asignación de la empresa "${name}".`,
            type: "SYSTEM_ALERT",
            priority: "MEDIUM",
            category: "ADMINISTRATIVE",
            functionalArea: "SST",
          });
        }
        
        // Notify client user (if exists)
        if (project.clientUserId) {
             await createNotification(tx, {
               recipientId: project.clientUserId,
               title: "Cambio de Consultor",
               message: `Se ha actualizado la asignación de consultor para tu empresa "${name}".`,
               type: "SYSTEM_ALERT",
               priority: "MEDIUM",
               category: "ADMINISTRATIVE",
               functionalArea: "SST",
             });
        }
      });
    } else {
       // If consultant didn't change, just ensure the update happened (prisma.update above handles other fields)
       // But we still need to execute the raw update if needed? No, prisma.update handles scalar fields.
       // Wait, the original code had a raw update for consultantId. Why?
       // Probably because of some schema issue where consultantId wasn't in the update input type?
       // Let's keep it safe.
       await prisma.$executeRaw`
          UPDATE "Project"
          SET "consultantId" = ${consultantId}
          WHERE "id" = ${id}
        `;
    }

    revalidatePath("/projects");
    revalidatePath("/overview");
    revalidatePath("/activities");
    revalidatePath("/documents");
    revalidatePath(`/projects/${id}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to update project:", error);
    return { success: false, error: "Failed to update project" };
  }
}

export async function createUser(formData: FormData) {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const role = formData.get('role') as string;
  const imageFile = formData.get('image') as File | null;

  if (!name || !email || !password || !role) {
    return { success: false, error: "Todos los campos son requeridos" };
  }

  let imageUrl: string | null = null;

  if (imageFile && imageFile.size > 0) {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(imageFile.type)) {
      return { success: false, error: "Formato de imagen no válido (JPG, PNG, WEBP)." };
    }
    if (imageFile.size > 5 * 1024 * 1024) {
      return { success: false, error: "La imagen no debe superar los 5MB." };
    }

    try {
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      const ext = imageFile.name.split('.').pop();
      const fileName = `profiles/${randomUUID()}.${ext}`;
      imageUrl = await uploadToS3(fileName, buffer, imageFile.type);
    } catch (error) {
      console.error("Failed to upload profile image:", error);
      return { success: false, error: "Error al subir la imagen de perfil." };
    }
  }

  try {
    const hashedPassword = await hash(password, 10);
    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        image: imageUrl,
      },
    });
    revalidatePath('/users');
    return { success: true };
  } catch (error) {
    console.error("Failed to create user:", error);
    return { success: false, error: "Error al crear usuario. Verifique si el correo ya existe." };
  }
}

export async function deleteUser(id: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "ADMIN_PMD") {
      return { success: false, error: "No tiene permisos para eliminar usuarios." };
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.deletedAt) {
      return { success: false, error: "Usuario no encontrado." };
    }
    if (user.role === "ADMIN_PMD") {
      return { success: false, error: "No permitido: un Administrador PMD no puede eliminarse." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          action: "DELETE_USER",
          entity: "User",
          entityId: id,
          performedBy: currentUser.id,
          details: JSON.stringify({
            targetUserEmail: user.email,
            targetUserRole: user.role,
          }),
        },
      });
    });

    revalidatePath('/users');
    return { success: true };
  } catch (error) {
    console.error("Failed to delete user:", error);
    return { success: false, error: "No se pudo eliminar el usuario." };
  }
}

export async function deleteProject(id: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "ADMIN_PMD") {
      return {
        success: false,
        error: "No tiene permisos para eliminar empresas.",
      };
    }

    const project = await prisma.project.findUnique({
      where: { id },
      select: { 
        name: true,
        clientUserId: true,
        clientUser: {
          select: { role: true }
        }
      },
    });

    if (!project) {
      return { success: false, error: "Empresa no encontrada." };
    }

    await prisma.$transaction(async (tx) => {
      // Eliminar documentos asociados a las actividades de este proyecto
      await tx.document.deleteMany({
        where: {
          activity: {
            projectId: id,
          },
        },
      });

      // Eliminar historial de actividades
      await tx.activityHistory.deleteMany({
        where: {
          activity: {
            projectId: id,
          },
        },
      });

      // Eliminar actividades del proyecto
      await tx.activity.deleteMany({
        where: { projectId: id },
      });

      // Eliminar colaboradores del proyecto
      await tx.collaborator.deleteMany({
        where: { projectId: id },
      });

      // Finalmente eliminar la empresa
      await tx.project.delete({
        where: { id },
      });

      // Eliminar usuario cliente asociado si no tiene otras empresas y es CLIENT_VIEWER
      if (project.clientUserId && project.clientUser?.role === 'CLIENT_VIEWER') {
        const remainingProjects = await tx.project.count({
          where: { clientUserId: project.clientUserId }
        });

        if (remainingProjects === 0) {
          await tx.user.update({
            where: { id: project.clientUserId },
            data: { deletedAt: new Date() },
          });
        }
      }

      // Crear registro de auditoría
      /*
      await tx.auditLog.create({
        data: {
          action: "DELETE",
          entity: "PROJECT",
          entityId: id,
          details: `Empresa ${project.name} eliminada`,
          performedBy: currentUser.id,
        },
      });
      */
    });

    revalidatePath('/projects');
    revalidatePath('/activities');
    revalidatePath('/overview');
    revalidatePath('/documents');

    return { success: true };
  } catch (error) {
    console.error("Failed to delete project:", error);
    return {
      success: false,
      error: "No se pudo eliminar la empresa. Intente de nuevo o contacte soporte.",
    };
  }
}

export async function updateUser(formData: FormData) {
  const id = formData.get('id') as string;
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const role = formData.get('role') as string;
  const password = (formData.get('password') as string) || "";
  const imageFile = formData.get('image') as File | null;
  const removeImage = formData.get('removeImage') === 'true';

  if (!id || !name || !email || !role) {
    return { success: false, error: "Todos los campos (excepto contraseña) son requeridos" };
  }

  try {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Usuario no encontrado." };
    }

    const effectiveRole = existing.role === 'ADMIN_PMD' ? existing.role : role;
    const data: Prisma.UserUpdateInput = { name, email, role: effectiveRole };
    
    if (password.trim().length > 0) {
      const hashedPassword = await hash(password, 10);
      data.password = hashedPassword;
    }

    if (removeImage) {
      data.image = null;
    } else if (imageFile && imageFile.size > 0) {
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(imageFile.type)) {
        return { success: false, error: "Formato de imagen no válido (JPG, PNG, WEBP)." };
      }
      if (imageFile.size > 5 * 1024 * 1024) {
        return { success: false, error: "La imagen no debe superar los 5MB." };
      }

      try {
        const buffer = Buffer.from(await imageFile.arrayBuffer());
        const ext = imageFile.name.split('.').pop();
        const fileName = `profiles/${randomUUID()}.${ext}`;
        data.image = await uploadToS3(fileName, buffer, imageFile.type);
      } catch (error) {
        console.error("Failed to upload profile image:", error);
        return { success: false, error: "Error al subir la imagen de perfil." };
      }
    }

    await prisma.user.update({
      where: { id },
      data,
    });
    revalidatePath('/users');
    return { success: true };
  } catch (error) {
    console.error("Failed to update user:", error);
    return { success: false, error: "Error al actualizar usuario." };
  }
}

export async function createProjectActivity(formData: FormData) {
  try {
    const projectId = formData.get("projectId") as string | null;
    const title = (formData.get("title") as string | null)?.trim() || "";
    const dueDateStr = (formData.get("dueDate") as string | null)?.trim() || "";
    const priority = (formData.get("priority") as string | null)?.trim() || "Media";
    const periodicityRaw = (formData.get("periodicity") as string | null)?.trim() || "";
    const assignedToId = (formData.get("assignedToId") as string | null)?.trim() || null;

    if (!projectId || !title) {
      return { success: false, error: "Empresa y título son requeridos." };
    }

    const periodicity = normalizePeriodicity(periodicityRaw);
    if (!periodicity) {
      return { success: false, error: "Periodicidad es requerida." };
    }
    if (!isValidPeriodicity(periodicity)) {
      return { success: false, error: "Periodicidad inválida." };
    }
    
    let parsedDue: Date | null = null;
    let calculatedPriority: string | null = null;
    
    if (dueDateStr) {
      parsedDue = new Date(dueDateStr);
      if (Number.isNaN(parsedDue.getTime())) {
        return { success: false, error: "Fecha de vencimiento inválida." };
      }
      
      const priorityResult = calculatePriority(parsedDue);
      if (!priorityResult.isValid) {
        return { success: false, error: priorityResult.error || "Fecha de vencimiento inválida." };
      }
      calculatedPriority = priorityResult.priority;
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "No autenticado." };
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return { success: false, error: "Empresa no encontrada." };
    }

    const userRole = currentUser.role;
    const userId = currentUser.id;

    const isAdmin = userRole === "ADMIN_PMD";
    const isProjectConsultant =
      userRole === "CONSULTANT" && project.consultantId === userId;

    if (!isAdmin && !isProjectConsultant) {
      return { success: false, error: "No tiene permisos para gestionar actividades de esta empresa." };
    }

    const allowedAssigneeIds = new Set<string>();
    if (isAdmin) allowedAssigneeIds.add(userId);
    if (project.consultantId) allowedAssigneeIds.add(project.consultantId);
    if (project.clientUserId) allowedAssigneeIds.add(project.clientUserId);
    if (isProjectConsultant || isAdmin) {
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN_PMD", deletedAt: null },
        select: { id: true },
      });
      for (const admin of admins) allowedAssigneeIds.add(admin.id);
    }

    const allowedExisting = await prisma.user.findMany({
      where: { id: { in: Array.from(allowedAssigneeIds) }, deletedAt: null },
      select: { id: true },
    });
    const allowedExistingSet = new Set(allowedExisting.map((u) => u.id));

    let assigneeId: string | undefined = undefined;
    if ((isAdmin || isProjectConsultant) && assignedToId) {
      if (!allowedExistingSet.has(assignedToId)) {
        return { success: false, error: "Asignación inválida para esta empresa." };
      }
      assigneeId = assignedToId;
    } else if (isProjectConsultant) {
      assigneeId = userId;
    } else if (project.consultantId && allowedExistingSet.has(project.consultantId)) {
      assigneeId = project.consultantId;
    }

    const activity = await prisma.activity.create({
      data: {
        title,
        status: "PENDING",
        priority: calculatedPriority ?? priority,
        dueDate: parsedDue,
        periodicity,
        projectId,
        assignedToId: assigneeId,
      },
    });

    if (assigneeId && assigneeId !== currentUser.id) {
      let notification: Awaited<ReturnType<typeof createNotification>> | null = null;
      try {
        notification = await createNotification(prisma, {
          recipientId: assigneeId,
          title: "Actividad asignada",
          message: `Se te ha asignado la actividad "${title}" de la empresa "${project.name}".`,
          type: "ACTIVITY_ASSIGNED",
          priority: activity.priority,
          activityId: activity.id,
          category: "OPERATIONAL",
          functionalArea: "SST",
        });
      } catch (e) {
        console.error("Failed to create notification for activity creation assignment (non-blocking):", e);
      }

      if (notification) {
        try {
          publishNotificationsEvent({
            type: "notification_created",
            payload: {
              id: notification.id,
              recipientId: notification.recipientId,
              title: notification.title,
              message: notification.message,
              type: notification.type,
              priority: notification.priority,
              category: notification.category,
              functionalArea: notification.functionalArea,
              createdAt: notification.createdAt.toISOString(),
              activityId: notification.activityId,
            },
          });
        } catch (e) {
          console.error("Failed to publish notification event (non-blocking):", e);
        }
      }
    }

    if (!isAdmin) {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN_PMD" } });
      if (admins && admins.length > 0) {
        const createdOn = new Date().toISOString().slice(0, 10);
        const creator = currentUser.name || currentUser.email || "Usuario";
        await Promise.all(admins.map(admin => 
           createNotification(prisma, {
            recipientId: admin.id,
            title: "Nueva Actividad de Empresa",
            message: `Nueva actividad creada · Tipo: Empresa · Actividad: "${title}" · Empresa: ${project.name} · Fecha: ${createdOn} · Responsable: ${creator}`,
            type: "ACTIVITY_CREATED",
            priority: "MEDIUM",
            category: "OPERATIONAL",
            functionalArea: "SST",
            activityId: activity.id,
          }).catch(err => console.error(`Failed to notify admin ${admin.id}:`, err))
        ));
      }
    }

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/activities");

    publishActivitiesEvent({
      type: "activity_created",
      payload: {
        kind: "ACTIVITY",
        id: activity.id,
        title: activity.title,
        status: activity.status,
        updatedAt: activity.updatedAt.toISOString(),
        priority: activity.priority,
        dueDate: activity.dueDate ? activity.dueDate.toISOString() : null,
        returnedNote: null,
        returnedAt: null,
        project: {
          id: projectId,
          name: project.name,
          nit: project.nit ?? null,
          consultantId: project.consultantId ?? null,
        },
        assignedTo: null,
        documents: [],
      },
    });
    return { success: true, activityId: activity.id };
  } catch (error) {
    console.error("Failed to create project activity:", error);
    const message = error instanceof Error ? error.message : "";
    return { success: false, error: message || "Error al crear la actividad." };
  }
}

export async function updateProjectActivity(id: string, formData: FormData) {
  try {
    const title = (formData.get("title") as string | null)?.trim();
    const dueDateStr = (formData.get("dueDate") as string | null)?.trim();
    const priority = (formData.get("priority") as string | null)?.trim();
    const periodicityRaw = (formData.get("periodicity") as string | null)?.trim();
    const assignedToId = (formData.get("assignedToId") as string | null)?.trim();

    if (!id) {
      return { success: false, error: "Actividad requerida." };
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "No autenticado." };
    }

    const activity = await prisma.activity.findUnique({
      where: { id },
      include: { project: true, assignedTo: true },
    });

    if (!activity) {
      return { success: false, error: "Actividad no encontrada." };
    }

    const userRole = currentUser.role;
    const userId = currentUser.id;
    const isAdmin = userRole === "ADMIN_PMD";
    const isProjectConsultant = userRole === "CONSULTANT" && activity.project.consultantId === userId;

    if (!isAdmin && !isProjectConsultant) {
      return { success: false, error: "No tiene permisos para editar esta actividad." };
    }

    const updates: Prisma.ActivityUpdateInput = {};
    if (title) updates.title = title;
    if (priority) updates.priority = priority;

    if (periodicityRaw !== undefined) {
      const periodicity = normalizePeriodicity(periodicityRaw || "");
      if (periodicity && !isValidPeriodicity(periodicity)) {
        return { success: false, error: "Periodicidad inválida." };
      }
      updates.periodicity = periodicity || null;
    }
    
    if (assignedToId !== undefined) {
      if (!isAdmin && !isProjectConsultant) {
        return { success: false, error: "No tiene permisos para reasignar actividades." };
      }

      if (!assignedToId) {
        updates.assignedTo = { disconnect: true };
      } else {
        const allowedAssigneeIds = new Set<string>();
        allowedAssigneeIds.add(userId);
        if (activity.project.consultantId) allowedAssigneeIds.add(activity.project.consultantId);
        if (activity.project.clientUserId) allowedAssigneeIds.add(activity.project.clientUserId);
        if (isProjectConsultant || isAdmin) {
          const admins = await prisma.user.findMany({
            where: { role: "ADMIN_PMD", deletedAt: null },
            select: { id: true },
          });
          for (const admin of admins) allowedAssigneeIds.add(admin.id);
        }

        const allowedExisting = await prisma.user.findMany({
          where: { id: { in: Array.from(allowedAssigneeIds) }, deletedAt: null },
          select: { id: true },
        });
        const allowedExistingSet = new Set(allowedExisting.map((u) => u.id));
        if (!allowedExistingSet.has(assignedToId)) {
          return { success: false, error: "Asignación inválida para esta empresa." };
        }
        updates.assignedTo = { connect: { id: assignedToId } };
      }
    }

    const nextAssigneeId = assignedToId !== undefined ? (assignedToId ? assignedToId : null) : activity.assignedToId;
    const assignmentChanged = assignedToId !== undefined && activity.assignedToId !== nextAssigneeId;

    if (dueDateStr !== undefined) {
      if (dueDateStr === "") {
        updates.dueDate = null;
        // Reset priority to default when due date is cleared
        updates.priority = "Media";
      } else if (dueDateStr) {
        const parsed = new Date(dueDateStr);
        if (!isNaN(parsed.getTime())) {
          updates.dueDate = parsed;
          
          const priorityResult = calculatePriority(parsed);
          if (!priorityResult.isValid) {
            return { success: false, error: priorityResult.error || "Fecha de vencimiento inválida." };
          }
          updates.priority = priorityResult.priority;
        }
      }
    }

    await prisma.$transaction(async (tx) => {
        await tx.activity.update({
            where: { id },
            data: updates,
        });
        
        if (title && title !== activity.title) {
             /*
             await tx.activityHistory.create({
                data: {
                    activityId: id,
                    field: "title",
                    oldValue: activity.title,
                    newValue: title,
                    changedByUserId: userId,
                }
             });
             */
        }
         if (priority && priority !== activity.priority) {
             /*
             await tx.activityHistory.create({
                data: {
                    activityId: id,
                    field: "priority",
                    oldValue: activity.priority,
                    newValue: priority,
                    changedByUserId: userId,
                }
             });
             */
        }
         if (assignedToId !== undefined) {
            const newAssigneeId = assignedToId || null;
            if (activity.assignedToId !== newAssigneeId) {
                 /*
                 await tx.activityHistory.create({
                    data: {
                        activityId: id,
                        field: "assignedTo",
                        oldValue: oldAssignee,
                        newValue: newAssigneeName,
                        changedByUserId: userId,
                    }
                 });
                 */
            }
        }
    });

    if (assignmentChanged && nextAssigneeId && nextAssigneeId !== currentUser.id) {
      const finalTitle = title || activity.title;
      const message = `Se te ha asignado la actividad "${finalTitle}" de la empresa "${activity.project.name}".`;
      let notification: Awaited<ReturnType<typeof createNotification>> | null = null;
      try {
        notification = await createNotification(prisma, {
          recipientId: nextAssigneeId,
          title: "Actividad asignada",
          message,
          type: "ACTIVITY_ASSIGNED",
          priority: "MEDIUM",
          activityId: id,
          category: "OPERATIONAL",
          functionalArea: "SST",
        });
      } catch (e) {
        console.error("Failed to create notification for assignment (non-blocking):", e);
      }

      if (notification) {
        try {
          publishNotificationsEvent({
            type: "notification_created",
            payload: {
              id: notification.id,
              recipientId: notification.recipientId,
              title: notification.title,
              message: notification.message,
              type: notification.type,
              priority: notification.priority,
              category: notification.category,
              functionalArea: notification.functionalArea,
              createdAt: notification.createdAt.toISOString(),
              activityId: notification.activityId,
            },
          });
        } catch (e) {
          console.error("Failed to publish notification event (non-blocking):", e);
        }
      }
    }

    revalidatePath(`/projects/${activity.projectId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to update project activity:", error);
    return { success: false, error: "Error al actualizar la actividad." };
  }
}

export async function deleteProjectActivity(id: string) {
  try {
    if (!id) {
      return { success: false, error: "Actividad requerida." };
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "No autenticado." };
    }

    const activity = await prisma.activity.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!activity) {
      return { success: false, error: "Actividad no encontrada." };
    }

    const userRole = currentUser.role;
    const userId = currentUser.id;

    const isAdmin = userRole === "ADMIN_PMD";
    const isProjectConsultant =
      userRole === "CONSULTANT" && activity.project.consultantId === userId;

    if (!isAdmin && !isProjectConsultant) {
      return { success: false, error: "No tiene permisos para eliminar esta actividad." };
    }

    if (!isAdmin) {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN_PMD" } });
      for (const admin of admins) {
        await createNotification(prisma, {
          recipientId: admin.id,
          title: "Actividad de Empresa Eliminada",
          message: `La actividad "${activity.title}" de la empresa "${activity.project.name}" ha sido eliminada.`,
          type: "ACTIVITY_DELETED",
          priority: "HIGH",
          category: "OPERATIONAL",
          functionalArea: "SST",
        });
      }
    }

    await prisma.$transaction(async (tx) => {
        await tx.notification.deleteMany({
            where: { activityId: id },
        });

        await tx.document.deleteMany({
            where: { activityId: id },
        });

        await tx.activityHistory.deleteMany({
            where: { activityId: id },
        });

        await tx.activity.delete({
            where: { id },
        });
    });

    revalidatePath(`/projects/${activity.projectId}`);

    return { success: true };
  } catch (error) {
    console.error("Failed to delete project activity:", error);
    return { success: false, error: "Error al eliminar la actividad." };
  }
}

export async function getAdminActivities() {
  const user = await getCurrentUser();
  const userRole = user?.role || "CLIENT_VIEWER";
  const userId = user?.id || null;

  const activityBaseWhere: Prisma.ActivityWhereInput = {};

  if (userRole === "CONSULTANT" && userId) {
    activityBaseWhere.project = { consultantId: userId };
  } else if (userRole === "CLIENT_VIEWER" && userId) {
    activityBaseWhere.project = { clientUserId: userId };
  }

  const activities = await prisma.activity.findMany({
    where: activityBaseWhere,
    include: {
      project: { include: { consultant: true } },
      assignedTo: true,
      documents: {
        where: { deletedAt: null },
        orderBy: { uploadedAt: "desc" },
        select: {
          id: true,
          name: true,
          url: true,
          uploadedAt: true,
          version: true,
          sizeBytes: true,
        },
      },
      replies: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          adminMessage: true,
          message: true,
          createdAt: true,
          isRead: true,
          document: { select: { id: true, name: true, url: true } },
          createdByUser: { select: { name: true, role: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    // Remove limit for ADMIN_PMD or increase significantly
    take: userRole === "CONSULTANT" ? 300 : undefined,
  });
  
  return activities;
}

export async function markActivityRepliesAsRead(activityId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "No autenticado." };
    if (user.role !== "ADMIN_PMD") return { success: false, error: "No autorizado." };
    if (!activityId) return { success: false, error: "Actividad inválida." };

    await prisma.activityReply.updateMany({
      where: { activityId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    revalidatePath("/activities");
    return { success: true };
  } catch (error) {
    console.error("Failed to mark ActivityReply as read:", error);
    return { success: false, error: "Error al marcar como leído." };
  }
}

export async function getPendingReviewActivities() {
  const user = await getCurrentUser();
  const userRole = user?.role || "CLIENT_VIEWER";
  const userId = user?.id || null;

  if (userRole === "CLIENT_VIEWER") return { count: 0, activities: [] };

  const where: Prisma.ActivityWhereInput = {
    status: "IN_REVIEW",
  };

  if (userRole === "CONSULTANT" && userId) {
    where.project = { consultantId: userId };
  }

  const activities = await prisma.activity.findMany({
    where,
    select: {
      id: true,
      title: true,
      updatedAt: true,
      collaborator: {
        select: {
          firstName: true,
          firstSurname: true,
        }
      },
      project: {
        select: {
          name: true,
        }
      }
    },
    orderBy: { updatedAt: "desc" },
    take: 10, 
  });
  
  const count = await prisma.activity.count({ where });

  const accidentalidadWhere: Prisma.AccidentalidadEmpresaWhereInput = { status: "IN_REVIEW" };
  if (userRole === "CONSULTANT" && userId) {
    accidentalidadWhere.project = { consultantId: userId };
  }

  const accidentalidad = await prisma.accidentalidadEmpresa.findMany({
    where: accidentalidadWhere,
    select: {
      id: true,
      actividad: true,
      updatedAt: true,
      project: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  const accidentalidadMapped = accidentalidad.map((a) => ({
    id: a.id,
    title: a.actividad,
    updatedAt: a.updatedAt,
    collaborator: null,
    project: { name: a.project.name },
  }));

  return { count: count + accidentalidad.length, activities: [...accidentalidadMapped, ...activities] };
}
