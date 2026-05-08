'use server'

import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/app/auth-actions";
import { getPresignedUploadUrl, getPublicUrl } from "@/lib/s3";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { canEditAccidentalidad, canViewAccidentalidad } from "@/lib/permissions";
import {
  allowedAccidentalidadMimeTypes,
  maxAccidentalidadFileSizeBytes,
  parseDateOnly,
} from "@/lib/accidentalidad-logic";
import { validateAccidentalidadEstadoTransition } from "@/lib/accidentalidad-status";
import { publishNotificationsEvent } from "@/lib/realtime/notifications-bus";

async function getAccidentalidadWithProject(id: string) {
  return prisma.accidentalidadEmpresa.findUnique({
    where: { id },
    include: {
      project: true,
      archivos: {
        where: { deletedAt: null },
        orderBy: { uploadedAt: "desc" },
      },
    },
  });
}

function isUserAllowedForProject(args: {
  userRole: string;
  userId: string;
  project: { consultantId: string | null; clientUserId: string | null };
}) {
  const isAdmin = args.userRole === "ADMIN_PMD" || args.userRole === "GESTOR";
  const isConsultant = args.userRole === "CONSULTANT" && args.project.consultantId === args.userId;
  const isClient = (args.userRole === "CLIENT" || args.userRole === "CLIENT_VIEWER") && args.project.clientUserId === args.userId;
  return { isAdmin, isConsultant, isClient, canView: isAdmin || isConsultant || isClient };
}

async function createNotification(
  tx: any,
  data: {
    recipientId: string;
    title: string;
    message: string;
    type: string;
    priority: string;
    category?: string;
    functionalArea?: string;
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
    },
  });
}

export async function getAccidentalidadFileHistory(accidentalidadId: string) {
  const user = await getCurrentUser();
  if (!user || !canViewAccidentalidad(user.role)) {
    return { success: false as const, error: "No autorizado." };
  }

  const acc = await prisma.accidentalidadEmpresa.findUnique({
    where: { id: accidentalidadId },
    include: { project: true },
  });
  if (!acc) return { success: false as const, error: "Registro no encontrado." };

  const access = isUserAllowedForProject({
    userRole: user.role,
    userId: user.id,
    project: acc.project,
  });
  if (!access.canView) return { success: false as const, error: "No autorizado." };

  const files = await prisma.archivoAccidentalidad.findMany({
    where: { accidentalidadId, deletedAt: null },
    orderBy: { uploadedAt: "desc" },
    include: {
      uploadedByUser: { select: { name: true, role: true } },
    },
  });

  return { success: true as const, files };
}

