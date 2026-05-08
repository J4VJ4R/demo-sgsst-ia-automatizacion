import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const prismaMock: any = vi.hoisted(() => ({
  project: { findUnique: vi.fn() },
  projectSection: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    createMany: vi.fn(),
    upsert: vi.fn(),
  },
  activity: { count: vi.fn(), createMany: vi.fn() },
  accidentalidadEmpresa: { count: vi.fn(), createMany: vi.fn() },
  sgSstDesignSection: { count: vi.fn(), createMany: vi.fn() },
  auditLog: { create: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/app/auth-actions", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/accidentalidad-data", () => ({ accidentalidadActivities: ["A1"] }));
vi.mock("@/lib/activities-data", () => ({ chapterActivities: { "1": ["T1"] } }));
vi.mock("@/lib/sgsst-design-defaults", () => ({ getDefaultSgSstDesignSections: () => ["S1"] }));

import { getCurrentUser } from "@/app/auth-actions";
import { setProjectSectionEnabled } from "@/app/project-sections-actions";

describe("project-sections-actions", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser as any).mockReset();
    prismaMock.project.findUnique.mockReset();
    prismaMock.projectSection.findMany.mockReset();
    prismaMock.projectSection.findUnique.mockReset();
    prismaMock.projectSection.createMany.mockReset();
    prismaMock.projectSection.upsert.mockReset();
    prismaMock.activity.count.mockReset();
    prismaMock.auditLog.create.mockReset();
  });

  it("prevents disabling requirements when there are non-approved activities", async () => {
    vi.mocked(getCurrentUser as any).mockResolvedValue({ id: "u1", role: "ADMIN_PMD" });
    prismaMock.project.findUnique.mockResolvedValue({ id: "p1", consultantId: "c1", clientUserId: "cl1", chapter: "1" });
    prismaMock.projectSection.findMany.mockResolvedValue([{ sectionKey: "requirements", enabled: true }]);
    prismaMock.projectSection.findUnique.mockResolvedValue({ enabled: true });
    prismaMock.activity.count.mockResolvedValue(2);

    const res = await setProjectSectionEnabled({ projectId: "p1", sectionKey: "requirements", enabled: false });
    expect(res.success).toBe(false);
  });

  it("writes audit log on enable", async () => {
    vi.mocked(getCurrentUser as any).mockResolvedValue({ id: "u1", role: "ADMIN_PMD" });
    prismaMock.project.findUnique.mockResolvedValue({ id: "p1", consultantId: "c1", clientUserId: "cl1", chapter: "1" });
    prismaMock.projectSection.findMany.mockResolvedValue([]);
    prismaMock.projectSection.findUnique.mockResolvedValue({ enabled: false });
    prismaMock.activity.count.mockResolvedValue(0);
    prismaMock.accidentalidadEmpresa.count.mockResolvedValue(0);
    prismaMock.sgSstDesignSection.count.mockResolvedValue(0);

    const res = await setProjectSectionEnabled({ projectId: "p1", sectionKey: "accidentalidad", enabled: true });
    expect(res.success).toBe(true);
    expect(prismaMock.auditLog.create).toHaveBeenCalled();
  });
});

