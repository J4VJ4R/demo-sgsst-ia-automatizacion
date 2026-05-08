import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OverviewBarChart } from "../overview-bar-chart";

const push = vi.fn();
const replace = vi.fn();
let params = new URLSearchParams("foo=bar");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => ({
    toString: () => params.toString(),
  }),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  LabelList: () => null,
  Bar: ({ name, onClick }: any) => (
    <button type="button" onClick={() => onClick?.()}>
      {name}
    </button>
  ),
}));

function parseQuery(url: string) {
  const q = url.includes("?") ? url.split("?")[1] : "";
  return new URLSearchParams(q);
}

describe("OverviewBarChart - navegación por click", () => {
  beforeEach(() => {
    push.mockClear();
    replace.mockClear();
    params = new URLSearchParams("foo=bar");
  });

  it("navega a actividades con priority=Por vencer y preserva params + empresa seleccionada", () => {
    render(
      <OverviewBarChart
        data={[{ name: "Ana Martínez", high: 12, medium: 18, low: 8 }]}
        chartMode="prioridad"
        isDark={false}
        selectedCompanyId="c1"
        statusCounts={{ pending: 0, inReview: 0, approved: 0, rejected: 0 }}
        priorityCounts={{ high: 12, medium: 18, low: 8 }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Por vencer" }));

    expect(push).toHaveBeenCalledTimes(1);
    const q = parseQuery(String(push.mock.calls[0][0]));
    expect(q.get("foo")).toBe("bar");
    expect(q.get("priority")).toBe("Por vencer");
    expect(q.get("companyId")).toBe("c1");
  });
});

