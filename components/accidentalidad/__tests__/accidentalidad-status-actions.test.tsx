import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { AccidentalidadStatusActions } from "../accidentalidad-status-actions";

const refreshSpy = vi.fn();
const updateStatusSpy = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshSpy }),
}));

vi.mock("@/app/actions/accidentalidad-actions", () => ({
  updateAccidentalidadStatus: (...args: any[]) => updateStatusSpy(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("AccidentalidadStatusActions", () => {
  afterEach(() => {
    cleanup();
    refreshSpy.mockClear();
    updateStatusSpy.mockReset();
  });

  it("permite aprobar cuando está en revisión y el usuario es admin", async () => {
    updateStatusSpy.mockResolvedValue({ success: true });

    render(
      <AccidentalidadStatusActions
        accidentalidadId="acc-1"
        status="IN_REVIEW"
        userRole="ADMIN_PMD"
        title="FURAT"
        projectName="Empresa X"
        dueDate="2026-03-20"
        documents={[
          {
            id: "d1",
            name: "archivo.pdf",
            url: "https://example.com/archivo.pdf",
            uploadedAt: "2026-03-12T00:00:00.000Z",
          },
        ]}
        onPreview={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Aprobar/i }));

    await waitFor(() => {
      expect(updateStatusSpy).toHaveBeenCalledTimes(1);
      expect(refreshSpy).toHaveBeenCalledTimes(1);
    });
  });
});

