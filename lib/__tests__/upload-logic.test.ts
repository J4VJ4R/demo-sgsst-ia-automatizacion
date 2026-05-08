import { describe, expect, it, vi } from "vitest";
import { isUploadAllowed } from "../priority-logic";

describe("isUploadAllowed - regla Cumplido (> 30 días) bloquea carga", () => {
  it("permite si no hay fecha", () => {
    expect(isUploadAllowed(null)).toBe(true);
  });

  it("permite si faltan 30 días o menos", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0));
    expect(isUploadAllowed(new Date(2026, 0, 31))).toBe(true);
    vi.useRealTimers();
  });

  it("bloquea si faltan más de 30 días", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0, 0));
    expect(isUploadAllowed(new Date(2026, 1, 1))).toBe(false);
    vi.useRealTimers();
  });
});
