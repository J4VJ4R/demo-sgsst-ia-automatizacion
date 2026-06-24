import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getPublicUrl } from "@/lib/s3";
import { requireMobileUser } from "@/lib/mobile-api";

type ReplyFileInput = {
  originalName?: string;
  key?: string;
  fileSize?: number | null;
};

export async function POST(req: Request, ctx: { params: Promise<{ activityId: string }> }) {
  const auth = await requireMobileUser(req);
  if (!auth.ok) return auth.response;

  const user = auth.user;
  const { activityId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    replyMessage?: string;
    dueDate?: string | null;
    files?: ReplyFileInput[];
  } | null;

  const replyMessage = (body?.replyMessage || "").trim();
  const dueDate = typeof body?.dueDate === "string" && body.dueDate.trim() ? new Date(body.dueDate) : null;
  const files = (Array.isArray(body?.files) ? body?.files : [])
    .map((file) => ({
      originalName: (file?.originalName || "").trim(),
      key: (file?.key || "").trim(),
      fileSize: typeof file?.fileSize === "number" ? file.fileSize : null,
    }))
    .filter((file) => file.originalName && file.key);

  if (!replyMessage) {
    return NextResponse.json({ success: false, error: "replyMessage es requerido." }, { status: 400 });
  }

  if (files.length === 0) {
    return NextResponse.json({ success: false, error: "Debes adjuntar al menos un archivo." }, { status: 400 });
  }

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          consultantId: true,
        },
      },
    },
  });

  if (!activity) {
    return NextResponse.json({ success: false, error: "Actividad no encontrada." }, { status: 404 });
  }

  if (user.role !== "CONSULTANT" || activity.project.consultantId !== user.id) {
    return NextResponse.json({ success: false, error: "Solo el consultor asignado puede responder esta actividad." }, { status: 403 });
  }

  if (activity.status === "APPROVED") {
    return NextResponse.json({ success: false, error: "No se puede responder una actividad aprobada." }, { status: 400 });
  }

  if (activity.status !== "REJECTED" || !activity.rejectionReason) {
    return NextResponse.json({ success: false, error: "La actividad no tiene una devolucion pendiente." }, { status: 400 });
  }

  try {
    const adminMessageSnapshot = activity.rejectionReason;

    const createdDocs = await prisma.$transaction(async (tx) => {
      const lastDoc = await tx.document.findFirst({
        where: { activityId },
        orderBy: { uploadedAt: "desc" },
      });

      let previousName: string | null = lastDoc?.name ?? null;
      let nextVersion = (lastDoc?.version ?? 0) + 1;
      const docs: { id: string; name: string }[] = [];

      for (const file of files) {
        const newDoc = await tx.document.create({
          data: {
            name: file.originalName,
            url: getPublicUrl(file.key),
            activityId,
            version: nextVersion,
            sizeBytes: file.fileSize ?? undefined,
            uploadedByUserId: user.id,
          },
        });

        docs.push({ id: newDoc.id, name: newDoc.name });

        await tx.activityHistory.create({
          data: {
            activityId,
            field: previousName ? "document_replace" : "document_upload",
            oldValue: previousName,
            newValue: newDoc.name,
            changedByUserId: user.id,
          },
        });

        previousName = newDoc.name;
        nextVersion += 1;
      }

      await tx.activity.update({
        where: { id: activityId },
        data: {
          status: "IN_REVIEW",
          returnedAt: null,
          returnedNote: null,
          rejectionReason: null,
          ...(dueDate && !Number.isNaN(dueDate.getTime()) ? { dueDate } : {}),
        },
      });

      return docs;
    });

    for (const doc of createdDocs) {
      await prisma.activityReply.create({
        data: {
          activityId,
          documentId: doc.id,
          adminMessage: adminMessageSnapshot,
          message: replyMessage,
          createdByUserId: user.id,
          isRead: false,
        },
      });
    }

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN_PMD", deletedAt: null },
      select: { id: true },
    });

    await Promise.all(
      admins.map((admin) =>
        prisma.notification.create({
          data: {
            recipientId: admin.id,
            title: "Respuesta a devolucion",
            message: `El consultor respondio a la actividad "${activity.title}" de ${activity.project.name}.`,
            type: "ACTIVITY_REPLY",
            priority: "HIGH",
            activityId: activity.id,
            category: "OPERATIONAL",
            functionalArea: "SST",
          },
        })
      )
    );

    await prisma.activityHistory.create({
      data: {
        activityId,
        field: "consultant_reply",
        oldValue: adminMessageSnapshot,
        newValue: replyMessage,
        changedByUserId: user.id,
      },
    });

    return NextResponse.json({
      success: true,
      createdDocuments: createdDocs.length,
      message: "Respuesta registrada correctamente.",
    });
  } catch (error) {
    console.error("Mobile activity reply error:", error);
    return NextResponse.json({ success: false, error: "No se pudo registrar la respuesta." }, { status: 500 });
  }
}
