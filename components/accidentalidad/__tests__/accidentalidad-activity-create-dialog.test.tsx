import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { AccidentalidadActivityCreateDialog } from "../accidentalidad-activity-create-dialog";

const toastSuccess = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...args: any[]) => toastSuccess(...args),
    error: vi.fn(),
  },
}));

function tomorrowYYYYMMDD() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

describe("AccidentalidadActivityCreateDialog", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    // @ts-expect-error test override
    global.fetch = vi.fn();
  });
  afterEach(() => {
    cleanup();
  });

  it("muestra validaciones de campos obligatorios", async () => {
    render(
      <AccidentalidadActivityCreateDialog
        projectId="p1"
        canCreate={true}
        onCreated={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Agregar actividad" }));

    expect(
      await screen.findByText(
        "Crea una nueva actividad de accidentalidad para esta empresa."
      )
    ).toBeTruthy();
    expect(screen.getByText("Nombre de la actividad es requerido.")).toBeTruthy();
  });

  it("valida longitud máxima (100) y fecha futura", async () => {
    render(
      <AccidentalidadActivityCreateDialog
        projectId="p1"
        canCreate={true}
        onCreated={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Agregar actividad" }));
    await screen.findByText("Crea una nueva actividad de accidentalidad para esta empresa.");

    fireEvent.change(screen.getByLabelText(/Nombre de la actividad/i), {
      target: { value: "a".repeat(101) },
    });
    expect(
      screen.getByText("Nombre de la actividad debe tener máximo 100 caracteres.")
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Nombre de la actividad/i), {
      target: { value: "Actividad nueva" },
    });

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;

    fireEvent.change(screen.getByLabelText(/Fecha de vencimiento/i), {
      target: { value: todayStr },
    });

    expect(screen.getByText("La fecha de vencimiento debe ser futura.")).toBeTruthy();
  });

  it("envía el formulario, cierra el modal y dispara onCreated", async () => {
    const onCreated = vi.fn();
    // @ts-expect-error test override
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        row: {
          id: "a1",
          actividad: "Actividad nueva",
          status: "PENDING",
          priority: "Cumplido",
          dueDate: "2026-12-31T00:00:00.000Z",
          createdAt: "2026-03-12T00:00:00.000Z",
          archivos: [],
        },
      }),
    });

    render(
      <AccidentalidadActivityCreateDialog
        projectId="p1"
        canCreate={true}
        onCreated={onCreated}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Agregar actividad" }));
    await screen.findByText("Crea una nueva actividad de accidentalidad para esta empresa.");

    fireEvent.change(screen.getByLabelText(/Nombre de la actividad/i), {
      target: { value: "Actividad nueva" },
    });
    fireEvent.change(screen.getByLabelText(/Fecha de vencimiento/i), {
      target: { value: tomorrowYYYYMMDD() },
    });

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(1);
      expect(toastSuccess).toHaveBeenCalledWith("Actividad creada correctamente");
    });

    await waitFor(() => {
      expect(screen.queryByText("Crea una nueva actividad de accidentalidad para esta empresa.")).toBeNull();
    });
  });
});
