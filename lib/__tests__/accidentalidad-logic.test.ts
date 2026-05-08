import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateAccidentalidadPriority,
  validateFutureDueDate,
  allowedAccidentalidadMimeTypes,
  maxAccidentalidadFileSizeBytes,
} from "../accidentalidad-logic";

describe("accidentalidad-logic", () => {
  it("calcula prioridad con umbrales 0/30 días", () => {
    const now = new Date("2026-03-10T12:00:00Z");
    assert.equal(
      calculateAccidentalidadPriority("2026-03-10", now),
      "Vencido"
    );
    assert.equal(
      calculateAccidentalidadPriority("2026-03-20", now),
      "Por vencer"
    );
    assert.equal(
      calculateAccidentalidadPriority("2026-05-20", now),
      "Cumplido"
    );
  });

  it("valida que la fecha de vencimiento sea futura", () => {
    const now = new Date("2026-03-10T12:00:00Z");
    assert.equal(validateFutureDueDate("2026-03-09", now).ok, false);
    assert.equal(validateFutureDueDate("2026-03-10", now).ok, false);
    assert.equal(validateFutureDueDate("2026-03-11", now).ok, true);
  });

  it("expone validaciones de archivo", () => {
    assert.ok(allowedAccidentalidadMimeTypes.includes("application/pdf"));
    assert.equal(maxAccidentalidadFileSizeBytes, 20 * 1024 * 1024);
  });
});
