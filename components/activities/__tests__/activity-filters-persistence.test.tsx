import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import { ActivityList } from "../activity-list";

let currentParams = new URLSearchParams("");

const mockRouter = {
  replace: vi.fn((href: string) => {
    const q = href.includes("?") ? href.split("?")[1] : "";
    currentParams = new URLSearchParams(q);
  }),
  refresh: vi.fn(),
  push: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => ({
    get: (key: string) => currentParams.get(key),
    toString: () => currentParams.toString(),
  }),
}));

vi.mock("@/hooks/use-real-time-refresh", () => ({
  useRealTimeRefresh: () => undefined,
}));

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("lucide-react", () => ({
  ChevronLeft: () => <div />,
  ChevronRight: () => <div />,
  Filter: () => <div />,
  Search: () => <div />,
  CheckCircle: () => <div />,
  Eye: () => <div />,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/table", () => ({
  Table: ({ children }: any) => <table>{children}</table>,
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableRow: ({ children }: any) => <tr>{children}</tr>,
  TableHead: ({ children }: any) => <th>{children}</th>,
  TableCell: ({ children }: any) => <td>{children}</td>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: any) => <span>{children}</span>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({ value, onChange, ...props }: any) => (
    <input value={value} onChange={onChange} {...props} />
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/activities/activity-status-actions", () => ({
  ActivityStatusActions: () => null,
}));

vi.mock("@/components/documents/document-preview", () => ({
  DocumentPreview: () => null,
}));

vi.mock("@/app/actions", () => ({
  getAdminActivities: vi.fn(),
}));

describe("ActivityList - persistencia de filtros", () => {
  beforeEach(() => {
    currentParams = new URLSearchParams("");
    mockRouter.replace.mockClear();
    mockRouter.refresh.mockClear();
    mockRouter.push.mockClear();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("mantiene En revisión activo y lo refleja en la URL", async () => {
    render(
      <ActivityList
        activities={[]}
        userRole="ADMIN_PMD"
        adminUsers={[]}
        currentUserId="u1"
      />
    );

    mockRouter.replace.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "En revisión" }));

    expect(mockRouter.replace).toHaveBeenCalledWith("/activities?status=IN_REVIEW");
    expect(screen.getByRole("button", { name: "En revisión" }).getAttribute("aria-pressed")).toBe(
      "true"
    );

    await waitFor(() => {
      const raw = window.localStorage.getItem("activitiesFilters:v2");
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw as string) as { statuses?: string[] };
      expect(parsed.statuses).toEqual(["IN_REVIEW"]);
    });
  });

  it("el filtro de estado es single-select (desactiva el estado anterior)", async () => {
    render(
      <ActivityList
        activities={[]}
        userRole="ADMIN_PMD"
        adminUsers={[]}
        currentUserId="u1"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Pendiente" }));
    expect(currentParams.get("status")).toBe("PENDING");

    fireEvent.click(screen.getByRole("button", { name: "En revisión" }));
    expect(currentParams.get("status")).toBe("IN_REVIEW");
  });

  it("al seleccionar un estado, desactiva la categoría activa (bidireccional 1/2)", async () => {
    currentParams = new URLSearchParams("companyId=p1&priority=Cumplido");

    render(
      <ActivityList
        activities={[]}
        userRole="ADMIN_PMD"
        adminUsers={[]}
        currentUserId="u1"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "En revisión" }));
    expect(currentParams.get("status")).toBe("IN_REVIEW");
    expect(currentParams.get("priority")).toBeNull();
  });

  it("al seleccionar una categoría, desactiva el estado activo (bidireccional 2/2)", async () => {
    currentParams = new URLSearchParams("companyId=p1&status=IN_REVIEW");

    render(
      <ActivityList
        activities={[]}
        userRole="ADMIN_PMD"
        adminUsers={[]}
        currentUserId="u1"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Vencido" }));
    expect(currentParams.get("priority")).toBe("Vencido");
    expect(currentParams.get("status")).toBeNull();
  });

  it("restaura el filtro desde localStorage cuando se entra sin query params", async () => {
    window.localStorage.setItem(
      "activitiesFilters:v2",
      JSON.stringify({
        statuses: ["IN_REVIEW"],
        companyIds: [],
        companyQuery: "",
        priority: null,
        dateRange: "all",
      })
    );

    render(
      <ActivityList
        activities={[]}
        userRole="ADMIN_PMD"
        adminUsers={[]}
        currentUserId="u1"
      />
    );

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith("/activities?status=IN_REVIEW");
    });
  });

  it("al cambiar la categoría desde Vencido a Por vencer, actualiza la URL y preserva la empresa", async () => {
    currentParams = new URLSearchParams("companyId=p1&priority=Vencido");

    render(
      <ActivityList
        activities={[]}
        userRole="ADMIN_PMD"
        adminUsers={[]}
        currentUserId="u1"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Por vencer" }));

    expect(currentParams.get("companyId")).toBe("p1");
    expect(currentParams.get("priority")).toBe("Por vencer");
  });

  it("actualiza companyQuery en la URL después del debounce del buscador", async () => {
    vi.useFakeTimers();
    try {
      render(
        <ActivityList
          activities={[]}
          userRole="ADMIN_PMD"
          adminUsers={[]}
          currentUserId="u1"
        />
      );

      const input = screen.getByPlaceholderText("Buscar empresa por nombre o NIT...");
      fireEvent.change(input, { target: { value: "Acme" } });

      await act(async () => {
        vi.advanceTimersByTime(350);
      });
      expect(currentParams.get("companyQuery")).toBe("Acme");
    } finally {
      vi.useRealTimers();
    }
  });
});
