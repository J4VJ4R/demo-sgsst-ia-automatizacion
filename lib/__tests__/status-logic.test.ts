
import { describe, it } from "node:test";
import assert from "node:assert";
import { getStatusInfo } from "../status-helpers";

describe("Status Logic Tests", () => {
  it("should return Completada for APPROVED status", () => {
    const info = getStatusInfo("APPROVED", false);
    assert.strictEqual(info.label, "Completada");
    assert.strictEqual(info.className.includes("bg-green-600"), true);
  });

  it("should return En revisión for IN_REVIEW status", () => {
    const info = getStatusInfo("IN_REVIEW", false);
    assert.strictEqual(info.label, "En revisión");
    assert.strictEqual(info.className.includes("bg-blue-600"), true);
  });

  it("should return Rechazada for REJECTED status even if hasDocuments is true", () => {
    const info = getStatusInfo("REJECTED", true);
    assert.strictEqual(info.label, "Rechazada");
    assert.strictEqual(info.className.includes("bg-red-600"), true);
  });

  it("should return En revisión if hasDocuments is true and status is PENDING", () => {
    const info = getStatusInfo("PENDING", true);
    assert.strictEqual(info.label, "En revisión");
    assert.strictEqual(info.className.includes("bg-blue-600"), true);
  });
});
