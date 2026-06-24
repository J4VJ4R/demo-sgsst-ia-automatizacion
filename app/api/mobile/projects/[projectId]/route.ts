import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { canSeeProject, requireMobileUser } from "@/lib/mobile-api";

export async function GET(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const auth = await requireMobileUser(_req);
  if (!auth.ok) return auth.response;

  const user = auth.user;
  const { projectId } = await ctx.params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      clientName: true,
      description: true,
      status: true,
      startDate: true,
      contactEmail: true,
      contactPhone: true,
      economicActivity: true,
      ciiu: true,
      contractStartDate: true,
      contractNumber: true,
      riskLevel: true,
      nit: true,
      address: true,
      department: true,
      municipality: true,
      phone: true,
      workerCount: true,
      logoUrl: true,
      chapter: true,
      consultantId: true,
      clientUserId: true,
      consultant: { select: { id: true, name: true, email: true } },
      clientUser: { select: { id: true, name: true, email: true } },
      sections: {
        select: {
          sectionKey: true,
          enabled: true,
        },
      },
      activities: {
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          updatedAt: true,
        },
      },
      _count: {
        select: {
          activities: true,
          collaborators: true,
          accidentalidad: true,
          learningCourses: true,
        },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ success: false, error: "Empresa no encontrada." }, { status: 404 });
  }

  if (!canSeeProject(user, project)) {
    return NextResponse.json({ success: false, error: "No autorizado." }, { status: 403 });
  }

  const activityStats = project.activities.reduce(
    (acc, activity) => {
      acc.total += 1;
      if (activity.status === "PENDING") acc.pending += 1;
      if (activity.status === "IN_REVIEW") acc.inReview += 1;
      if (activity.status === "REJECTED") acc.rejected += 1;
      if (activity.status === "APPROVED") acc.approved += 1;
      return acc;
    },
    { total: 0, pending: 0, inReview: 0, rejected: 0, approved: 0 }
  );

  return NextResponse.json({
    success: true,
    item: {
      id: project.id,
      name: project.name,
      clientName: project.clientName,
      description: project.description,
      status: project.status,
      startDate: project.startDate.toISOString(),
      contactEmail: project.contactEmail,
      contactPhone: project.contactPhone,
      economicActivity: project.economicActivity,
      ciiu: project.ciiu,
      contractStartDate: project.contractStartDate?.toISOString() || null,
      contractNumber: project.contractNumber,
      riskLevel: project.riskLevel,
      nit: project.nit,
      address: project.address,
      department: project.department,
      municipality: project.municipality,
      phone: project.phone,
      workerCount: project.workerCount,
      logoUrl: project.logoUrl,
      chapter: project.chapter,
      consultant: project.consultant,
      clientUser: project.clientUser,
      sections: project.sections,
      counts: {
        activities: project._count.activities,
        collaborators: project._count.collaborators,
        accidentalidad: project._count.accidentalidad,
        learningCourses: project._count.learningCourses,
      },
      recentActivities: project.activities.map((activity) => ({
        ...activity,
        dueDate: activity.dueDate?.toISOString() || null,
        updatedAt: activity.updatedAt.toISOString(),
      })),
      recentActivityStats: activityStats,
    },
  });
}
