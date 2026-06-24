import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireMobileUser } from "@/lib/mobile-api";

export async function GET(req: Request) {
  const auth = await requireMobileUser(req);
  if (!auth.ok) return auth.response;

  const user = auth.user;
  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unreadOnly") === "true";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 20), 1), 100);

  const items = await prisma.notification.findMany({
    where: {
      recipientId: user.id,
      ...(unreadOnly ? { isRead: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      message: true,
      type: true,
      priority: true,
      category: true,
      functionalArea: true,
      isRead: true,
      createdAt: true,
      activityId: true,
    },
  });

  return NextResponse.json({
    success: true,
    items: items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
  });
}
