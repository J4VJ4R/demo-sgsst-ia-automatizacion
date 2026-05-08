import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { accidentalidadActivities } from "../accidentalidad-data";

describe("accidentalidad-data", () => {
  it("precarga 12 actividades", () => {
    assert.equal(accidentalidadActivities.length, 12);
  });

  it("incluye actividades clave por nombre", () => {
    assert.ok(accidentalidadActivities.includes("FURAT"));
    assert.ok(accidentalidadActivities.includes("Reporte a EPS"));
    assert.ok(accidentalidadActivities.includes("Reporte a Ministerio (Si Aplica)"));
    assert.ok(
      accidentalidadActivities.includes(
        "Soporte de radicación de Inv. a Ministerio de Trabajo (Si aplica)"
      )
    );
  });
});

