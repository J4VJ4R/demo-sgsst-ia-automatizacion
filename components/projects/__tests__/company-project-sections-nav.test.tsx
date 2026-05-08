import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

expect.extend(matchers);

vi.mock("@/components/ui/custom-loader", () => ({
  CustomLoader: () => null,
}));

const refreshSpy = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: refreshSpy }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { CompanyProjectSectionsNav } from "@/components/projects/company-project-sections-nav";

type GlobalWithFetch = typeof globalThis & { fetch?: typeof fetch };

describe("CompanyProjectSectionsNav emergency modal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refreshSpy.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    (globalThis as GlobalWithFetch).fetch = undefined;
  });

  it("shows emergency modal after 3 seconds if toggle request hangs and allows cancel", async () => {
    (globalThis as GlobalWithFetch).fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;

    render(
      <CompanyProjectSectionsNav
        projectId="p1"
        sections={{ requirements: true, accidentalidad: true, collaborators: true, "sgsst-design": true, "inspection-maintenance": true }}
        canManage={true}
      />
    );

    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[1]);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByText("Operación en curso")).toBeInTheDocument();
    const cancel = screen.getByRole("button", { name: "Cancelar operación" });
    fireEvent.click(cancel);
    expect(screen.queryByText("Operación en curso")).not.toBeInTheDocument();
  });
});
