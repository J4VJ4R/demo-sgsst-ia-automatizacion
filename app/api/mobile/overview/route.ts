import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { computeAiRiskSummary } from "@/lib/aiRiskEngine";
import { isAdminRole, requireMobileUser } from "@/lib/mobile-api";

export async function GET(req: Request) {
  const auth = await requireMobileUser(req);
  if (!auth.ok) return auth.response;

  const user = auth.user;
  const projectWhere =
    isAdminRole(user.role)
      ? {}
      : user.role === "CONSULTANT"
        ? { consultantId: user.id }
        : user.role === "CLIENT" || user.role === "CLIENT_VIEWER"
          ? { clientUserId: user.id }
          : { id: "__none__" };

  const projects = await prisma.project.findMany({
    where: projectWhere,
    select: {
      id: true,
      name: true,
      department: true,
      municipality: true,
      activities: {
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          inspectionEquipmentId: true,
          replies: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { message: true },
          },
        },
      },
      _count: {
        select: {
          activities: true,
          collaborators: true,
        },
      },
    },
  });

  const allActivities = projects.flatMap((project) =>
    project.activities.map((activity) => ({
      projectId: project.id,
      projectName: project.name,
      department: project.department,
      municipality: project.municipality,
      activityId: activity.id,
      activityTitle: activity.title,
      latestReplyMessage: activity.replies[0]?.message || null,
      inspectionEquipmentId: activity.inspectionEquipmentId,
      status: activity.status,
      dueDate: activity.dueDate,
    }))
  );

  const counts = allActivities.reduce(
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

  const aiSummary = computeAiRiskSummary(
    allActivities.map((activity) => ({
      activityId: activity.activityId,
      activityTitle: activity.activityTitle,
      projectId: activity.projectId,
      projectName: activity.projectName,
      department: activity.department,
      municipality: activity.municipality,
      inspectionEquipmentId: activity.inspectionEquipmentId,
      latestReplyMessage: activity.latestReplyMessage,
    })),
    { trained: true, onlyElectricalInspections: true }
  );

  return NextResponse.json({
    success: true,
    summary: {
      projects: projects.length,
      collaborators: projects.reduce((acc, project) => acc + project._count.collaborators, 0),
      activities: counts,
    },
    predictiveInsights: aiSummary,
  });
}
