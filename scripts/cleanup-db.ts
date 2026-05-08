import prisma from "@/lib/prisma";

type KeepPlan = {
  keepProjectId: string;
  keepProjectName: string;
  keepUserIds: string[];
  keepAdminIds: string[];
  otherProjectIds: string[];
};

async function buildPlan(): Promise<KeepPlan> {
  const keepProjectIdFromEnv = process.env.KEEP_PROJECT_ID?.trim();

  const keepProject = keepProjectIdFromEnv
    ? await prisma.project.findUnique({
        where: { id: keepProjectIdFromEnv },
        select: { id: true, name: true, consultantId: true, clientUserId: true, startDate: true },
      })
    : await prisma.project.findFirst({
        orderBy: { startDate: "desc" },
        select: { id: true, name: true, consultantId: true, clientUserId: true, startDate: true },
      });

  if (!keepProject) {
    throw new Error("No se encontró ninguna empresa para conservar.");
  }

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN_PMD", deletedAt: null },
    select: { id: true },
  });
  const keepAdminIds = admins.map((a) => a.id);

  const keepUserIds = new Set<string>(keepAdminIds);
  if (keepProject.clientUserId) keepUserIds.add(keepProject.clientUserId);
  if (keepProject.consultantId) keepUserIds.add(keepProject.consultantId);

  const [activityUsers, accidentalidadUsers, sgsstUsers, inspectionUsers] = await Promise.all([
    prisma.activity.findMany({
      where: { projectId: keepProject.id },
      select: {
        assignedToId: true,
        documents: { select: { uploadedByUserId: true } },
        history: { select: { changedByUserId: true } },
      },
    }),
    prisma.accidentalidadEmpresa.findMany({
      where: { projectId: keepProject.id },
      select: {
        assignedToId: true,
        archivos: { select: { uploadedByUserId: true } },
        historial: { select: { changedByUserId: true } },
      },
    }),
    prisma.sgSstDesignSection.findMany({
      where: { projectId: keepProject.id },
      select: { files: { select: { uploadedByUserId: true } } },
    }),
    prisma.inspectionEquipment.findMany({
      where: { projectId: keepProject.id },
      select: { photos: { select: { uploadedByUserId: true } } },
    }),
  ]);

  for (const a of activityUsers) {
    if (a.assignedToId) keepUserIds.add(a.assignedToId);
    for (const d of a.documents) if (d.uploadedByUserId) keepUserIds.add(d.uploadedByUserId);
    for (const h of a.history) if (h.changedByUserId) keepUserIds.add(h.changedByUserId);
  }

  for (const a of accidentalidadUsers) {
    if (a.assignedToId) keepUserIds.add(a.assignedToId);
    for (const d of a.archivos) if (d.uploadedByUserId) keepUserIds.add(d.uploadedByUserId);
    for (const h of a.historial) if (h.changedByUserId) keepUserIds.add(h.changedByUserId);
  }

  for (const s of sgsstUsers) {
    for (const f of s.files) if (f.uploadedByUserId) keepUserIds.add(f.uploadedByUserId);
  }

  for (const e of inspectionUsers) {
    for (const p of e.photos) if (p.uploadedByUserId) keepUserIds.add(p.uploadedByUserId);
  }

  const otherProjects = await prisma.project.findMany({
    where: { id: { not: keepProject.id } },
    select: { id: true },
  });

  return {
    keepProjectId: keepProject.id,
    keepProjectName: keepProject.name,
    keepUserIds: Array.from(keepUserIds),
    keepAdminIds,
    otherProjectIds: otherProjects.map((p) => p.id),
  };
}

