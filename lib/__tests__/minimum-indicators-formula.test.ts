import { describe, expect, it } from "vitest";
import { evaluateFormula, sanitizeVariableKey, tokenizeFormula } from "../minimum-indicators-formula";

describe("minimum-indicators-formula", () => {
  it("tokeniza y valida variables", () => {
    const res = tokenizeFormula("(a / b) * 100");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.variables).toEqual(["a", "b"]);
    }
  });

  it("rechaza sintaxis inválida", () => {
    const res = tokenizeFormula("a / / b");
    expect(res.ok).toBe(false);
  });

  it("evalúa fórmula con división", () => {
    const res = evaluateFormula("(dias_accidente / dias_trabajados) * 100", {
      dias_accidente: 2,
      dias_trabajados: 200,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(Number(res.value.toFixed(2))).toBe(1);
    }
  });

  it("maneja unary minus", () => {
    const res = evaluateFormula("-a + 10", { a: 2 });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toBe(8);
  });

  it("previene división por cero", () => {
    const res = evaluateFormula("a / b", { a: 1, b: 0 });
    expect(res.ok).toBe(false);
  });

  it("sanitiza claves", () => {
    expect(sanitizeVariableKey("Días por accidente")).toBe("dias_por_accidente");
  });
});
