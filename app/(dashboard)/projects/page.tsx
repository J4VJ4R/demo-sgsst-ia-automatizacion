import prisma from "@/lib/prisma";
import { ProjectsPageClient } from "@/components/projects/projects-page-client";
import { getCurrentUser } from "@/app/auth-actions";
import { redirect } from "next/navigation";

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login");
  }

  const userRole = user.role || "CLIENT_VIEWER";
  const userId = user.id;

  let projectWhere: any = { id: "none" }; // Default safe fallback

  if (userRole === "ADMIN_PMD") {
    projectWhere = {};
  } else if (userRole === "CONSULTANT" && userId) {
    projectWhere = { consultantId: userId };
  } else if (userRole === "CLIENT_VIEWER" && userId) {
    projectWhere = { clientUserId: userId };
  }

  const [projects, consultants] = await Promise.all([
    prisma.project.findMany({
      where: projectWhere,
      orderBy: {
        startDate: "desc",
      },
      include: {
        consultant: true,
      },
    }),
    prisma.user.findMany({
      where: { role: "CONSULTANT", deletedAt: null },
      orderBy: { name: "asc" },
    }),
  ]);

  const projectsForClient = projects.map((project) => ({
    id: project.id,
    name: project.name,
    clientName: project.clientName,
    startDate: project.startDate.toISOString(),
    status: project.status,
    nit: project.nit,
    address: project.address,
    department: project.department,
    municipality: project.municipality,
    economicActivity: project.economicActivity,
    ciiu: project.ciiu,
    phone: project.phone,
    workerCount: project.workerCount,
    logoUrl: project.logoUrl,
    contractStartDate: project.contractStartDate?.toISOString() || null,
    contractNumber: project.contractNumber ?? null,
    riskLevel: project.riskLevel,
    chapter: project.chapter,
    consultantName: project.consultant?.name || null,
    consultantId: project.consultantId || null,
  }));

  const canEdit = userRole === "ADMIN_PMD";
  const canCreate = userRole === "ADMIN_PMD";
  const canDelete = userRole === "ADMIN_PMD";
  const canExportData = userRole === "ADMIN_PMD";

  return (
    <ProjectsPageClient
      projects={projectsForClient}
      consultants={consultants}
      canEdit={canEdit}
      canCreate={canCreate}
      canDelete={canDelete}
      canExportData={canExportData}
    />
  );
}
