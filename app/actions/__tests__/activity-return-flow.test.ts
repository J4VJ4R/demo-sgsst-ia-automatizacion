import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const prismaMock: any = vi.hoisted(() => ({
  activity: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  notification: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/app/auth-actions", () => ({ getCurrentUser: vi.fn() }));

const publishActivitiesSpy = vi.fn();
vi.mock("@/lib/realtime/activities-bus", () => ({
  publishActivitiesEvent: (...args: any[]) => publishActivitiesSpy(...args),
}));

const publishNotificationsSpy = vi.fn();
vi.mock("@/lib/realtime/notifications-bus", () => ({
  publishNotificationsEvent: (...args: any[]) => publishNotificationsSpy(...args),
}));

import { returnActivityToConsultant, updateActivityStatus } from "@/app/actions";
import { getCurrentUser } from "@/app/auth-actions";

describe("returnActivityToConsultant - flujo devolución", () => {
  beforeEach(() => {
    prismaMock.activity.findUnique.mockReset();
    prismaMock.$transaction.mockReset();
    publishActivitiesSpy.mockClear();
    publishNotificationsSpy.mockClear();
    vi.mocked(getCurrentUser as any).mockReset();
  });

  it("devuelve la actividad a PENDING, guarda nota y notifica al consultor", async () => {
    vi.mocked(getCurrentUser as any).mockResolvedValue({ id: "admin-1", role: "ADMIN_PMD", name: "Admin" });

    prismaMock.activity.findUnique.mockResolvedValue({
      id: "act-1",
      title: "Actividad X",
      status: "IN_REVIEW",
      priority: "Media",
      dueDate: null,
      assignedToId: null,
      project: { id: "p1", name: "Empresa X", nit: "900", consultantId: "c1" },
      assignedTo: null,
    });

    prismaMock.user.findUnique.mockResolvedValue({ id: "c1", role: "CONSULTANT", name: "Consultor 1", deletedAt: null });
    prismaMock.notification.create.mockResolvedValue({
      id: "n1",
      recipientId: "c1",
      title: "Actividad Devuelta",
      message: "msg",
      type: "ACTIVITY_RETURNED",
      priority: "HIGH",
      category: "OPERATIONAL",
      functionalArea: "SST",
      createdAt: new Date("2026-03-13T10:00:00.000Z"),
      activityId: "act-1",
    });

    prismaMock.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        activityHistory: {
          findFirst: vi.fn().mockResolvedValue({ changedByUserId: "c1" }),
          create: vi.fn().mockResolvedValue({ id: "h1" }),
        },
        activity: {
          update: vi.fn().mockResolvedValue({
            id: "act-1",
            title: "Actividad X",
            status: "REJECTED",
            priority: "Media",
            dueDate: null,
            returnedNote: "Observación",
            returnedAt: new Date("2026-03-13T10:00:00.000Z"),
            updatedAt: new Date("2026-03-13T10:00:00.000Z"),
            project: { id: "p1", name: "Empresa X", nit: "900", consultantId: "c1" },
            assignedTo: { name: "Consultor 1" },
            documents: [],
          }),
        },
      };
      return cb(tx);
    });

    const res = await returnActivityToConsultant("act-1", "Observación");
    expect(res.success).toBe(true);
    expect(publishNotificationsSpy).toHaveBeenCalled();
    expect(publishActivitiesSpy).toHaveBeenCalled();
  });

  it("bloquea devolución si el actor no es admin", async () => {
    vi.mocked(getCurrentUser as any).mockResolvedValue({ id: "c1", role: "CONSULTANT" });
    const res = await returnActivityToConsultant("act-1", "nota");
    expect(res.success).toBe(false);
  });

  it("retorna error si la actividad no existe", async () => {
    vi.mocked(getCurrentUser as any).mockResolvedValue({ id: "admin-1", role: "ADMIN_PMD" });
    prismaMock.activity.findUnique.mockResolvedValue(null);
    const res = await returnActivityToConsultant("missing", "nota");
    expect(res.success).toBe(false);
  });

  it("retorna error si la actividad no está en revisión", async () => {
    vi.mocked(getCurrentUser as any).mockResolvedValue({ id: "admin-1", role: "ADMIN_PMD" });
    prismaMock.activity.findUnique.mockResolvedValue({
      id: "act-1",
      title: "Actividad X",
      status: "PENDING",
      project: { id: "p1", name: "Empresa X", consultantId: "c1" },
      assignedTo: null,
    });
    const res = await returnActivityToConsultant("act-1", "nota");
    expect(res.success).toBe(false);
  });

  it("limpia returnedNote/returnedAt cuando el consultor reenvía a revisión", async () => {
    vi.mocked(getCurrentUser as any).mockResolvedValue({ id: "c1", role: "CONSULTANT" });
    prismaMock.activity.findUnique.mockResolvedValue({
      id: "act-1",
      title: "Actividad X",
      status: "PENDING",
      project: { id: "p1", name: "Empresa X", consultantId: "c1" },
    });
    const updateSpy = vi.fn();
    const historySpy = vi.fn();
    prismaMock.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        activity: { update: updateSpy },
        activityHistory: { create: historySpy },
        user: { findMany: vi.fn().mockResolvedValue([]) },
        notification: { create: vi.fn() },
      };
      return cb(tx);
    });

    const res = await updateActivityStatus("act-1", "IN_REVIEW");
    expect(res.success).toBe(true);
    expect(updateSpy).toHaveBeenCalled();
    expect(updateSpy.mock.calls[0][0]?.data?.returnedNote).toBe(null);
    expect(updateSpy.mock.calls[0][0]?.data?.returnedAt).toBe(null);
  });
});
