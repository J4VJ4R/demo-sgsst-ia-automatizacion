import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const prismaMock: any = vi.hoisted(() => ({
  accidentalidadEmpresa: {
    findUnique: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
  notification: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
}));

vi.mock("@/app/auth-actions", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/s3", () => ({
  getPublicUrl: (key: string) => `https://cdn.example.com/${key}`,
  getPresignedUploadUrl: vi.fn(),
}));

import { finalizeAccidentalidadUpload } from "../accidentalidad-actions";
import { getCurrentUser } from "@/app/auth-actions";

describe("Accidentalidad upload - permisos consultor", () => {
  beforeEach(() => {
    prismaMock.accidentalidadEmpresa.findUnique.mockReset();
    prismaMock.user.findMany.mockReset();
    prismaMock.notification.create.mockReset();
    prismaMock.$transaction.mockReset();
    vi.mocked(getCurrentUser as any).mockReset();
  });

  it("permite finalizar upload para consultor aunque falle el envío de notificaciones", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getCurrentUser as any).mockResolvedValue({
      id: "consultant-1",
      role: "CONSULTANT",
      name: "Consultor",
    });

    prismaMock.accidentalidadEmpresa.findUnique.mockResolvedValue({
      id: "acc-1",
      projectId: "p1",
      actividad: "Actividad",
      status: "PENDING",
      dueDate: new Date("2026-03-18T00:00:00.000Z"),
      project: { id: "p1", name: "Empresa X", consultantId: "consultant-1", clientUserId: null },
      archivos: [],
    });

    prismaMock.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        archivoAccidentalidad: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({
            id: "file-1",
            name: "test.pdf",
            url: "https://cdn.example.com/key",
            uploadedAt: new Date("2026-03-12T00:00:00.000Z"),
            version: 1,
            sizeBytes: 100,
          }),
        },
        accidentalidadEmpresa: { update: vi.fn() },
        historialAccidentalidad: { create: vi.fn() },
        auditLog: { create: vi.fn() },
      };
      return cb(tx);
    });

    prismaMock.user.findMany.mockResolvedValue([{ id: "admin-1" }]);
    prismaMock.notification.create.mockRejectedValue(new Error("db error"));

    const fd = new FormData();
    fd.append("accidentalidadId", "acc-1");
    fd.append("originalName", "test.pdf");
    fd.append("key", "accidentalidad/acc-1/test.pdf");
    fd.append("fileSize", "100");
    fd.append("dueDate", "2026-03-18");

    const res = await finalizeAccidentalidadUpload(fd);
    expect(res.success).toBe(true);
    consoleSpy.mockRestore();
  });
});