async function main() {
  const plan = await buildPlan();

  console.log("Plan de limpieza (mantener):");
  console.log(`- Empresa: ${plan.keepProjectName} (${plan.keepProjectId})`);
  console.log(`- Admins: ${plan.keepAdminIds.length}`);
  console.log(`- Usuarios relacionados a conservar: ${plan.keepUserIds.length}`);
  console.log(`- Empresas a eliminar: ${plan.otherProjectIds.length}`);

  const startedAt = Date.now();
  const now = new Date();

  const otherProjectIds = plan.otherProjectIds;
  if (otherProjectIds.length > 0) {
    const [otherActivities, otherAccidentalidad, otherSgsstSections, otherEquipments] = await Promise.all([
      prisma.activity.findMany({
        where: { projectId: { in: otherProjectIds } },
        select: { id: true },
      }),
      prisma.accidentalidadEmpresa.findMany({
        where: { projectId: { in: otherProjectIds } },
        select: { id: true },
      }),
      prisma.sgSstDesignSection.findMany({
        where: { projectId: { in: otherProjectIds } },
        select: { id: true },
      }),
      prisma.inspectionEquipment.findMany({
        where: { projectId: { in: otherProjectIds } },
        select: { id: true },
      }),
    ]);

    const otherActivityIds = otherActivities.map((a) => a.id);
    const otherAccidentalidadIds = otherAccidentalidad.map((a) => a.id);
    const otherSgsstSectionIds = otherSgsstSections.map((s) => s.id);
    const otherEquipmentIds = otherEquipments.map((e) => e.id);

    const otherNotificationIds = otherActivityIds.length
      ? (
          await prisma.notification.findMany({
            where: { activityId: { in: otherActivityIds } },
            select: { id: true },
          })
        ).map((n) => n.id)
      : [];

    await prisma.$transaction(async (tx) => {
      if (otherNotificationIds.length) {
        await tx.notificationAudit.deleteMany({ where: { notificationId: { in: otherNotificationIds } } });
      }
      if (otherActivityIds.length) {
        await tx.notification.deleteMany({ where: { activityId: { in: otherActivityIds } } });
        await tx.activityHistory.deleteMany({ where: { activityId: { in: otherActivityIds } } });
        await tx.document.deleteMany({ where: { activityId: { in: otherActivityIds } } });
        await tx.activity.deleteMany({ where: { id: { in: otherActivityIds } } });
      }

      if (otherAccidentalidadIds.length) {
        await tx.historialAccidentalidad.deleteMany({ where: { accidentalidadId: { in: otherAccidentalidadIds } } });
        await tx.archivoAccidentalidad.deleteMany({ where: { accidentalidadId: { in: otherAccidentalidadIds } } });
        await tx.accidentalidadEmpresa.deleteMany({ where: { id: { in: otherAccidentalidadIds } } });
      }

      if (otherSgsstSectionIds.length) {
        await tx.sgSstDesignFile.deleteMany({ where: { sectionId: { in: otherSgsstSectionIds } } });
        await tx.sgSstDesignSection.deleteMany({ where: { id: { in: otherSgsstSectionIds } } });
      }

      if (otherEquipmentIds.length) {
        await tx.inspectionEquipmentPhoto.deleteMany({ where: { equipmentId: { in: otherEquipmentIds } } });
        await tx.inspectionEquipment.deleteMany({ where: { id: { in: otherEquipmentIds } } });
      }

      await tx.collaborator.deleteMany({ where: { projectId: { in: otherProjectIds } } });
      await tx.project.deleteMany({ where: { id: { in: otherProjectIds } } });
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.notificationAudit.deleteMany({
      where: {
        OR: [
          { userId: { notIn: plan.keepUserIds } },
          { notification: { is: { recipientId: { notIn: plan.keepUserIds } } } },
        ],
      },
    });

    await tx.notification.deleteMany({
      where: {
        recipientId: { notIn: plan.keepUserIds },
      },
    });

    await tx.user.updateMany({
      where: {
        id: { notIn: plan.keepUserIds },
        role: { not: "ADMIN_PMD" },
        deletedAt: null,
      },
      data: { deletedAt: now },
    });

    await tx.auditLog.deleteMany({
      where: {
        OR: [
          { details: { contains: "\"projectId\"" } },
          { entity: { in: ["Project", "Activity", "Collaborator", "AccidentalidadEmpresa", "InspectionEquipment"] } },
        ],
      },
    });
  });

  const remaining = await prisma.project.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  console.log("Empresas restantes:");
  for (const p of remaining) {
    console.log(`- ${p.name} (${p.id})`);
  }

  console.log(`Limpieza completada en ${(Date.now() - startedAt) / 1000}s`);
}

main()
  .catch((e) => {
    console.error("Error en cleanup-db:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

