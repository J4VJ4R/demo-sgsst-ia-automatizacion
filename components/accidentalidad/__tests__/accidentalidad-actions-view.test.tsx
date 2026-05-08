import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AccidentalidadRequirementActions } from "../accidentalidad-requirement-actions";

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...args: any[]) => toastSuccess(...args),
    error: (...args: any[]) => toastError(...args),
  },
}));

const createUploadReq = vi.fn();
const finalizeUpload = vi.fn();

vi.mock("@/app/actions/accidentalidad-actions", () => ({
  createAccidentalidadUploadRequest: (...args: any[]) => createUploadReq(...args),
  finalizeAccidentalidadUpload: (...args: any[]) => finalizeUpload(...args),
  getAccidentalidadFileHistory: vi.fn(),
  removeAccidentalidadFile: vi.fn(),
}));

vi.mock("@/components/documents/document-preview", () => ({
  DocumentPreview: ({ document, onClose }: any) => (
    <div>
      <div>PREVIEW:{document?.name}</div>
      <button type="button" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

describe("AccidentalidadRequirementActions - Ver / Carga", () => {
  afterEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    createUploadReq.mockReset();
    finalizeUpload.mockReset();
    cleanup();
  });

  it("renderiza Ver cuando hay archivo y muestra preview al click", () => {
    render(
      <AccidentalidadRequirementActions
        accidentalidadId="a1"
        actividadTitle="Actividad"
        projectName="Empresa X"
        dueDate="2026-12-31"
        status="PENDING"
        latestDoc={{ id: "f1", name: "archivo.pdf", url: "https://example.com/archivo.pdf" }}
        documents={[]}
        canManage={true}
        canDelete={true}
      />
    );

    const ver = screen.getByRole("button", { name: "Ver" });
    expect(ver).toBeTruthy();
    fireEvent.click(ver);
    expect(screen.getByText("PREVIEW:archivo.pdf")).toBeTruthy();
  });

  it("no renderiza Ver cuando no hay archivo", () => {
    render(
      <AccidentalidadRequirementActions
        accidentalidadId="a1"
        actividadTitle="Actividad"
        projectName="Empresa X"
        dueDate="2026-12-31"
        status="PENDING"
        latestDoc={null}
        documents={[]}
        canManage={true}
        canDelete={true}
      />
    );

    expect(screen.queryByRole("button", { name: "Ver" })).toBeNull();
  });

  it("deshabilita la carga cuando la prioridad es Cumplido", () => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const due = `${yyyy}-${mm}-${dd}`;

    render(
      <AccidentalidadRequirementActions
        accidentalidadId="a1"
        actividadTitle="Actividad"
        projectName="Empresa X"
        dueDate={due}
        status="PENDING"
        latestDoc={null}
        documents={[]}
        canManage={true}
        canDelete={false}
      />
    );

    const upload = screen.getByRole("button", { name: /Carga de archivo/i }) as HTMLButtonElement;
    expect(upload.disabled).toBe(true);
  });

  it("sube archivo y notifica cambios sin recargar", async () => {
    // @ts-expect-error test override
    global.fetch = vi.fn().mockResolvedValue({ ok: true });

    createUploadReq.mockResolvedValue({
      success: true,
      uploadUrl: "https://s3.example.com/upload",
      key: "accidentalidad/a1/f1.pdf",
      originalName: "test.pdf",
    });
    finalizeUpload.mockResolvedValue({
      success: true,
      url: "https://cdn.example.com/test.pdf",
      file: {
        id: "file-1",
        name: "test.pdf",
        url: "https://cdn.example.com/test.pdf",
        uploadedAt: "2026-03-12T00:00:00.000Z",
        version: 1,
        sizeBytes: 3,
      },
    });

    const onDocumentsChange = vi.fn();
    render(
      <AccidentalidadRequirementActions
        accidentalidadId="a1"
        actividadTitle="Actividad"
        projectName="Empresa X"
        dueDate="2026-03-20"
        status="PENDING"
        latestDoc={null}
        documents={[]}
        canManage={true}
        canDelete={false}
        onDocumentsChange={onDocumentsChange}
      />
    );

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["abc"], "test.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const confirm = await screen.findByRole("button", { name: /Aceptar y cargar/i });
    fireEvent.click(confirm);

    await new Promise((r) => setTimeout(r, 0));
    expect(createUploadReq).toHaveBeenCalledTimes(1);
    expect(finalizeUpload).toHaveBeenCalledTimes(1);
    expect(onDocumentsChange).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalled();
  });
});
