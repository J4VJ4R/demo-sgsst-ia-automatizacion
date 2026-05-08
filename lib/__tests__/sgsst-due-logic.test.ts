import { describe, it, expect } from "vitest";
import { calculateSgSstDueStatus, validateSgSstDueDate } from "@/lib/sgsst-due-logic";

describe("calculateSgSstDueStatus", () => {
  it("returns Vencido when due date is today", () => {
    const status = calculateSgSstDueStatus("2026-03-01", new Date("2026-03-01T12:00:00"));
    expect(status).toBe("Vencido");
  });

  it("returns Por vencer when remaining days <= 30", () => {
    const status = calculateSgSstDueStatus("2026-03-02", new Date("2026-03-01T12:00:00"));
    expect(status).toBe("Por vencer");
  });

  it("returns Cumplido when remaining days > 30", () => {
    const status = calculateSgSstDueStatus("2026-04-15", new Date("2026-03-01T12:00:00"));
    expect(status).toBe("Cumplido");
  });
});

describe("validateSgSstDueDate", () => {
  it("rejects invalid date", () => {
    const res = validateSgSstDueDate("invalid");
    expect(res.ok).toBe(false);
  });

  it("rejects past or same day", () => {
    const res = validateSgSstDueDate("2026-03-01", new Date("2026-03-01T12:00:00"));
    expect(res.ok).toBe(false);
  });

  it("accepts future date", () => {
    const res = validateSgSstDueDate("2026-03-02", new Date("2026-03-01T12:00:00"));
    expect(res.ok).toBe(true);
  });
});
