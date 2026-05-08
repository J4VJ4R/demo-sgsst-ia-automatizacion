import { describe, expect, it } from "vitest";
import { calculatePriority } from "../priority-logic";

describe("calculatePriority - reglas por días restantes", () => {
  const ref = new Date(2026, 0, 1, 12, 0, 0);

  it("marca Vencido si la fecha es pasada", () => {
    const r = calculatePriority(new Date(2025, 11, 31), ref);
    expect(r.isValid).toBe(true);
    expect(r.priority).toBe("Vencido");
  });

  it("marca Vencido si la fecha es hoy", () => {
    expect(calculatePriority(new Date(2026, 0, 1), ref).priority).toBe("Vencido");
  });

  it("marca Por vencer si la fecha es futura (1 a 30 días)", () => {
    expect(calculatePriority(new Date(2026, 0, 2), ref).priority).toBe("Por vencer");
    expect(calculatePriority(new Date(2026, 0, 31), ref).priority).toBe("Por vencer");
  });

  it("marca Cumplido si faltan más de 30 días", () => {
    expect(calculatePriority(new Date(2026, 1, 1), ref).priority).toBe("Cumplido");
  });

  it("marca inválida si la fecha es inválida", () => {
    const invalid = new Date("invalid");
    const r = calculatePriority(invalid, ref);
    expect(r.isValid).toBe(false);
    expect(r.error).toBeTruthy();
  });
});
