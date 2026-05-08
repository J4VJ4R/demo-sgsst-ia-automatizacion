import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/auth-actions";
import { canViewAccidentalidad } from "@/lib/permissions";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ projectId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !canViewAccidentalidad(user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { projectId } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, consultantId: true, clientUserId: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
  }

  const isAdmin = user.role === "ADMIN_PMD" || user.role === "GESTOR";
  const isConsultant = user.role === "CONSULTANT" && project.consultantId === user.id;
  const isClient =
    (user.role === "CLIENT" || user.role === "CLIENT_VIEWER") && project.clientUserId === user.id;

  if (!isAdmin && !isConsultant && !isClient) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const section = await prisma.projectSection.findUnique({
    where: { projectId_sectionKey: { projectId, sectionKey: "accidentalidad" } },
    select: { enabled: true },
  });
  if (!section?.enabled) {
    return NextResponse.json({ error: "Sección desactivada" }, { status: 404 });
  }

  const rows = await prisma.accidentalidadEmpresa.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
    include: {
      assignedTo: { select: { name: true } },
      archivos: { where: { deletedAt: null }, orderBy: { uploadedAt: "desc" } },
    },
  });

  return NextResponse.json({ rows });
}
