import { describe, expect, it } from "vitest";
import { getInspectionMaintenancePriority } from "../inspection-maintenance-logic";

describe("getInspectionMaintenancePriority", () => {
  it("asigna Vencido cuando no hay fecha", () => {
    const res = getInspectionMaintenancePriority({ dueDate: null });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.priority).toBe("Vencido");
      expect(res.dueDate).toBe(null);
    }
  });

  it("calcula prioridad cuando hay fecha válida", () => {
    const ref = new Date(2026, 0, 1, 12, 0, 0);
    const res = getInspectionMaintenancePriority({ dueDate: "2026-01-31", referenceDate: ref });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.priority).toBe("Por vencer");
    }
  });

  it("devuelve error cuando la fecha es inválida", () => {
    const res = getInspectionMaintenancePriority({ dueDate: "invalid" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBeTruthy();
    }
  });
});

