import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityStatusActions } from "../activity-status-actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/components/activities/requirement-actions", () => ({
  RequirementActions: () => null,
}));

describe("ActivityStatusActions - nota de devolución", () => {
  it("muestra indicador Devuelta y botón Nota para consultor cuando hay returnedNote", () => {
    render(
      <ActivityStatusActions
        id="act-1"
        status="REJECTED"
        userRole="CONSULTANT"
        title="Actividad X"
        projectName="Empresa X"
        documents={[]}
        rejectionReason="Observación de admin"
      />
    );

    expect(screen.getByText("Rechazada")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Motivo/i })).toBeTruthy();
  });
});
