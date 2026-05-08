import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const prismaMock: any = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn(),
  },
  sgSstDesignSection: {
    findMany: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    createMany: vi.fn(),
  },
  sgSstDesignFile: {
    findFirst: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/app/auth-actions", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/s3", () => ({
  getPresignedUploadUrl: vi.fn(async () => "https://example.com/upload"),
  getPublicUrl: vi.fn(() => "https://example.com/public"),
}));

import { getCurrentUser } from "@/app/auth-actions";
import { createSgSstDesignActivity, createSgSstDesignUploadRequest, deleteSgSstDesignSection } from "@/app/sgsst-actions";

describe("sgsst-actions", () => {
  beforeEach(() => {
    prismaMock.project.findUnique.mockReset();
    prismaMock.sgSstDesignSection.aggregate.mockReset();
    prismaMock.sgSstDesignSection.create.mockReset();
    prismaMock.sgSstDesignSection.findUnique.mockReset();
    vi.mocked(getCurrentUser as any).mockReset();
  });

  it("creates a new section with sortOrder=max+1", async () => {
    vi.mocked(getCurrentUser as any).mockResolvedValue({ id: "u1", role: "ADMIN_PMD" });
    prismaMock.project.findUnique.mockResolvedValue({ id: "p1", consultantId: "c1", clientUserId: "cl1" });
    prismaMock.sgSstDesignSection.aggregate.mockResolvedValue({ _max: { sortOrder: 5 } });
    prismaMock.sgSstDesignSection.create.mockResolvedValue({ id: "s1", projectId: "p1", name: "Nueva", sortOrder: 6, isDefault: false });

    const res = await createSgSstDesignActivity("p1", "Nueva");
    expect(res.success).toBe(true);
    expect(prismaMock.sgSstDesignSection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ projectId: "p1", name: "Nueva", sortOrder: 6, isDefault: false }),
      })
    );
  });

  it("rejects deleting a default section", async () => {
    vi.mocked(getCurrentUser as any).mockResolvedValue({ id: "u1", role: "ADMIN_PMD" });
    prismaMock.sgSstDesignSection.findUnique.mockResolvedValue({
      id: "s1",
      projectId: "p1",
      isDefault: true,
      project: { consultantId: "c1", clientUserId: "cl1" },
    });

    const res = await deleteSgSstDesignSection("s1");
    expect(res.success).toBe(false);
  });

  it("rejects unsupported mime types on upload request", async () => {
    vi.mocked(getCurrentUser as any).mockResolvedValue({ id: "u1", role: "ADMIN_PMD" });
    prismaMock.sgSstDesignSection.findUnique.mockResolvedValue({
      id: "s1",
      projectId: "p1",
      isDefault: true,
      project: { consultantId: "c1", clientUserId: "cl1" },
    });

    const res = await createSgSstDesignUploadRequest({
      sectionId: "s1",
      fileName: "file.exe",
      mimeType: "application/octet-stream",
      sizeBytes: 10,
    });
    expect(res.success).toBe(false);
  });
});
