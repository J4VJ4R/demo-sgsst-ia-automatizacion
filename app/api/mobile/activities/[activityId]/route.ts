import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { canSeeProject, requireMobileUser } from "@/lib/mobile-api";

export async function GET(_req: Request, ctx: { params: Promise<{ activityId: string }> }) {
  const auth = await requireMobileUser(_req);
  if (!auth.ok) return auth.response;

  const user = auth.user;
  const { activityId } = await ctx.params;

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      updatedAt: true,
      rejectionReason: true,
      returnedNote: true,
      returnedAt: true,
      periodicity: true,
      collaboratorId: true,
      inspectionEquipmentId: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      project: {
        select: {
          id: true,
          name: true,
          clientName: true,
          consultantId: true,
          clientUserId: true,
        },
      },
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
          uploadedByUser: { select: { id: true, name: true, role: true } },
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
          readAt: true,
          createdByUser: { select: { id: true, name: true, role: true } },
          document: { select: { id: true, name: true, url: true, version: true } },
        },
      },
      history: {
        orderBy: { changedAt: "desc" },
        take: 20,
        select: {
          id: true,
          field: true,
          oldValue: true,
          newValue: true,
          changedAt: true,
          changedBy: { select: { id: true, name: true, role: true } },
        },
      },
    },
  });

  if (!activity) {
    return NextResponse.json({ success: false, error: "Actividad no encontrada." }, { status: 404 });
  }

  if (!canSeeProject(user, activity.project)) {
    return NextResponse.json({ success: false, error: "No autorizado." }, { status: 403 });
  }

  return NextResponse.json({
    success: true,
    item: {
      id: activity.id,
      title: activity.title,
      status: activity.status,
      priority: activity.priority,
      dueDate: activity.dueDate?.toISOString() || null,
      updatedAt: activity.updatedAt.toISOString(),
      rejectionReason: activity.rejectionReason,
      returnedNote: activity.returnedNote,
      returnedAt: activity.returnedAt?.toISOString() || null,
      periodicity: activity.periodicity,
      collaboratorId: activity.collaboratorId,
      inspectionEquipmentId: activity.inspectionEquipmentId,
      assignedTo: activity.assignedTo,
      project: activity.project,
      documents: activity.documents.map((document) => ({
        ...document,
        uploadedAt: document.uploadedAt.toISOString(),
      })),
      replies: activity.replies.map((reply) => ({
        ...reply,
        createdAt: reply.createdAt.toISOString(),
        readAt: reply.readAt?.toISOString() || null,
      })),
      history: activity.history.map((entry) => ({
        ...entry,
        changedAt: entry.changedAt.toISOString(),
      })),
    },
  });
}
