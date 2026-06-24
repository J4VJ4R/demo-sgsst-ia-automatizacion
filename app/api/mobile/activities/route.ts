import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { canSeeProject, isAdminRole, requireMobileUser } from "@/lib/mobile-api";

export async function GET(req: Request) {
  const auth = await requireMobileUser(req);
  if (!auth.ok) return auth.response;

  const user = auth.user;
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId") || "";
  const status = (url.searchParams.get("status") || "").trim().toUpperCase();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 20), 1), 100);

  const projectWhere =
    isAdminRole(user.role)
      ? {}
      : user.role === "CONSULTANT"
        ? { consultantId: user.id }
        : user.role === "CLIENT" || user.role === "CLIENT_VIEWER"
          ? { clientUserId: user.id }
          : { id: "__none__" };

  const allowedProjects = await prisma.project.findMany({
    where: projectId ? { ...projectWhere, id: projectId } : projectWhere,
    select: { id: true, consultantId: true, clientUserId: true },
  });

  if (projectId && allowedProjects.length === 0) {
    return NextResponse.json({ success: false, error: "Empresa no encontrada o sin acceso." }, { status: 404 });
  }

  const allowedProjectIds = allowedProjects
    .filter((project) => canSeeProject(user, project))
    .map((project) => project.id);

  if (allowedProjectIds.length === 0) {
    return NextResponse.json({ success: true, items: [] });
  }

  const activities = await prisma.activity.findMany({
    where: {
      projectId: { in: allowedProjectIds },
      ...(status ? { status } : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      updatedAt: true,
      rejectionReason: true,
      project: {
        select: {
          id: true,
          name: true,
          clientName: true,
        },
      },
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      documents: {
        where: { deletedAt: null },
        orderBy: { uploadedAt: "desc" },
        take: 1,
        select: { id: true, name: true, url: true, uploadedAt: true },
      },
      replies: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          message: true,
          createdAt: true,
          createdByUser: { select: { id: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json({
    success: true,
    items: activities.map((activity) => ({
      id: activity.id,
      title: activity.title,
      status: activity.status,
      priority: activity.priority,
      dueDate: activity.dueDate?.toISOString() || null,
      updatedAt: activity.updatedAt.toISOString(),
      rejectionReason: activity.rejectionReason,
      project: activity.project,
      assignedTo: activity.assignedTo,
      latestDocument: activity.documents[0]
        ? {
            ...activity.documents[0],
            uploadedAt: activity.documents[0].uploadedAt.toISOString(),
          }
        : null,
      latestReply: activity.replies[0]
        ? {
            id: activity.replies[0].id,
            message: activity.replies[0].message,
            createdAt: activity.replies[0].createdAt.toISOString(),
            createdByUser: activity.replies[0].createdByUser,
          }
        : null,
    })),
  });
}
