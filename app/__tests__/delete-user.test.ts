import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock: any = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/auth-actions", () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from "@/app/auth-actions";
import { deleteUser } from "@/app/actions";

describe("deleteUser", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser as any).mockReset();
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.update.mockReset();
    prismaMock.auditLog.create.mockReset();
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
  });

  it("denies deletion if caller is not admin", async () => {
    vi.mocked(getCurrentUser as any).mockResolvedValue({ id: "u1", role: "CONSULTANT" });
    const res = await deleteUser("target");
    expect(res.success).toBe(false);
  });

  it("denies deletion of ADMIN_PMD target", async () => {
    vi.mocked(getCurrentUser as any).mockResolvedValue({ id: "admin1", role: "ADMIN_PMD" });
    prismaMock.user.findUnique.mockResolvedValue({ id: "admin2", role: "ADMIN_PMD", deletedAt: null });
    const res = await deleteUser("admin2");
    expect(res.success).toBe(false);
  });

  it("soft-deletes non-admin user", async () => {
    vi.mocked(getCurrentUser as any).mockResolvedValue({ id: "admin1", role: "ADMIN_PMD" });
    prismaMock.user.findUnique.mockResolvedValue({ id: "u2", role: "CONSULTANT", email: "c@pmd.com", deletedAt: null });
    const res = await deleteUser("u2");
    expect(res.success).toBe(true);
    expect(prismaMock.user.update).toHaveBeenCalled();
  });
});

