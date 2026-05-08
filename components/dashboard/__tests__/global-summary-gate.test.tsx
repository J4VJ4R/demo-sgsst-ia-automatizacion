import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { GlobalSummaryGate } from "../global-summary-gate";

vi.mock("@/components/dashboard/client-activity-summary", () => ({
  ClientActivitySummary: () => <div>Resumen Global</div>,
}));

describe("GlobalSummaryGate", () => {
  it("renderiza el sidebar para roles permitidos", () => {
    const roles = ["ADMIN_PMD", "CONSULTANT", "CLIENT", "CLIENT_VIEWER"];
    for (const role of roles) {
      render(<GlobalSummaryGate role={role} />);
      expect(screen.getByText("Resumen Global")).toBeTruthy();
      cleanup();
    }
  });

  it("no renderiza el sidebar para roles no permitidos", () => {
    render(<GlobalSummaryGate role={"COLLABORATOR"} />);
    expect(screen.queryByText("Resumen Global")).toBeNull();
  });
});
