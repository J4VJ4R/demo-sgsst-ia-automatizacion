import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const prismaMock: any = vi.hoisted(() => ({
  accidentalidadEmpresa: { findUnique: vi.fn() },
  user: { findMany: vi.fn() },
  notification: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/app/auth-actions", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/accidentalidad-status", () => ({
  validateAccidentalidadEstadoTransition: () => ({ ok: true }),
}));

const publishNotificationsSpy = vi.fn();
vi.mock("@/lib/realtime/notifications-bus", () => ({
  publishNotificationsEvent: (...args: any[]) => publishNotificationsSpy(...args),
}));

import { updateAccidentalidadStatus } from "@/app/actions/accidentalidad-actions";
import { getCurrentUser } from "@/app/auth-actions";

describe("updateAccidentalidadStatus - devolución a REJECTED", () => {
  beforeEach(() => {
    prismaMock.accidentalidadEmpresa.findUnique.mockReset();
    prismaMock.$transaction.mockReset();
    prismaMock.notification.create.mockReset();
    publishNotificationsSpy.mockClear();
    vi.mocked(getCurrentUser as any).mockReset();
  });

  it("crea notificación ACTIVITY_RETURNED y publica evento realtime para el consultor", async () => {
    vi.mocked(getCurrentUser as any).mockResolvedValue({ id: "admin-1", role: "ADMIN_PMD", name: "Admin" });

    prismaMock.accidentalidadEmpresa.findUnique.mockResolvedValue({
      id: "acc-1",
      actividad: "Accidentalidad X",
      status: "IN_REVIEW",
      projectId: "p1",
      project: { id: "p1", name: "Empresa X", consultantId: "c1", clientUserId: null },
    });

    prismaMock.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        accidentalidadEmpresa: { update: vi.fn() },
        historialAccidentalidad: { create: vi.fn() },
        auditLog: { create: vi.fn() },
      };
      return cb(tx);
    });

    prismaMock.notification.create.mockResolvedValue({
      id: "n1",
      recipientId: "c1",
      title: "Actividad Devuelta",
      message: "[ACC:acc-1] ...",
      type: "ACTIVITY_RETURNED",
      priority: "HIGH",
      category: "OPERATIONAL",
      functionalArea: "SST",
      createdAt: new Date("2026-03-13T10:00:00.000Z"),
      activityId: null,
    });

    const fd = new FormData();
    fd.append("accidentalidadId", "acc-1");
    fd.append("status", "REJECTED");
    fd.append("note", "Motivo");

    const res = await updateAccidentalidadStatus(fd);
    expect(res.success).toBe(true);
    expect(prismaMock.notification.create).toHaveBeenCalled();
    expect(publishNotificationsSpy).toHaveBeenCalled();
    const published = publishNotificationsSpy.mock.calls[0][0];
    expect(published.payload.recipientId).toBe("c1");
  });
});