export async function updateAccidentalidadStatus(formData: FormData) {
  try {
    const accidentalidadId = formData.get("accidentalidadId") as string | null;
    const status = (formData.get("status") as string | null)?.trim() || null;
    const note = (formData.get("note") as string | null)?.trim() || null;

    if (!accidentalidadId || !status) {
      return { success: false as const, error: "Actividad y estado son requeridos." };
    }

    const actor = await getCurrentUser();
    if (!actor) return { success: false as const, error: "No autenticado." };

    const current = await prisma.accidentalidadEmpresa.findUnique({
      where: { id: accidentalidadId },
      include: { project: true },
    });
    if (!current) return { success: false as const, error: "Actividad no encontrada." };

    const access = isUserAllowedForProject({
      userRole: actor.role,
      userId: actor.id,
      project: current.project,
    });
    if (!access.canView) return { success: false as const, error: "No autorizado." };

    const valid = validateAccidentalidadEstadoTransition({
      from: current.status,
      to: status,
      actorRole: actor.role,
    });
    if (!valid.ok) return { success: false as const, error: valid.error };

    await prisma.$transaction(async (tx) => {
      await tx.accidentalidadEmpresa.update({
        where: { id: accidentalidadId },
        data: {
          status,
          assignedToId:
            status === "REJECTED" && current.project.consultantId
              ? current.project.consultantId
              : undefined,
        },
      });

      await tx.historialAccidentalidad.create({
        data: {
          accidentalidadId,
          field: "status",
          oldValue: current.status,
          newValue: status,
          changedByUserId: actor.id,
        },
      });

      if (note) {
        await tx.historialAccidentalidad.create({
          data: {
            accidentalidadId,
            field: "status_note",
            oldValue: null,
            newValue: note,
            changedByUserId: actor.id,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entity: "ACCIDENTALIDAD_STATUS",
          entityId: accidentalidadId,
          details: `Cambio de estado: ${current.status} -> ${status}`,
          performedBy: actor.id,
        },
      });
    });

    try {
      if (status === "APPROVED" && current.project.consultantId) {
        const notification = await createNotification(prisma, {
          recipientId: current.project.consultantId,
          title: "Actividad Aprobada",
          message: `[ACC:${current.id}] La actividad "${current.actividad}" de ${current.project.name} ha sido aprobada.`,
          type: "SYSTEM_ALERT",
          priority: "LOW",
          category: "OPERATIONAL",
          functionalArea: "SST",
        });
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
      }

      if (status === "IN_REVIEW" && actor.role !== "ADMIN_PMD") {
        const admins = await prisma.user.findMany({ where: { role: "ADMIN_PMD" } });
        for (const admin of admins) {
          const notification = await createNotification(prisma, {
            recipientId: admin.id,
            title: "Actividad en Revisión",
            message: `[ACC:${current.id}] La actividad "${current.actividad}" de ${current.project.name} ha cambiado a estado de revisión.`,
            type: "ACTIVITY_REVIEW",
            priority: "HIGH",
            category: "OPERATIONAL",
            functionalArea: "SST",
          });
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
        }
      }

      if (status === "REJECTED" && current.project.consultantId) {
        const now = new Date();
        const link = `/activities?status=REJECTED&highlight=${current.id}`;
        const notification = await createNotification(prisma, {
          recipientId: current.project.consultantId,
          title: "Actividad Devuelta",
          message: `[ACC:${current.id}] La actividad "${current.actividad}" de ${current.project.name} fue devuelta con observaciones. Motivo: ${note || ""}. Fecha/hora: ${now.toISOString()}. Ir a la actividad: ${link}`,
          type: "ACTIVITY_RETURNED",
          priority: "HIGH",
          category: "OPERATIONAL",
          functionalArea: "SST",
        });
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
      }
    } catch (notifyError) {
      console.error("Failed to send accidentalidad notifications:", notifyError);
    }

    revalidatePath(`/projects/${current.projectId}`);
    revalidatePath("/activities");
    revalidatePath("/overview");
    return { success: true as const };
  } catch (error) {
    console.error("Failed to update accidentalidad status:", error);
    return { success: false as const, error: "Error al actualizar el estado." };
  }
}

export async function syncAccidentalidadForProject(projectId: string) {
  const user = await getCurrentUser();
  if (!user || !canViewAccidentalidad(user.role)) return { success: false as const };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, consultantId: true, clientUserId: true, consultant: { select: { name: true } } },
  });
  if (!project) return { success: false as const };

  const access = isUserAllowedForProject({
    userRole: user.role,
    userId: user.id,
    project,
  });
  if (!access.canView) return { success: false as const };

  return { success: true as const };
}

export async function getAccidentalidadHistory(accidentalidadId: string) {
  const user = await getCurrentUser();
  if (!user || !canViewAccidentalidad(user.role)) {
    return { success: false as const, error: "No autorizado." };
  }

  const acc = await prisma.accidentalidadEmpresa.findUnique({
    where: { id: accidentalidadId },
    include: { project: true },
  });
  if (!acc) return { success: false as const, error: "Registro no encontrado." };

  const access = isUserAllowedForProject({ userRole: user.role, userId: user.id, project: acc.project });
  if (!access.canView) return { success: false as const, error: "No autorizado." };

  const history = await prisma.historialAccidentalidad.findMany({
    where: { accidentalidadId },
    orderBy: { changedAt: "desc" },
    include: { changedBy: { select: { name: true, role: true } } },
  });
  return { success: true as const, history };
}

