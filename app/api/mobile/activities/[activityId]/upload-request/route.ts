import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getPresignedUploadUrl } from "@/lib/s3";
import { canUploadActivityEvidence, requireMobileUser } from "@/lib/mobile-api";

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export async function POST(req: Request, ctx: { params: Promise<{ activityId: string }> }) {
  const auth = await requireMobileUser(req);
  if (!auth.ok) return auth.response;

  const user = auth.user;
  const { activityId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    fileName?: string;
    fileType?: string;
    fileSize?: number;
  } | null;

  const fileName = (body?.fileName || "").trim();
  const fileType = (body?.fileType || "application/octet-stream").trim();
  const fileSize = Number(body?.fileSize || 0);

  if (!fileName) {
    return NextResponse.json({ success: false, error: "fileName es requerido." }, { status: 400 });
  }

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    select: {
      id: true,
      status: true,
      project: {
        select: {
          consultantId: true,
          clientUserId: true,
        },
      },
    },
  });

  if (!activity) {
    return NextResponse.json({ success: false, error: "Actividad no encontrada." }, { status: 404 });
  }

  if (!canUploadActivityEvidence(user, activity.project)) {
    return NextResponse.json({ success: false, error: "No autorizado." }, { status: 403 });
  }

  if (activity.status === "APPROVED") {
    return NextResponse.json({ success: false, error: "No se puede cargar archivos en una actividad aprobada." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(fileType)) {
    return NextResponse.json({ success: false, error: "Tipo de archivo no permitido." }, { status: 400 });
  }

  const maxSizeBytes = 20 * 1024 * 1024;
  if (fileSize > maxSizeBytes) {
    return NextResponse.json({ success: false, error: "El archivo supera 20MB." }, { status: 400 });
  }

  try {
    const extMatch = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".")) : "";
    const storedName = `${randomUUID()}${extMatch}`;
    const key = `activities/${activityId}/${storedName}`;
    const uploadUrl = await getPresignedUploadUrl(key, fileType || "application/octet-stream");

    return NextResponse.json({
      success: true,
      uploadUrl,
      key,
      originalName: fileName,
      maxSizeBytes,
    });
  } catch (error) {
    console.error("Mobile activity upload request error:", error);
    return NextResponse.json({ success: false, error: "No se pudo preparar la subida." }, { status: 500 });
  }
}
