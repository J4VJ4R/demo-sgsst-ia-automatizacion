import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { NotificationBell } from "../notification-bell";

const pushSpy = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy }),
}));

const getFilteredNotificationsSpy = vi.fn();
const markNotificationAsReadSpy = vi.fn();

vi.mock("@/app/actions", () => ({
  getFilteredNotifications: (...args: any[]) => getFilteredNotificationsSpy(...args),
  markNotificationAsRead: (...args: any[]) => markNotificationAsReadSpy(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

describe("NotificationBell routing", () => {
  afterEach(() => {
    cleanup();
    pushSpy.mockClear();
    getFilteredNotificationsSpy.mockReset();
    markNotificationAsReadSpy.mockReset();
  });

  it("redirecciona a /activities?status=IN_REVIEW al hacer click en notificación ACTIVITY_REVIEW sin activityId (admin)", async () => {
    // Avoid jsdom Not implemented: HTMLMediaElement.play
    // @ts-expect-error test override
    global.Audio = function () {
      return { play: () => Promise.resolve(), volume: 1 };
    };

    getFilteredNotificationsSpy.mockResolvedValue({
      success: true,
      notifications: [
        {
          id: "n1",
          title: "Actividad en Revisión",
          message: "[ACC:acc-1] La actividad \"FURAT\" de Empresa X ha cambiado a estado de revisión.",
          type: "ACTIVITY_REVIEW",
          priority: "HIGH",
          category: "OPERATIONAL",
          functionalArea: "SST",
          createdAt: new Date().toISOString(),
          activityId: null,
        },
      ],
    });
    markNotificationAsReadSpy.mockResolvedValue({ success: true });

    render(<NotificationBell userRole="ADMIN_PMD" />);

    const trigger = screen.getByRole("button", { name: "Notificaciones" });
    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
    });
    await screen.findByText("Actividad en Revisión");
    expect(screen.getByText(/La actividad "FURAT" de Empresa X ha cambiado a estado de revisión\./)).toBeTruthy();
    fireEvent.click(screen.getByText("Actividad en Revisión"));

    await waitFor(() => {
      expect(pushSpy).toHaveBeenCalledWith("/activities?status=IN_REVIEW&highlight=acc-1");
    });
  });
});
