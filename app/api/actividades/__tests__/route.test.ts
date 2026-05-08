import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock: any = vi.hoisted(() => ({
  project: { findUnique: vi.fn() },
  accidentalidadEmpresa: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
  notification: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/app/auth-actions", () => ({ getCurrentUser: vi.fn() }));

import { POST } from "../route";
import { getCurrentUser } from "@/app/auth-actions";

describe("POST /api/actividades (accidentalidad) - asignación automática", () => {
  beforeEach(() => {
    prismaMock.project.findUnique.mockReset();
    prismaMock.user.findMany.mockReset();
    prismaMock.accidentalidadEmpresa.findMany.mockReset();
    prismaMock.notification.create.mockReset();
    prismaMock.$transaction.mockReset();
    vi.mocked(getCurrentUser as any).mockReset();
  });

  it("asigna al consultor creador cuando el creador es CONSULTANT", async () => {
    vi.mocked(getCurrentUser as any).mockResolvedValue({
      id: "c1",
      role: "CONSULTANT",
      name: "Silvia Rivera",
      email: "c1@test.com",
    });

    prismaMock.project.findUnique.mockResolvedValue({
      id: "p1",
      name: "Empresa X",
      consultantId: "c1",
      clientUserId: null,
      consultant: { name: "Silvia Rivera" },
    });

    const createFn = vi.fn().mockImplementation(async () => ({ id: "row-1" }));

    prismaMock.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        accidentalidadEmpresa: {
          create: createFn,
        },
        historialAccidentalidad: { create: vi.fn() },
        auditLog: { create: vi.fn() },
      };
      return cb(tx);
    });

    prismaMock.accidentalidadEmpresa.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "row-1",
          actividad: "ACC:acc-1|Accidente 1|FURAT|Silvia|123|Transporte",
          status: "PENDING",
          priority: "Cumplido",
          dueDate: new Date("2026-03-20T00:00:00.000Z"),
          createdAt: new Date("2026-03-12T00:00:00.000Z"),
          assignedTo: { name: "Silvia Rivera" },
          archivos: [],
        },
      ]);

    prismaMock.user.findMany.mockResolvedValue([{ id: "admin-1" }]);
    prismaMock.notification.create.mockResolvedValue({ id: "n1" });

    const req = new Request("http://localhost/api/actividades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "p1",
        fechaAccidente: "2026-03-20",
        nombreColaborador: "Silvia",
        identificacion: "123",
        area: "Transporte",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.rows[0].assignedTo).toBe("Silvia Rivera");
    expect(createFn).toHaveBeenCalled();
    expect(createFn.mock.calls[0][0]?.data?.assignedToId).toBe("c1");
  });

  it("asigna al consultor de la empresa cuando el creador es ADMIN_PMD", async () => {
    vi.mocked(getCurrentUser as any).mockResolvedValue({
      id: "a1",
      role: "ADMIN_PMD",
      name: "Admin",
      email: "a1@test.com",
    });

    prismaMock.project.findUnique.mockResolvedValue({
      id: "p1",
      name: "Empresa X",
      consultantId: "c2",
      clientUserId: null,
      consultant: { name: "Consultor 2" },
    });

    const createFn = vi.fn().mockImplementation(async () => ({ id: "row-2" }));

    prismaMock.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        accidentalidadEmpresa: {
          create: createFn,
        },
        historialAccidentalidad: { create: vi.fn() },
        auditLog: { create: vi.fn() },
      };
      return cb(tx);
    });

    prismaMock.accidentalidadEmpresa.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: "row-2",
          actividad: "ACC:acc-2|Accidente 1|FURAT|Juan|456|Transporte",
          status: "PENDING",
          priority: "Cumplido",
          dueDate: new Date("2026-03-20T00:00:00.000Z"),
          createdAt: new Date("2026-03-12T00:00:00.000Z"),
          assignedTo: { name: "Consultor 2" },
          archivos: [],
        },
      ]);

    prismaMock.user.findMany.mockResolvedValue([{ id: "admin-2" }]);
    prismaMock.notification.create.mockResolvedValue({ id: "n2" });

    const req = new Request("http://localhost/api/actividades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "p1",
        fechaAccidente: "2026-03-20",
        nombreColaborador: "Juan",
        identificacion: "456",
        area: "Transporte",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.rows[0].assignedTo).toBe("Consultor 2");
    expect(createFn).toHaveBeenCalled();
    expect(createFn.mock.calls[0][0]?.data?.assignedToId).toBe("c2");
  });

  it("retorna error si ADMIN_PMD crea y la empresa no tiene consultor asignado", async () => {
    vi.mocked(getCurrentUser as any).mockResolvedValue({
      id: "a1",
      role: "ADMIN_PMD",
      name: "Admin",
      email: "a1@test.com",
    });

    prismaMock.project.findUnique.mockResolvedValue({
      id: "p1",
      name: "Empresa X",
      consultantId: null,
      clientUserId: null,
      consultant: null,
    });

    const req = new Request("http://localhost/api/actividades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: "p1",
        fechaAccidente: "2026-03-20",
        nombreColaborador: "Juan",
        identificacion: "456",
        area: "Transporte",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(String(json.error)).toContain("no tiene consultor asignado");
  });
});
