import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireMobileUser, isAdminRole } from "@/lib/mobile-api";

export async function GET(req: Request) {
  const auth = await requireMobileUser(req);
  if (!auth.ok) return auth.response;

  const user = auth.user;
  const where =
    isAdminRole(user.role)
      ? {}
      : user.role === "CONSULTANT"
        ? { consultantId: user.id }
        : user.role === "CLIENT" || user.role === "CLIENT_VIEWER"
          ? { clientUserId: user.id }
          : { id: "__none__" };

  const projects = await prisma.project.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      clientName: true,
      status: true,
      startDate: true,
      department: true,
      municipality: true,
      riskLevel: true,
      workerCount: true,
      consultantId: true,
      clientUserId: true,
      consultant: { select: { id: true, name: true, email: true } },
      clientUser: { select: { id: true, name: true, email: true } },
      _count: {
        select: {
          activities: true,
          collaborators: true,
          accidentalidad: true,
        },
      },
    },
  });

  return NextResponse.json({
    success: true,
    items: projects.map((project) => ({
      id: project.id,
      name: project.name,
      clientName: project.clientName,
      status: project.status,
      startDate: project.startDate.toISOString(),
      department: project.department,
      municipality: project.municipality,
      riskLevel: project.riskLevel,
      workerCount: project.workerCount,
      counts: {
        activities: project._count.activities,
        collaborators: project._count.collaborators,
        accidentalidad: project._count.accidentalidad,
      },
      consultant: project.consultant,
      clientUser: project.clientUser,
    })),
  });
}