export async function updateAccidentalidadEmpresa(accidentalidadId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !canEditAccidentalidad(user.role)) {
    return { success: false as const, error: "No tiene permisos para editar." };
  }

  const actividad = (formData.get("actividad") as string | null)?.trim() || null;
  const dueDateStr = (formData.get("dueDate") as string | null)?.trim() || null;
  if (!dueDateStr) {
    return { success: false as const, error: "La fecha del accidente es obligatoria." };
  }
  const dueDate = parseDateOnly(dueDateStr);
  if (!dueDate) {
    return { success: false as const, error: "Fecha del accidente inválida." };
  }

  const acc = await prisma.accidentalidadEmpresa.findUnique({
    where: { id: accidentalidadId },
    include: { project: true },
  });
  if (!acc) return { success: false as const, error: "Registro no encontrado." };

  const access = isUserAllowedForProject({ userRole: user.role, userId: user.id, project: acc.project });
  if (!access.isAdmin && !access.isConsultant) {
    return { success: false as const, error: "No autorizado." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.accidentalidadEmpresa.update({
      where: { id: accidentalidadId },
      data: {
        actividad: actividad ?? acc.actividad,
        dueDate,
      },
    });

    if (actividad && actividad !== acc.actividad) {
      await tx.historialAccidentalidad.create({
        data: {
          accidentalidadId,
          field: "actividad",
          oldValue: acc.actividad,
          newValue: actividad,
          changedByUserId: user.id,
        },
      });
    }

    if (acc.dueDate.getTime() !== dueDate.getTime()) {
      await tx.historialAccidentalidad.create({
        data: {
          accidentalidadId,
          field: "dueDate",
          oldValue: acc.dueDate.toISOString(),
          newValue: dueDate.toISOString(),
          changedByUserId: user.id,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        action: "UPDATE",
        entity: "ACCIDENTALIDAD_EMPRESA",
        entityId: accidentalidadId,
        details: `Actualización de accidentalidad (${acc.projectId})`,
        performedBy: user.id,
      },
    });
  });

  revalidatePath(`/projects/${acc.projectId}`);
  return { success: true as const };
}

export async function deleteAccidentalidadEmpresa(accidentalidadId: string) {
  const user = await getCurrentUser();
  if (!user || !canEditAccidentalidad(user.role)) {
    return { success: false as const, error: "No tiene permisos para eliminar." };
  }

  const acc = await prisma.accidentalidadEmpresa.findUnique({
    where: { id: accidentalidadId },
    include: { project: true },
  });
  if (!acc) return { success: false as const, error: "Registro no encontrado." };

  const access = isUserAllowedForProject({ userRole: user.role, userId: user.id, project: acc.project });
  if (!access.isAdmin && !access.isConsultant) {
    return { success: false as const, error: "No autorizado." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.create({
      data: {
        action: "DELETE",
        entity: "ACCIDENTALIDAD_EMPRESA",
        entityId: accidentalidadId,
        details: `Eliminación de accidentalidad (${acc.projectId})`,
        performedBy: user.id,
      },
    });
    await tx.accidentalidadEmpresa.delete({ where: { id: accidentalidadId } });
  });

  revalidatePath(`/projects/${acc.projectId}`);
  return { success: true as const };
}

