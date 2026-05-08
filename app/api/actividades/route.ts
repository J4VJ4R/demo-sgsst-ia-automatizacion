import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/auth-actions";
import { canEditAccidentalidad } from "@/lib/permissions";
import { parseDateOnly } from "@/lib/accidentalidad-logic";
import { accidentalidadActivities } from "@/lib/accidentalidad-data";
import { randomUUID } from "crypto";

function parseDueDateFlexible(value: string): { ok: true; date: Date; normalized: string } | { ok: false } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false };

  if (trimmed.includes("/")) {
    const [dd, mm, yyyy] = trimmed.split("/").map((x) => parseInt(x, 10));
    if (!dd || !mm || !yyyy) return { ok: false };
    const date = new Date(yyyy, mm - 1, dd);
    if (Number.isNaN(date.getTime())) return { ok: false };
    const normalized = `${String(yyyy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    return { ok: true, date, normalized };
  }

  const date = parseDateOnly(trimmed);
  if (!date) return { ok: false };
  return { ok: true, date, normalized: trimmed };
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !canEditAccidentalidad(user.role)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = (await req.json()) as {
      projectId?: string;
      fechaAccidente?: string;
      nombreColaborador?: string;
      identificacion?: string;
      area?: string;
    };

    const projectId = (body.projectId || "").trim();
    const fechaAccidenteRaw = (body.fechaAccidente || "").trim();
    const nombreColaborador = (body.nombreColaborador || "").trim();
    const identificacion = (body.identificacion || "").trim();
    const area = (body.area || "").trim();

    if (!projectId) return NextResponse.json({ error: "projectId es requerido" }, { status: 400 });
    if (!fechaAccidenteRaw) return NextResponse.json({ error: "Fecha del accidente es requerida" }, { status: 400 });
    if (!nombreColaborador) return NextResponse.json({ error: "Nombre del colaborador es requerido" }, { status: 400 });
    if (!identificacion) return NextResponse.json({ error: "Identificación es requerida" }, { status: 400 });
    if (!area) return NextResponse.json({ error: "Área es requerida" }, { status: 400 });
    if (nombreColaborador.length > 80) return NextResponse.json({ error: "Nombre del colaborador debe tener máximo 80 caracteres" }, { status: 400 });
    if (identificacion.length > 30) return NextResponse.json({ error: "Identificación debe tener máximo 30 caracteres" }, { status: 400 });
    if (area.length > 60) return NextResponse.json({ error: "Área debe tener máximo 60 caracteres" }, { status: 400 });

    const parsed = parseDueDateFlexible(fechaAccidenteRaw);
    if (!parsed.ok) return NextResponse.json({ error: "Fecha del accidente inválida" }, { status: 400 });

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, consultantId: true, clientUserId: true, consultant: { select: { name: true } } },
    });
    if (!project) return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });

    const isAdmin = user.role === "ADMIN_PMD" || user.role === "GESTOR";
    const isConsultant = user.role === "CONSULTANT" && project.consultantId === user.id;
    if (!isAdmin && !isConsultant) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    if (isAdmin && !project.consultantId) {
      return NextResponse.json(
        { error: "La empresa no tiene consultor asignado. Asigne un consultor antes de crear la actividad." },
        { status: 400 }
      );
    }

    const assignedToId = isConsultant ? user.id : project.consultantId;
    const createdOn = new Date().toISOString().slice(0, 10);
    const accidentId = randomUUID();

    const existing = await prisma.accidentalidadEmpresa.findMany({
      where: { projectId, actividad: { startsWith: "ACC:" } },
      select: { actividad: true },
      take: 5000,
    });
    let maxN = 0;
    for (const row of existing) {
      const parts = (row.actividad || "").split("|");
      if (parts.length < 2) continue;
      const maybeName = parts[1] || "";
      const m = /^Accidente\s+(\d+)\s*$/i.exec(maybeName.trim());
      if (!m) continue;
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n)) maxN = Math.max(maxN, n);
    }
    const accidentName = `Accidente ${maxN + 1}`;

    const sanitize = (value: string) => value.replaceAll("|", " ").trim();
    const col = sanitize(nombreColaborador);
    const ident = sanitize(identificacion);
    const areaValue = sanitize(area);

    const ids: string[] = [];
    await prisma.$transaction(async (tx) => {
      for (const taskName of accidentalidadActivities) {
        const actividad = `ACC:${accidentId}|${accidentName}|${taskName}|${col}|${ident}|${areaValue}`;
        const row = await tx.accidentalidadEmpresa.create({
          data: {
            projectId,
            actividad,
            dueDate: parsed.date,
            status: "PENDING",
            priority: "Cumplido",
            assignedToId,
          },
          select: { id: true },
        });
        ids.push(row.id);
        await tx.historialAccidentalidad.create({
          data: {
            accidentalidadId: row.id,
            field: "create",
            oldValue: null,
            newValue: actividad,
            changedByUserId: user.id,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "CREATE",
          entity: "ACCIDENTALIDAD_ACCIDENT",
          entityId: `ACC:${accidentId}`,
          details: `Accidente creado: ${accidentName}`,
          performedBy: user.id,
        },
      });
    });

    const createdRows = await prisma.accidentalidadEmpresa.findMany({
      where: { id: { in: ids } },
      include: {
        archivos: {
          where: { deletedAt: null },
          orderBy: { uploadedAt: "desc" },
        },
        assignedTo: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    try {
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN_PMD" },
        select: { id: true },
      });
      const creator = user.name || user.email || "Usuario";
      const dueIso = parsed.date.toISOString().slice(0, 10);

      await Promise.all(
        admins
          .filter((a) => a.id !== user.id)
          .map((admin) =>
            prisma.notification.create({
              data: {
                recipientId: admin.id,
                title: "Nueva actividad de accidentalidad",
                message: `Nuevo accidente creado · ${accidentName} · Empresa: ${project.name} · Fecha del accidente: ${dueIso} · Colaborador: ${col} · ID: ${ident} · Área: ${areaValue} · Fecha registro: ${createdOn} · Responsable: ${creator} [ACC:${accidentId}]`,
                type: "ACCIDENTALIDAD_CREATED",
                priority: "MEDIUM",
                category: "OPERATIONAL",
                functionalArea: "SST",
              },
            })
          )
      );
    } catch (notifyError) {
      console.error("Failed to send accidentalidad create notifications:", notifyError);
    }

    return NextResponse.json(
      {
        accident: {
          id: accidentId,
          name: accidentName,
          fechaAccidente: parsed.date.toISOString(),
          nombreColaborador: col,
          identificacion: ident,
          area: areaValue,
        },
        rows: createdRows.map((created) => ({
          id: created.id,
          actividad: created.actividad,
          status: created.status,
          priority: created.priority,
          dueDate: created.dueDate.toISOString(),
          createdAt: created.createdAt.toISOString(),
          assignedTo: created.assignedTo?.name || null,
          archivos: created.archivos.map((d) => ({
            id: d.id,
            name: d.name,
            url: d.url,
            uploadedAt: d.uploadedAt.toISOString(),
            version: d.version,
            sizeBytes: d.sizeBytes ?? null,
          })),
        })),
      },
      { status: 201 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error al crear actividad" }, { status: 500 });
  }
}
