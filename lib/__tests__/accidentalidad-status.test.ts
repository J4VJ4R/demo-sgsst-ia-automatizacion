import { describe, it, expect } from "vitest";
import {
  getAccidentalidadEstadoBadgeClass,
  getAccidentalidadEstadoLabel,
  validateAccidentalidadEstadoTransition,
} from "../accidentalidad-status";

describe("accidentalidad-status", () => {
  it("mapea labels correctamente", () => {
    expect(getAccidentalidadEstadoLabel("PENDING")).toBe("Pendiente");
    expect(getAccidentalidadEstadoLabel("IN_REVIEW")).toBe("En revisión");
    expect(getAccidentalidadEstadoLabel("APPROVED")).toBe("Aprobada");
    expect(getAccidentalidadEstadoLabel("REJECTED")).toBe("Rechazada");
  });

  it("expone clases de badge", () => {
    expect(getAccidentalidadEstadoBadgeClass("PENDING")).toContain("text-yellow-700");
    expect(getAccidentalidadEstadoBadgeClass("IN_REVIEW")).toContain("bg-blue");
    expect(getAccidentalidadEstadoBadgeClass("APPROVED")).toContain("bg-emerald");
    expect(getAccidentalidadEstadoBadgeClass("REJECTED")).toContain("bg-red");
  });

  it("valida transiciones (consultor)", () => {
    expect(
      validateAccidentalidadEstadoTransition({
        from: "PENDING",
        to: "IN_REVIEW",
        actorRole: "CONSULTANT",
      }).ok
    ).toBe(true);

    expect(
      validateAccidentalidadEstadoTransition({
        from: "IN_REVIEW",
        to: "APPROVED",
        actorRole: "CONSULTANT",
      }).ok
    ).toBe(false);
  });

  it("valida transiciones (admin)", () => {
    expect(
      validateAccidentalidadEstadoTransition({
        from: "IN_REVIEW",
        to: "APPROVED",
        actorRole: "ADMIN_PMD",
      }).ok
    ).toBe(true);

    expect(
      validateAccidentalidadEstadoTransition({
        from: "APPROVED",
        to: "PENDING",
        actorRole: "ADMIN_PMD",
      }).ok
    ).toBe(false);
  });
});

