import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-api";

export async function POST(_req: Request, ctx: { params: Promise<{ notificationId: string }> }) {
  const auth = await requireMobileUser(_req);
  if (!auth.ok) return auth.response;

  const user = auth.user;
  const { notificationId } = await ctx.params;

  try {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: { id: true, recipientId: true, isRead: true },
    });

    if (!notification || notification.recipientId !== user.id) {
      return NextResponse.json({ success: false, error: "Notificacion no encontrada." }, { status: 404 });
    }

    if (!notification.isRead) {
      await prisma.$transaction(async (tx) => {
        await tx.notification.update({
          where: { id: notificationId },
          data: { isRead: true },
        });
        await tx.notificationAudit.create({
          data: {
            notificationId,
            userId: user.id,
            action: "READ",
            metadata: JSON.stringify({ source: "mobile-api", timestamp: new Date().toISOString() }),
          },
        });
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mobile notification read error:", error);
    return NextResponse.json({ success: false, error: "No se pudo actualizar la notificacion." }, { status: 500 });
  }
}
