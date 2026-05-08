import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/auth-actions";
import { canViewAccidentalidad } from "@/lib/permissions";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ accidentalidadId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !canViewAccidentalidad(user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { accidentalidadId } = await ctx.params;
  const acc = await prisma.accidentalidadEmpresa.findUnique({
    where: { id: accidentalidadId },
    include: { project: true },
  });
  if (!acc) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const isAdmin = user.role === "ADMIN_PMD" || user.role === "GESTOR";
  const isConsultant = user.role === "CONSULTANT" && acc.project.consultantId === user.id;
  const isClient =
    (user.role === "CLIENT" || user.role === "CLIENT_VIEWER") && acc.project.clientUserId === user.id;
  if (!isAdmin && !isConsultant && !isClient) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const history = await prisma.historialAccidentalidad.findMany({
    where: { accidentalidadId },
    orderBy: { changedAt: "desc" },
    include: { changedBy: { select: { name: true, role: true } } },
  });
  return NextResponse.json({ history });
}

