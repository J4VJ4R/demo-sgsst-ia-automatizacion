"use server";

import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import {
  getCollaboratorDocumentStatus,
  ActivityWithDocumentsAndDueDate,
} from "@/lib/collaborator-status";
import { getCurrentUser } from "@/app/auth-actions";
import { publishDriversEvent } from "@/lib/realtime/drivers-bus";

function buildFullName(args: {
  firstName: string;
  secondName?: string | null;
  firstSurname: string;
  secondSurname?: string | null;
}) {
  return [args.firstName, args.secondName, args.firstSurname, args.secondSurname].filter(Boolean).join(" ").trim();
}

function isMissingDriverInspectionTables(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  return lower.includes("42p01") && lower.includes("driver_inspection_driver");
}

async function ensureDriverInspectionDriverFromCollaborator(args: {
  projectId: string;
  documentType: string;
  documentNumber: string;
  fullName: string;
  position: string;
  oldDocumentNumber?: string | null;
}) {
  const now = new Date();
  const oldDoc = args.oldDocumentNumber?.trim() || null;

  if (oldDoc && oldDoc !== args.documentNumber) {
    await prisma.$executeRaw(
      Prisma.sql`
        UPDATE driver_inspection_driver
        SET
          fullname = ${args.fullName},
          documenttype = ${args.documentType},
          documentnumber = ${args.documentNumber},
          position = ${args.position},
          updatedat = ${now}
        WHERE projectid = ${args.projectId}
          AND documentnumber = ${oldDoc}
      `
    );
  }

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
        ${args.fullName},
        ${args.documentType},
        ${args.documentNumber},
        ${args.position},
        ${now},
        ${now}
      WHERE NOT EXISTS (
        SELECT 1
        FROM driver_inspection_driver d
        WHERE d.projectid = ${args.projectId}
          AND d.documentnumber = ${args.documentNumber}
      )
    `
  );

  publishDriversEvent({ type: "drivers_inspection_changed", payload: { projectId: args.projectId, ts: Date.now() } });
}

async function deleteDriverInspectionDriverForCollaborator(args: {
  projectId: string;
  documentNumber: string;
  oldDocumentNumber?: string | null;
}) {
  const oldDoc = args.oldDocumentNumber?.trim() || null;
  if (oldDoc && oldDoc !== args.documentNumber) {
    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM driver_inspection_driver WHERE projectid = ${args.projectId} AND documentnumber IN (${args.documentNumber}, ${oldDoc})`
    );
  } else {
    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM driver_inspection_driver WHERE projectid = ${args.projectId} AND documentnumber = ${args.documentNumber}`
    );
  }

  publishDriversEvent({ type: "drivers_inspection_changed", payload: { projectId: args.projectId, ts: Date.now() } });
}

export async function createCollaborator(formData: FormData) {
  try {
    const projectId = formData.get("projectId") as string;
    const documentType = formData.get("documentType") as string;
    const documentNumber = (formData.get("documentNumber") as string)?.trim();
    const firstName = (formData.get("firstName") as string)?.trim();
    const secondName = (formData.get("secondName") as string)?.trim() || null;
    const firstSurname = (formData.get("firstSurname") as string)?.trim();
    const secondSurname = (formData.get("secondSurname") as string)?.trim() || null;
    const startDateStr = formData.get("startDate") as string;
    const contractType = formData.get("contractType") as string;
    const position = (formData.get("position") as string)?.trim();
    const driverRoleRaw = (formData.get("driverRole") as string | null)?.trim() || "";
    const driverRole = driverRoleRaw && driverRoleRaw !== "none" ? driverRoleRaw : null;
    const email = (formData.get("email") as string)?.trim();
    const phone = (formData.get("phone") as string)?.trim();
    const address = (formData.get("address") as string)?.trim();
    const rh = (formData.get("rh") as string)?.trim();
    const eps = (formData.get("eps") as string)?.trim();
    const arl = (formData.get("arl") as string)?.trim();
    const afp = (formData.get("afp") as string)?.trim();
    const emergencyContactName = (formData.get("emergencyContactName") as string)?.trim();
    const emergencyContactPhone = (formData.get("emergencyContactPhone") as string)?.trim();
    const status = formData.get("status") as string || "ACTIVE";

    if (
      !projectId ||
      !documentType ||
      !documentNumber ||
      !firstName ||
      !firstSurname ||
      !startDateStr ||
      !contractType ||
      !position ||
      !email ||
      !phone ||
      !address ||
      !rh ||
      !eps ||
      !arl ||
      !afp ||
      !emergencyContactName ||
      !emergencyContactPhone
    ) {
      return { success: false, error: "Todos los campos obligatorios deben ser completados." };
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
      return {
        success: false,
        error: "No tiene permisos para gestionar colaboradores de esta empresa.",
      };
    }

    const existing = await prisma.collaborator.findFirst({
      where: {
        documentNumber,
        projectId
      }
    });

    if (existing) {
      return { success: false, error: `El colaborador con documento ${documentNumber} ya existe en esta empresa.` };
    }

    const startDate = new Date(startDateStr);
    if (isNaN(startDate.getTime())) {
      return { success: false, error: "Fecha de ingreso inválida." };
    }

    const created = await prisma.collaborator.create({
      data: {
        projectId,
        documentType,
        documentNumber,
        firstName,
        secondName,
        firstSurname,
        secondSurname,
        startDate,
        contractType,
        position,
        driverRole,
        email,
        phone,
        address,
        rh,
        eps,
        arl,
        afp,
        emergencyContactName,
        emergencyContactPhone,
        status,
      },
    });

    if (created.driverRole === "CONDUCTOR") {
      try {
        await ensureDriverInspectionDriverFromCollaborator({
          projectId,
          documentType,
          documentNumber,
          fullName: buildFullName({ firstName, secondName, firstSurname, secondSurname }),
          position,
        });
      } catch (e) {
        if (!isMissingDriverInspectionTables(e)) throw e;
      }
    }

    revalidatePath(`/projects/${projectId}`);
    return { success: true };
  } catch (error) {
    console.error("Error creating collaborator:", error);
    if (error instanceof Error) {
      return {
        success: false,
        error: `Error al crear el colaborador: ${error.message}`,
      };
    }
    return { success: false, error: "Error al crear el colaborador." };
  }
}

export interface GetCollaboratorsOptions {
  search?: string;
  status?: "ALL" | "ACTIVE" | "INACTIVE" | "RETIRADO";
  page?: number;
  pageSize?: number;
}

export async function getCollaborators(
  projectId: string,
  options?: GetCollaboratorsOptions
) {
  try {
    const pageSize =
      options?.pageSize && options.pageSize > 0
        ? Math.min(options.pageSize, 100)
        : 30;
    const page = options?.page && options.page > 0 ? options.page : 1;
    const skip = (page - 1) * pageSize;
    const search = options?.search?.trim();

    const where: Prisma.CollaboratorWhereInput = {
      projectId,
    };

    if (options?.status && options.status !== "ALL") {
      where.status = options.status;
    }

    if (search) {
      where.OR = [
        {
          documentNumber: {
            contains: search,
          },
        },
        {
          firstName: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          firstSurname: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          secondSurname: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    const [collaborators, total] = await Promise.all([
      prisma.collaborator.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: pageSize,
        include: {
          activities: {
            select: {
              id: true,
              dueDate: true,
              documents: {
                where: { deletedAt: null },
                select: {
                  id: true,
                },
              },
            },
          },
        },
      }),
      prisma.collaborator.count({ where }),
    ]);

    const data = collaborators.map((collaborator) => {
      const activities = collaborator.activities as ActivityWithDocumentsAndDueDate[];
      const documentStatus = getCollaboratorDocumentStatus(activities);

      return {
        id: collaborator.id,
        documentNumber: collaborator.documentNumber,
        firstName: collaborator.firstName,
        secondName: collaborator.secondName,
        firstSurname: collaborator.firstSurname,
        secondSurname: collaborator.secondSurname,
        position: collaborator.position,
        email: collaborator.email,
        status: collaborator.status,
        department: (collaborator as any).department ?? undefined,
        retirementDate:
          (collaborator as any).retirementDate instanceof Date
            ? (collaborator as any).retirementDate.toISOString().slice(0, 10)
            : (collaborator as any).retirementDate ?? undefined,
        retirementReason: (collaborator as any).retirementReason ?? undefined,
        documentStatus,
      };
    });

    return { success: true, data, total, page, pageSize };
  } catch (error) {
    console.error("Error fetching collaborators:", error);
    return { success: false, error: "Error al obtener colaboradores." };
  }
}

export async function checkCollaboratorDocument(projectId: string, documentNumber: string) {
  try {
    const existing = await prisma.collaborator.findFirst({
      where: {
        projectId,
        documentNumber,
      },
    });
    return { exists: !!existing };
  } catch (error) {
    return { exists: false };
  }
}

export async function getCollaborator(id: string) {
  try {
    const collaborator = await prisma.collaborator.findUnique({
      where: { id },
    });

    if (!collaborator) {
      return { success: false, error: "Colaborador no encontrado." };
    }

    const safeCollaborator = {
      id: collaborator.id,
      projectId: collaborator.projectId,
      documentType: collaborator.documentType,
      documentNumber: collaborator.documentNumber,
      firstName: collaborator.firstName,
      secondName: collaborator.secondName,
      firstSurname: collaborator.firstSurname,
      secondSurname: collaborator.secondSurname,
      startDate: collaborator.startDate.toISOString(),
      contractType: collaborator.contractType,
      position: collaborator.position,
      driverRole: collaborator.driverRole,
      email: collaborator.email,
      phone: collaborator.phone,
      address: collaborator.address,
      rh: collaborator.rh,
      eps: collaborator.eps,
      arl: collaborator.arl,
      afp: collaborator.afp,
      emergencyContactName: collaborator.emergencyContactName,
      emergencyContactPhone: collaborator.emergencyContactPhone,
      status: collaborator.status,
    };

    return { success: true, data: safeCollaborator };
  } catch (error) {
    console.error("Error fetching collaborator:", error);
    if (error instanceof Error) {
      return {
        success: false,
        error: `Error al obtener colaborador: ${error.message}`,
      };
    }
    return { success: false, error: "Error al obtener colaborador." };
  }
}

export async function updateCollaborator(formData: FormData) {
  try {
    const id = formData.get("id") as string;
    const projectId = formData.get("projectId") as string;
    const documentType = formData.get("documentType") as string;
    const documentNumber = (formData.get("documentNumber") as string)?.trim();
    const firstName = (formData.get("firstName") as string)?.trim();
    const secondName = (formData.get("secondName") as string)?.trim() || null;
    const firstSurname = (formData.get("firstSurname") as string)?.trim();
    const secondSurname = (formData.get("secondSurname") as string)?.trim() || null;
    const startDateStr = formData.get("startDate") as string;
    const contractType = formData.get("contractType") as string;
    const position = (formData.get("position") as string)?.trim();
    const driverRoleRaw = (formData.get("driverRole") as string | null)?.trim() || "";
    const driverRole = driverRoleRaw && driverRoleRaw !== "none" ? driverRoleRaw : null;
    const email = (formData.get("email") as string)?.trim();
    const phone = (formData.get("phone") as string)?.trim();
    const address = (formData.get("address") as string)?.trim();
    const rh = (formData.get("rh") as string)?.trim();
    const eps = (formData.get("eps") as string)?.trim();
    const arl = (formData.get("arl") as string)?.trim();
    const afp = (formData.get("afp") as string)?.trim();
    const emergencyContactName = (formData.get("emergencyContactName") as string)?.trim();
    const emergencyContactPhone = (formData.get("emergencyContactPhone") as string)?.trim();
    const status = (formData.get("status") as string) || "ACTIVE";

    if (
      !id ||
      !projectId ||
      !documentType ||
      !documentNumber ||
      !firstName ||
      !firstSurname ||
      !startDateStr ||
      !contractType ||
      !position ||
      !email ||
      !phone ||
      !address ||
      !rh ||
      !eps ||
      !arl ||
      !afp ||
      !emergencyContactName ||
      !emergencyContactPhone
    ) {
      return {
        success: false,
        error: "Todos los campos obligatorios deben ser completados.",
      };
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "No autenticado." };
    }

    const collaborator = await prisma.collaborator.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!collaborator || collaborator.projectId !== projectId) {
      return {
        success: false,
        error: "Colaborador no encontrado para esta empresa.",
      };
    }

    const userRole = currentUser.role;
    const userId = currentUser.id;

    const isAdmin = userRole === "ADMIN_PMD";
    const isProjectConsultant =
      userRole === "CONSULTANT" && collaborator.project.consultantId === userId;

    if (!isAdmin && !isProjectConsultant) {
      return {
        success: false,
        error: "No tiene permisos para actualizar este colaborador.",
      };
    }

    const duplicate = await prisma.collaborator.findFirst({
      where: {
        projectId,
        documentNumber,
        NOT: { id },
      },
    });

    if (duplicate) {
      return {
        success: false,
        error: `Otro colaborador con documento ${documentNumber} ya existe en esta empresa.`,
      };
    }

    const startDate = new Date(startDateStr);
    if (isNaN(startDate.getTime())) {
      return { success: false, error: "Fecha de ingreso inválida." };
    }

    await prisma.collaborator.update({
      where: { id },
      data: {
        documentType,
        documentNumber,
        firstName,
        secondName,
        firstSurname,
        secondSurname,
        startDate,
        contractType,
        position,
        driverRole,
        email,
        phone,
        address,
        rh,
        eps,
        arl,
        afp,
        emergencyContactName,
        emergencyContactPhone,
        status,
      },
    });

    if (driverRole === "CONDUCTOR") {
      try {
        await ensureDriverInspectionDriverFromCollaborator({
          projectId,
          documentType,
          documentNumber,
          fullName: buildFullName({ firstName, secondName, firstSurname, secondSurname }),
          position,
          oldDocumentNumber: collaborator.documentNumber,
        });
      } catch (e) {
        if (!isMissingDriverInspectionTables(e)) throw e;
      }
    } else if (collaborator.driverRole === "CONDUCTOR") {
      try {
        await deleteDriverInspectionDriverForCollaborator({
          projectId,
          documentNumber,
          oldDocumentNumber: collaborator.documentNumber,
        });
      } catch (e) {
        if (!isMissingDriverInspectionTables(e)) throw e;
      }
    }

    revalidatePath(`/projects/${projectId}`);

    return { success: true };
  } catch (error) {
    console.error("Error updating collaborator:", error);
    if (error instanceof Error) {
      return {
        success: false,
        error: `Error al actualizar el colaborador: ${error.message}`,
      };
    }
    return { success: false, error: "Error al actualizar el colaborador." };
  }
}

export async function deleteCollaborator(id: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "No autenticado." };
    }

    const collaborator = await prisma.collaborator.findUnique({
      where: { id },
      include: {
        project: true,
      },
    });

    if (!collaborator) {
      return { success: false, error: "Colaborador no encontrado." };
    }

    const userRole = currentUser.role;
    const userId = currentUser.id;

    const isAdmin = userRole === "ADMIN_PMD";
    const isProjectConsultant =
      userRole === "CONSULTANT" && collaborator.project.consultantId === userId;

    if (!isAdmin && !isProjectConsultant) {
      return {
        success: false,
        error: "No tiene permisos para eliminar este colaborador.",
      };
    }

    await prisma.collaborator.delete({
      where: { id },
    });

    if (collaborator.driverRole === "CONDUCTOR") {
      try {
        await deleteDriverInspectionDriverForCollaborator({
          projectId: collaborator.projectId,
          documentNumber: collaborator.documentNumber,
        });
      } catch (e) {
        if (!isMissingDriverInspectionTables(e)) throw e;
      }
    }

    revalidatePath(`/projects/${collaborator.projectId}`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting collaborator:", error);
    return { success: false, error: "Error al eliminar el colaborador." };
  }
}
