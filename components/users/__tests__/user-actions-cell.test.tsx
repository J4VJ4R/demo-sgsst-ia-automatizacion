import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { UserActionsCell } from "../user-actions-cell";

afterEach(() => {
  cleanup();
});

vi.mock("@/app/actions", () => ({
  deleteUser: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../user-dialog", () => ({
  UserDialog: () => null,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onSelect }: any) => (
    <button onClick={() => onSelect?.()}>{children}</button>
  ),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  MoreVertical: () => <div />,
  Eye: () => <div>Eye</div>,
  Pencil: () => <div />,
  Trash: () => <div />,
}));

describe("UserActionsCell - detalle cliente", () => {
  it("muestra consultor asignado (nombre y email) cuando existe", () => {
    render(
      <UserActionsCell
        user={{
          id: "u1",
          name: "Javier Jaramillo",
          email: "javierprueba1@gmail.com",
          role: "CLIENT_VIEWER",
          clientProjects: [
            {
              id: "p1",
              name: "Empresa de prueba Javier 1",
              consultant: {
                id: "c1",
                name: "Consultor 1",
                email: "consultor1@pmd.com",
              },
            },
          ],
        }}
      />
    );

    fireEvent.click(screen.getAllByText("Ver")[0]);

    expect(screen.getByText("Consultor asignado")).toBeTruthy();
    expect(screen.getByText("Consultor 1")).toBeTruthy();
    expect(screen.getByText("consultor1@pmd.com")).toBeTruthy();
    expect(screen.queryByText("Contacto")).toBeNull();
  });

  it("muestra fallback cuando el cliente no tiene consultor asignado", () => {
    render(
      <UserActionsCell
        user={{
          id: "u2",
          name: "Cliente Sin Consultor",
          email: "cliente@empresa.com",
          role: "CLIENT_VIEWER",
          clientProjects: [
            {
              id: "p2",
              name: "Empresa X",
              consultant: null,
            },
          ],
        }}
      />
    );

    fireEvent.click(screen.getAllByText("Ver")[0]);
    expect(screen.getByText("Consultor asignado")).toBeTruthy();
    expect(screen.getAllByText("Sin consultor asignado").length).toBeGreaterThan(0);
  });
});