export async function createAccidentalidadTaskForAccident(formData: FormData) {
  try {
    const user = await getCurrentUser();
    if (!user || !canEditAccidentalidad(user.role)) {
      return { success: false as const, error: "No tiene permisos para crear actividades." };
    }

    const projectId = (formData.get("projectId") as string | null)?.trim() || "";
    const accidentId = (formData.get("accidentId") as string | null)?.trim() || "";
    const taskNameRaw = (formData.get("taskName") as string | null)?.trim() || "";

    if (!projectId) return { success: false as const, error: "projectId es requerido." };
    if (!accidentId) return { success: false as const, error: "accidentId es requerido." };
    if (!taskNameRaw) return { success: false as const, error: "El nombre de la actividad es requerido." };
    if (taskNameRaw.length > 120) return { success: false as const, error: "El nombre debe tener máximo 120 caracteres." };

    const normalize = (v: string) => v.replaceAll("|", " ").trim();
    const taskName = normalize(taskNameRaw);

    const first = await prisma.accidentalidadEmpresa.findFirst({
      where: { projectId, actividad: { startsWith: `ACC:${accidentId}|` } },
      include: { project: true, assignedTo: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
    if (!first) {
      return { success: false as const, error: "Accidente no encontrado." };
    }

    const access = isUserAllowedForProject({ userRole: user.role, userId: user.id, project: first.project });
    if (!access.isAdmin && !access.isConsultant) {
      return { success: false as const, error: "No autorizado." };
    }

    const parts = (first.actividad || "").split("|");
    if (parts.length < 6 || !parts[0]?.startsWith("ACC:")) {
      return { success: false as const, error: "Accidente inválido." };
    }

    const tag = parts[0];
    const accidentName = normalize(parts[1] || "Accidente");
    const nombreColaborador = normalize(parts[3] || "");
    const identificacion = normalize(parts[4] || "");
    const area = normalize(parts[5] || "");

    const actividad = `${tag}|${accidentName}|${taskName}|${nombreColaborador}|${identificacion}|${area}`;
    const dueDate = first.dueDate;
    const priority = first.priority || "Cumplido";
    const assignedToId = first.assignedToId;

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.accidentalidadEmpresa.create({
        data: {
          projectId,
          actividad,
          dueDate,
          status: "PENDING",
          priority,
          assignedToId,
        },
        include: {
          archivos: { where: { deletedAt: null }, orderBy: { uploadedAt: "desc" } },
          assignedTo: { select: { name: true } },
        },
      });

      await tx.historialAccidentalidad.create({
        data: {
          accidentalidadId: row.id,
          field: "create",
          oldValue: null,
          newValue: actividad,
          changedByUserId: user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "CREATE",
          entity: "ACCIDENTALIDAD_EMPRESA",
          entityId: row.id,
          details: `Actividad agregada a ${accidentName} (${projectId})`,
          performedBy: user.id,
        },
      });

      return row;
    });

    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/activities");
    revalidatePath("/overview");

    return {
      success: true as const,
      row: {
        id: created.id,
        actividad: created.actividad,
        status: created.status,
        priority: created.priority,
        dueDate: created.dueDate.toISOString(),
        createdAt: created.createdAt.toISOString(),
        assignedTo: created.assignedTo?.name || null,
        archivos: created.archivos.map((d) => ({
          id: d.id,
          name: d.name,
          url: d.url,
          uploadedAt: d.uploadedAt.toISOString(),
          version: d.version,
          sizeBytes: d.sizeBytes ?? null,
        })),
      },
    };
  } catch (error) {
    console.error("Failed to create accidentalidad task for accident:", error);
    return { success: false as const, error: "Error al crear la actividad." };
  }
}

export async function createAccidentalidadUploadRequest(formData: FormData) {
  try {
    const accidentalidadId = formData.get("accidentalidadId") as string;
    const fileName = formData.get("fileName") as string;
    const fileType = (formData.get("fileType") as string) || "application/octet-stream";
    const fileSizeStr = formData.get("fileSize") as string;
    const fileSize = fileSizeStr ? parseInt(fileSizeStr, 10) : 0;

    if (!accidentalidadId || !fileName) {
      return { success: false as const, error: "Registro y nombre de archivo son requeridos" };
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false as const, error: "No autenticado." };

    const acc = await getAccidentalidadWithProject(accidentalidadId);
    if (!acc) return { success: false as const, error: "Registro no encontrado." };

    const access = isUserAllowedForProject({
      userRole: currentUser.role,
      userId: currentUser.id,
      project: acc.project,
    });
    if (!access.canView) return { success: false as const, error: "No autorizado." };

    const canEdit =
      access.isAdmin ||
      access.isConsultant;

    if (!canEdit) {
      return { success: false as const, error: "No tiene permisos para cargar archivos." };
    }

    if (acc.status === "APPROVED") {
      return {
        success: false as const,
        error: "La actividad ya fue aprobada. No es posible cargar nuevos archivos.",
      };
    }

    if (!allowedAccidentalidadMimeTypes.includes(fileType as any)) {
      return {
        success: false as const,
        error: "Tipo de archivo no permitido. Use PDF, DOC, DOCX, XLS o XLSX.",
      };
    }
    if (fileSize > maxAccidentalidadFileSizeBytes) {
      return { success: false as const, error: "El archivo supera 20MB." };
    }

    const extMatch = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
    const storedName = `${randomUUID()}${extMatch}`;
    const key = `accidentalidad/${accidentalidadId}/${storedName}`;

    const uploadUrl = await getPresignedUploadUrl(key, fileType);

    return {
      success: true as const,
      uploadUrl,
      key,
      originalName: fileName,
    };
  } catch (error) {
    console.error("Failed to create accidentalidad upload request:", error);
    return { success: false as const, error: "Error al preparar la subida del documento" };
  }
}

export async function finalizeAccidentalidadUpload(formData: FormData) {
  try {
    const accidentalidadId = formData.get("accidentalidadId") as string;
    const originalName = formData.get("originalName") as string;
    const key = formData.get("key") as string;
    const fileSizeStr = (formData.get("fileSize") as string | null) || null;
    const dueDateStr = (formData.get("dueDate") as string | null) || null;

    if (!accidentalidadId || !originalName || !key) {
      return { success: false as const, error: "Datos incompletos para registrar el documento" };
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) return { success: false as const, error: "No autenticado." };

    const acc = await getAccidentalidadWithProject(accidentalidadId);
    if (!acc) return { success: false as const, error: "Registro no encontrado." };

    const access = isUserAllowedForProject({
      userRole: currentUser.role,
      userId: currentUser.id,
      project: acc.project,
    });
    if (!access.canView) return { success: false as const, error: "No autorizado." };

    const canEdit = access.isAdmin || access.isConsultant;
    if (!canEdit) {
      return { success: false as const, error: "No tiene permisos para cargar archivos." };
    }

    let dueDate: Date | null = null;
    if (dueDateStr) {
      const parsedDue = parseDateOnly(dueDateStr.trim());
      if (!parsedDue) {
        return { success: false as const, error: "Fecha del accidente inválida." };
      }
      dueDate = parsedDue;
    }

    const sizeBytes = fileSizeStr ? parseInt(fileSizeStr, 10) || null : null;
    const publicUrl = getPublicUrl(key);

    const shouldNotifyAdmins = acc.status !== "IN_REVIEW" && currentUser.role !== "ADMIN_PMD";
    const created = await prisma.$transaction(async (tx) => {
      const lastDoc = await tx.archivoAccidentalidad.findFirst({
        where: { accidentalidadId, deletedAt: null },
        orderBy: { uploadedAt: "desc" },
      });
      const nextVersion = (lastDoc?.version ?? 0) + 1;

      const file = await tx.archivoAccidentalidad.create({
        data: {
          accidentalidadId,
          name: originalName,
          url: publicUrl,
          version: nextVersion,
          sizeBytes: sizeBytes ?? undefined,
          uploadedByUserId: currentUser.id,
        },
      });

      const updateData: any = { status: "IN_REVIEW" };
      if (dueDate) {
        updateData.dueDate = dueDate;
      }

      await tx.accidentalidadEmpresa.update({
        where: { id: accidentalidadId },
        data: updateData,
      });

      if (acc.status !== "IN_REVIEW") {
        await tx.historialAccidentalidad.create({
          data: {
            accidentalidadId,
            field: "status",
            oldValue: acc.status,
            newValue: "IN_REVIEW",
            changedByUserId: currentUser.id,
          },
        });
      }

      await tx.historialAccidentalidad.create({
        data: {
          accidentalidadId,
          field: "archivo_upload",
          oldValue: null,
          newValue: `${originalName} (v${nextVersion})`,
          changedByUserId: currentUser.id,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "UPLOAD",
          entity: "ACCIDENTALIDAD_ARCHIVO",
          entityId: accidentalidadId,
          details: `Archivo cargado: ${originalName} (v${nextVersion})`,
          performedBy: currentUser.id,
        },
      });

      return file;
    });

    if (shouldNotifyAdmins) {
      try {
        const admins = await prisma.user.findMany({ where: { role: "ADMIN_PMD" } });
        for (const admin of admins) {
          await createNotification(prisma, {
            recipientId: admin.id,
            title: "Actividad en Revisión",
            message: `[ACC:${acc.id}] La actividad "${acc.actividad}" de ${acc.project.name} ha cambiado a estado de revisión.`,
            type: "ACTIVITY_REVIEW",
            priority: "HIGH",
            category: "OPERATIONAL",
            functionalArea: "SST",
          });
        }
      } catch (notifyError) {
        console.error("Failed to send accidentalidad IN_REVIEW notifications:", notifyError);
      }
    }

    revalidatePath(`/projects/${acc.projectId}`);
    revalidatePath("/activities");
    revalidatePath("/overview");
    return {
      success: true as const,
      url: publicUrl,
      file: {
        id: created.id,
        name: created.name,
        url: created.url,
        uploadedAt: created.uploadedAt.toISOString(),
        version: created.version,
        sizeBytes: created.sizeBytes ?? null,
      },
    };
  } catch (error) {
    console.error("Failed to finalize accidentalidad upload:", error);
    return { success: false as const, error: "Error al registrar el documento" };
  }
}

export async function removeAccidentalidadFile(formData: FormData) {
  try {
    const fileId = formData.get("fileId") as string;
    if (!fileId) return { success: false as const, error: "Archivo requerido." };

    const user = await getCurrentUser();
    if (!user || !canEditAccidentalidad(user.role)) {
      return { success: false as const, error: "No autorizado." };
    }

    const file = await prisma.archivoAccidentalidad.findUnique({
      where: { id: fileId },
      include: { accidentalidad: { include: { project: true } } },
    });
    if (!file) return { success: false as const, error: "Archivo no encontrado." };

    const access = isUserAllowedForProject({
      userRole: user.role,
      userId: user.id,
      project: file.accidentalidad.project,
    });
    if (!access.isAdmin && !access.isConsultant) return { success: false as const, error: "No autorizado." };

    const result = await prisma.$transaction(async (tx) => {
      await tx.archivoAccidentalidad.update({
        where: { id: fileId },
        data: { deletedAt: new Date() },
      });
      await tx.historialAccidentalidad.create({
        data: {
          accidentalidadId: file.accidentalidadId,
          field: "archivo_delete",
          oldValue: file.name,
          newValue: "DELETED (Soft)",
          changedByUserId: user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "DELETE",
          entity: "ACCIDENTALIDAD_ARCHIVO",
          entityId: fileId,
          details: `Archivo eliminado: ${file.name}`,
          performedBy: user.id,
        },
      });

      const remaining = await tx.archivoAccidentalidad.count({
        where: { accidentalidadId: file.accidentalidadId, deletedAt: null },
      });
      if (remaining === 0) {
        const accRow = await tx.accidentalidadEmpresa.findUnique({
          where: { id: file.accidentalidadId },
          select: { status: true },
        });
        await tx.accidentalidadEmpresa.update({
          where: { id: file.accidentalidadId },
          data: { status: "PENDING" },
        });
        if (accRow?.status && accRow.status !== "PENDING") {
          await tx.historialAccidentalidad.create({
            data: {
              accidentalidadId: file.accidentalidadId,
              field: "status",
              oldValue: accRow.status,
              newValue: "PENDING",
              changedByUserId: user.id,
            },
          });
        }
      }

      return { remaining };
    });

    revalidatePath(`/projects/${file.accidentalidad.projectId}`);
    return { success: true as const, remaining: result.remaining, accidentalidadId: file.accidentalidadId };
  } catch (error) {
    console.error("Failed to remove accidentalidad file:", error);
    return { success: false as const, error: "Error al eliminar el archivo" };
  }
}
