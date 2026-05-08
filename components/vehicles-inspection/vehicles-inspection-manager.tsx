"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye, FileDown, FileText, X } from "lucide-react";
import {
  createVehicleInspectionUploadRequest,
  createVehicleInspectionVehicle,
  deleteVehicleInspectionVehicle,
  listVehicleInspectionDocuments,
  updateVehicleInspectionVehicle,
} from "@/app/vehicles-inspection-actions";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type DriverOption = { id: string; name: string };
type VehicleListItem = {
  id: string;
  plate: string;
  brand: string | null;
  line: string | null;
  model: string | null;
  vin: string | null;
  engineNumber: string | null;
  transitLicense: string | null;
  displacement: string | null;
  color: string | null;
  mileage: string | null;
  ownerName: string | null;
  ownerId: string | null;
  verificationDate: string;
  soatDueDate: string | null;
  rtmDueDate: string | null;
  documentsCount: number;
  driver: { id: string; name: string } | null;
};

type VehicleDocument = {
  id: string;
  kind: string;
  name: string;
  url: string;
  uploadedAt: string;
};

function FieldRow(props: { label: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-start gap-2 border-b border-slate-200 py-3 sm:grid-cols-[320px_1fr_220px] sm:items-center">
      <div className="text-sm font-medium text-slate-900">{props.label}</div>
      <div className="min-w-0">{props.children}</div>
      <div className="text-sm text-slate-500">{props.right || ""}</div>
    </div>
  );
}

export function VehiclesInspectionManager(props: {
  projectId: string;
  canManage: boolean;
  driverOptions: DriverOption[];
  initialVehicles: VehicleListItem[];
}) {
  const router = useRouter();
  const soatInputRef = useRef<HTMLInputElement | null>(null);
  const rtmInputRef = useRef<HTMLInputElement | null>(null);
  const propertyCardInputRef = useRef<HTMLInputElement | null>(null);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [openView, setOpenView] = useState(false);
  const [viewTarget, setViewTarget] = useState<VehicleListItem | null>(null);
  const [viewDocs, setViewDocs] = useState<VehicleDocument[]>([]);
  const [viewDocsLoading, setViewDocsLoading] = useState(false);
  const [viewDocsError, setViewDocsError] = useState<string | null>(null);
  const [openDocViewer, setOpenDocViewer] = useState(false);
  const [docViewerTarget, setDocViewerTarget] = useState<VehicleDocument | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VehicleListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dueField, setDueField] = useState<"ANY" | "SOAT" | "RTM">("ANY");
  const [dueFilter, setDueFilter] = useState<"ALL" | "VIGENTE" | "POR_VENCER" | "VENCIDO">("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [verificationDate, setVerificationDate] = useState("");
  const [plate, setPlate] = useState("");
  const [vin, setVin] = useState("");
  const [engineNumber, setEngineNumber] = useState("");
  const [model, setModel] = useState("");
  const [transitLicense, setTransitLicense] = useState("");
  const [brand, setBrand] = useState("");
  const [line, setLine] = useState("");
  const [displacement, setDisplacement] = useState("");
  const [color, setColor] = useState("");
  const [mileage, setMileage] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [soatDueDate, setSoatDueDate] = useState("");
  const [soatFile, setSoatFile] = useState<File | null>(null);
  const [rtmDueDate, setRtmDueDate] = useState("");
  const [rtmFile, setRtmFile] = useState<File | null>(null);
  const [propertyCardFile, setPropertyCardFile] = useState<File | null>(null);

  const canSubmit = useMemo(() => {
    return verificationDate.trim().length > 0 && plate.trim().length > 0 && !saving;
  }, [plate, saving, verificationDate]);

  const reset = () => {
    setVerificationDate("");
    setPlate("");
    setVin("");
    setEngineNumber("");
    setModel("");
    setTransitLicense("");
    setBrand("");
    setLine("");
    setDisplacement("");
    setColor("");
    setMileage("");
    setOwnerName("");
    setOwnerId("");
    setDriverId("");
    setSoatDueDate("");
    setSoatFile(null);
    setRtmDueDate("");
    setRtmFile(null);
    setPropertyCardFile(null);
  };

  function dueClassify(iso: string | null) {
    if (!iso) return "SIN_FECHA";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "INVALIDA";
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return "VENCIDO";
    if (diffDays <= 15) return "POR_VENCER";
    return "VIGENTE";
  }

  const filteredVehicles = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byQuery = (v: VehicleListItem) => {
      const haystack = [
        v.plate,
        v.brand || "",
        v.line || "",
        v.model || "",
        v.driver?.name || "",
      ]
        .join(" ")
        .toLowerCase();
      return q ? haystack.includes(q) : true;
    };
    const byDue = (v: VehicleListItem) => {
      if (dueFilter === "ALL") return true;
      const soat = dueClassify(v.soatDueDate);
      const rtm = dueClassify(v.rtmDueDate);

      if (dueField === "SOAT") {
        return (
          (dueFilter === "VIGENTE" && soat === "VIGENTE") ||
          (dueFilter === "POR_VENCER" && soat === "POR_VENCER") ||
          (dueFilter === "VENCIDO" && soat === "VENCIDO")
        );
      }

      if (dueField === "RTM") {
        return (
          (dueFilter === "VIGENTE" && rtm === "VIGENTE") ||
          (dueFilter === "POR_VENCER" && rtm === "POR_VENCER") ||
          (dueFilter === "VENCIDO" && rtm === "VENCIDO")
        );
      }

      if (dueFilter === "VENCIDO") return soat === "VENCIDO" || rtm === "VENCIDO";
      if (dueFilter === "POR_VENCER") {
        const anyPorVencer = soat === "POR_VENCER" || rtm === "POR_VENCER";
        const anyVencido = soat === "VENCIDO" || rtm === "VENCIDO";
        return anyPorVencer && !anyVencido;
      }

      const anyVencidoOrPorVencer =
        soat === "VENCIDO" || soat === "POR_VENCER" || rtm === "VENCIDO" || rtm === "POR_VENCER";
      return !anyVencidoOrPorVencer;
    };
    return props.initialVehicles.filter((v) => byQuery(v) && byDue(v));
  }, [props.initialVehicles, query, dueField, dueFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, dueField, dueFilter, pageSize]);

  const formatDate = (iso: string | null) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("es-CO");
  };

  const dueInfo = (iso: string | null) => {
    if (!iso) return { text: "Sin fecha", className: "border-slate-200 text-slate-600" };
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { text: "Inválida", className: "border-slate-200 text-slate-600" };
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { text: "Vencido", className: "bg-red-600 text-white border-red-600" };
    if (diffDays <= 15) return { text: "Por vencer", className: "bg-yellow-500 text-black border-yellow-500" };
    return { text: "Vigente", className: "bg-emerald-600 text-white border-emerald-600" };
  };

  const totalPages = useMemo(() => {
    const pages = Math.ceil(filteredVehicles.length / pageSize);
    return pages > 0 ? pages : 1;
  }, [filteredVehicles.length, pageSize]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const pagedVehicles = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredVehicles.slice(start, start + pageSize);
  }, [filteredVehicles, page, pageSize]);

  const exportRows = useMemo(() => {
    return filteredVehicles.map((v) => ({
      Placa: v.plate,
      Marca: v.brand || "",
      Línea: v.line || "",
      Modelo: v.model || "",
      Conductor: v.driver?.name || "",
      Verificación: formatDate(v.verificationDate),
      "SOAT (fecha)": formatDate(v.soatDueDate),
      "SOAT (estado)": dueInfo(v.soatDueDate).text,
      "RTM (fecha)": formatDate(v.rtmDueDate),
      "RTM (estado)": dueInfo(v.rtmDueDate).text,
      Documentos: v.documentsCount,
    }));
  }, [filteredVehicles]);

  const handleExportExcel = async () => {
    const mod = await import("xlsx");
    const wb = mod.utils.book_new();
    const ws = mod.utils.json_to_sheet(exportRows);
    mod.utils.book_append_sheet(wb, ws, "Vehículos");
    const safeDate = new Date().toISOString().slice(0, 10);
    mod.writeFile(wb, `vehiculos-${props.projectId}-${safeDate}.xlsx`);
  };

  const handleExportPdf = async () => {
    const { jsPDF } = await import("jspdf");
    await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(12);
    doc.text("Listado de Vehículos", 14, 14);
    doc.setFontSize(9);
    doc.text(`Proyecto: ${props.projectId}`, 14, 20);
    doc.text(`Generado: ${new Date().toLocaleString("es-CO")}`, 14, 26);

    const head = [
      ["Placa", "Marca", "Línea", "Modelo", "Conductor", "Verificación", "SOAT", "Estado SOAT", "RTM", "Estado RTM", "Docs"],
    ];
    const body = filteredVehicles.map((v) => [
      v.plate,
      v.brand || "",
      v.line || "",
      v.model || "",
      v.driver?.name || "",
      formatDate(v.verificationDate),
      formatDate(v.soatDueDate),
      dueInfo(v.soatDueDate).text,
      formatDate(v.rtmDueDate),
      dueInfo(v.rtmDueDate).text,
      String(v.documentsCount),
    ]);

    (doc as any).autoTable({
      head,
      body,
      startY: 32,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [212, 175, 55], textColor: [0, 0, 0] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 10, right: 10 },
    });

    const safeDate = new Date().toISOString().slice(0, 10);
    doc.save(`vehiculos-${props.projectId}-${safeDate}.pdf`);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!openView || !viewTarget) return;
      setViewDocs([]);
      setViewDocsError(null);
      setViewDocsLoading(true);
      try {
        const res = await listVehicleInspectionDocuments({ projectId: props.projectId, vehicleId: viewTarget.id });
        if (!res.success) throw new Error(res.error || "No se pudieron cargar los documentos.");
        if (cancelled) return;
        setViewDocs(res.documents);
      } catch (e) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "No se pudieron cargar los documentos.";
        setViewDocsError(message);
      } finally {
        if (!cancelled) setViewDocsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [openView, viewTarget?.id, props.projectId]);

  const docByKind = useMemo(() => {
    const out: Record<string, VehicleDocument | null> = { SOAT: null, RTM: null, PROPERTY_CARD: null };
    for (const d of viewDocs) {
      if (!out[d.kind]) out[d.kind] = d;
    }
    return out;
  }, [viewDocs]);

  const isImageUrl = (url: string) => {
    return /\.(png|jpg|jpeg|webp|gif)$/i.test(url.split("?")[0] || "");
  };
  const isPdfUrl = (url: string) => {
    return /\.pdf$/i.test(url.split("?")[0] || "");
  };
  const openViewer = (doc: VehicleDocument) => {
    setDocViewerTarget(doc);
    setOpenDocViewer(true);
    setOpenView(false);
  };

  const orderedDocsForViewer = useMemo(() => {
    const priority: Record<string, number> = { SOAT: 0, RTM: 1, PROPERTY_CARD: 2 };
    return [...viewDocs].sort((a, b) => {
      const pa = priority[a.kind] ?? 99;
      const pb = priority[b.kind] ?? 99;
      if (pa !== pb) return pa - pb;
      return a.name.localeCompare(b.name);
    });
  }, [viewDocs]);

  const docViewerIndex = useMemo(() => {
    if (!docViewerTarget) return -1;
    return orderedDocsForViewer.findIndex((d) => d.id === docViewerTarget.id);
  }, [docViewerTarget, orderedDocsForViewer]);

  const openPrevDoc = () => {
    if (docViewerIndex <= 0) return;
    setDocViewerTarget(orderedDocsForViewer[docViewerIndex - 1] || null);
  };

  const openNextDoc = () => {
    if (docViewerIndex < 0) return;
    if (docViewerIndex >= orderedDocsForViewer.length - 1) return;
    setDocViewerTarget(orderedDocsForViewer[docViewerIndex + 1] || null);
  };

  const canPortal = typeof document !== "undefined";

  return (
    <Card className="gap-2 py-3">
      <CardHeader className="px-3 gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-1">
          <CardTitle>Listado de Vehículos</CardTitle>
          <p className="text-sm leading-[1.5] text-slate-600">Administra inspecciones de vehículos.</p>
        </div>
        <Button
          className="bg-[#D4AF37] text-black hover:bg-[#B59530]"
          disabled={!props.canManage}
          onClick={() => setOpen(true)}
        >
          Añadir vehículo
        </Button>
      </CardHeader>
      <CardContent className="px-3 pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por placa, marca, línea, modelo o conductor…"
              className="w-full sm:max-w-[520px]"
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="grid gap-2">
                <div className="text-sm font-medium text-slate-700">Vencimiento</div>
                <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={dueField === "ANY" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDueField("ANY")}
                  className={dueField === "ANY" ? "bg-[#D4AF37] text-black hover:bg-[#B59530]" : ""}
                >
                  Cualquiera
                </Button>
                <Button
                  type="button"
                  variant={dueField === "SOAT" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDueField("SOAT")}
                  className={dueField === "SOAT" ? "bg-[#D4AF37] text-black hover:bg-[#B59530]" : ""}
                >
                  SOAT
                </Button>
                <Button
                  type="button"
                  variant={dueField === "RTM" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDueField("RTM")}
                  className={dueField === "RTM" ? "bg-[#D4AF37] text-black hover:bg-[#B59530]" : ""}
                >
                  RTM
                </Button>
              </div>
              </div>
              <div className="grid gap-2">
                <div className="text-sm font-medium text-slate-700">Estado</div>
                <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={dueFilter === "ALL" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDueFilter("ALL")}
                  className={dueFilter === "ALL" ? "bg-[#D4AF37] text-black hover:bg-[#B59530]" : ""}
                >
                  Todos
                </Button>
                <Button
                  type="button"
                  variant={dueFilter === "VIGENTE" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDueFilter("VIGENTE")}
                  className={dueFilter === "VIGENTE" ? "bg-[#D4AF37] text-black hover:bg-[#B59530]" : ""}
                >
                  Vigentes
                </Button>
                <Button
                  type="button"
                  variant={dueFilter === "POR_VENCER" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDueFilter("POR_VENCER")}
                  className={dueFilter === "POR_VENCER" ? "bg-[#D4AF37] text-black hover:bg-[#B59530]" : ""}
                >
                  Por vencer
                </Button>
                <Button
                  type="button"
                  variant={dueFilter === "VENCIDO" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDueFilter("VENCIDO")}
                  className={dueFilter === "VENCIDO" ? "bg-[#D4AF37] text-black hover:bg-[#B59530]" : ""}
                >
                  Vencidos
                </Button>
              </div>
            </div>
          </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-600">
              {filteredVehicles.length} vehículo{filteredVehicles.length === 1 ? "" : "s"} · Página {page} de {totalPages}
            </div>
            <div className="grid gap-2 sm:flex sm:flex-row sm:items-center sm:gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleExportExcel}>
                  <FileDown className="h-4 w-4" />
                  Excel
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleExportPdf}>
                  <FileText className="h-4 w-4" />
                  PDF
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-600">Mostrar</span>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="h-9 w-[90px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-start gap-1 sm:justify-end">
                <Button type="button" variant="outline" size="sm" onClick={() => setPage(1)} disabled={page <= 1}>
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page >= totalPages}>
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-4">
            {filteredVehicles.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-600">Aún no hay vehículos registrados.</div>
            ) : (
              <>
                <div className="lg:hidden grid gap-3">
                  {pagedVehicles.map((v) => (
                    <div key={v.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-base font-semibold text-slate-900">{v.plate}</div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setViewTarget(v);
                              setOpenView(true);
                            }}
                            aria-label="Ver"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            className="h-8 px-2"
                            onClick={() => {
                              setEditingVehicleId(v.id);
                              setVerificationDate(v.verificationDate?.slice(0, 10) || "");
                              setPlate(v.plate);
                              setBrand(v.brand || "");
                              setLine(v.line || "");
                              setModel(v.model || "");
                              setVin(v.vin || "");
                              setEngineNumber(v.engineNumber || "");
                              setTransitLicense(v.transitLicense || "");
                              setDisplacement(v.displacement || "");
                              setColor(v.color || "");
                              setMileage(v.mileage || "");
                              setOwnerName(v.ownerName || "");
                              setOwnerId(v.ownerId || "");
                              setDriverId(v.driver?.id || "");
                              setSoatDueDate(v.soatDueDate?.slice(0, 10) || "");
                              setRtmDueDate(v.rtmDueDate?.slice(0, 10) || "");
                              setOpen(true);
                            }}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            className="h-8 px-2"
                            onClick={() => {
                              setDeleteTarget(v);
                              setConfirmDelete(true);
                            }}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-slate-500">Marca</div>
                          <div>{v.brand || "-"}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Línea</div>
                          <div>{v.line || "-"}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Modelo</div>
                          <div>{v.model || "-"}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Conductor</div>
                          <div>{v.driver?.name || "-"}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Verificación</div>
                          <div>{formatDate(v.verificationDate)}</div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-slate-500">Vencimientos</div>
                          <div className="mt-1 grid gap-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-600">SOAT</span>
                              <div className="flex items-center gap-2">
                                <span>{formatDate(v.soatDueDate)}</span>
                                <Badge variant="outline" className={dueInfo(v.soatDueDate).className}>
                                  {dueInfo(v.soatDueDate).text}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-600">RTM</span>
                              <div className="flex items-center gap-2">
                                <span>{formatDate(v.rtmDueDate)}</span>
                                <Badge variant="outline" className={dueInfo(v.rtmDueDate).className}>
                                  {dueInfo(v.rtmDueDate).text}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-500">Docs</div>
                          <div>{v.documentsCount}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Placa</TableHead>
                        <TableHead>Marca</TableHead>
                        <TableHead>Línea</TableHead>
                        <TableHead>Modelo</TableHead>
                        <TableHead>Conductor</TableHead>
                        <TableHead>Verificación</TableHead>
                        <TableHead>Vencimientos</TableHead>
                        <TableHead>Docs</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedVehicles.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-medium text-slate-900">{v.plate}</TableCell>
                          <TableCell>{v.brand || "-"}</TableCell>
                          <TableCell>{v.line || "-"}</TableCell>
                          <TableCell>{v.model || "-"}</TableCell>
                          <TableCell>{v.driver?.name || "-"}</TableCell>
                          <TableCell>{formatDate(v.verificationDate)}</TableCell>
                          <TableCell>
                            <div className="grid gap-1">
                              <div className="flex items-center gap-2">
                                <span className="w-10 text-xs font-medium text-slate-600">SOAT</span>
                                <span className="text-sm">{formatDate(v.soatDueDate)}</span>
                                <Badge variant="outline" className={dueInfo(v.soatDueDate).className}>
                                  {dueInfo(v.soatDueDate).text}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="w-10 text-xs font-medium text-slate-600">RTM</span>
                                <span className="text-sm">{formatDate(v.rtmDueDate)}</span>
                                <Badge variant="outline" className={dueInfo(v.rtmDueDate).className}>
                                  {dueInfo(v.rtmDueDate).text}
                                </Badge>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{v.documentsCount}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setViewTarget(v);
                                  setOpenView(true);
                                }}
                                aria-label="Ver"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                className="h-8 px-2"
                                onClick={() => {
                                  setEditingVehicleId(v.id);
                                  setVerificationDate(v.verificationDate?.slice(0, 10) || "");
                                  setPlate(v.plate);
                                  setBrand(v.brand || "");
                                  setLine(v.line || "");
                                  setModel(v.model || "");
                                  setVin(v.vin || "");
                                  setEngineNumber(v.engineNumber || "");
                                  setTransitLicense(v.transitLicense || "");
                                  setDisplacement(v.displacement || "");
                                  setColor(v.color || "");
                                  setMileage(v.mileage || "");
                                  setOwnerName(v.ownerName || "");
                                  setOwnerId(v.ownerId || "");
                                  setDriverId(v.driver?.id || "");
                                  setSoatDueDate(v.soatDueDate?.slice(0, 10) || "");
                                  setRtmDueDate(v.rtmDueDate?.slice(0, 10) || "");
                                  setOpen(true);
                                }}
                              >
                                Editar
                              </Button>
                              <Button
                                variant="outline"
                                className="h-8 px-2"
                                onClick={() => {
                                  setDeleteTarget(v);
                                  setConfirmDelete(true);
                                }}
                              >
                                Eliminar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        </div>

        <Dialog open={openView} onOpenChange={setOpenView}>
          <DialogContent
            showCloseButton={false}
            className="sm:max-w-[680px] border-[#D4AF37]/30 p-0 overflow-hidden"
            onPointerDownOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
          >
            <div className="flex max-h-[90vh] flex-col">
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80">
                <DialogTitle className="text-[#D4AF37]">Detalle del vehículo</DialogTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpenView(false)}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                  Cerrar
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {viewTarget ? (
                  <div className="grid gap-2 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Placa</span>
                  <span className="font-medium text-slate-900">{viewTarget.plate}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Marca</span>
                  <span>{viewTarget.brand || "-"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Línea</span>
                  <span>{viewTarget.line || "-"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Modelo</span>
                  <span>{viewTarget.model || "-"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Conductor</span>
                  <span>{viewTarget.driver?.name || "-"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Fecha de verificación</span>
                  <span>{formatDate(viewTarget.verificationDate)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">SOAT vence</span>
                  <span>{formatDate(viewTarget.soatDueDate)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">RTM vence</span>
                  <span>{formatDate(viewTarget.rtmDueDate)}</span>
                </div>
                <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Documentos</span>
                    <span className="text-slate-700">
                      {viewDocsLoading ? "Cargando…" : viewDocs.length}
                    </span>
                  </div>
                  {viewDocsError ? <div className="text-sm text-red-600">{viewDocsError}</div> : null}
                  <div className="grid gap-2">
                    {(
                      [
                        { kind: "SOAT", label: "SOAT" },
                        { kind: "RTM", label: "RTM" },
                        { kind: "PROPERTY_CARD", label: "Tarjeta de propiedad" },
                      ] as const
                    ).map((k) => {
                      const doc = docByKind[k.kind];
                      return (
                        <div key={k.kind} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900">{k.label}</div>
                            <div className="text-xs text-slate-600 truncate">
                              {doc ? doc.name : "Sin documento"}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!doc}
                            onClick={() => {
                              if (!doc) return;
                              openViewer(doc);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                            Ver
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">VIN</span>
                    <span>{viewTarget.vin || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Motor</span>
                    <span>{viewTarget.engineNumber || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Licencia tránsito</span>
                    <span>{viewTarget.transitLicense || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Cilindraje</span>
                    <span>{viewTarget.displacement || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Color</span>
                    <span>{viewTarget.color || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Kilometraje</span>
                    <span>{viewTarget.mileage || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Propietario</span>
                    <span>{viewTarget.ownerName || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Cédula/NIT</span>
                    <span>{viewTarget.ownerId || "-"}</span>
                  </div>
                </div>
                  </div>
                ) : null}
              </div>

              <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                <Button
                  type="button"
                  className="w-full bg-[#D4AF37] text-black hover:bg-[#B59530]"
                  onClick={() => setOpenView(false)}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {canPortal && openDocViewer && docViewerTarget
          ? createPortal(
              <div className="fixed inset-0 z-[30000] bg-black/70">
                <div className="mx-auto flex h-[100dvh] w-full flex-col overflow-hidden bg-white sm:my-6 sm:h-auto sm:max-h-[90vh] sm:max-w-[920px] sm:rounded-xl sm:border sm:border-slate-200 sm:shadow-lg">
                  <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
                    <div className="flex items-center justify-between gap-3 px-3 py-3 sm:px-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{docViewerTarget.name}</div>
                        <div className="text-xs text-slate-600">
                          {docViewerTarget.kind}
                          {docViewerIndex >= 0 ? ` · ${docViewerIndex + 1}/${orderedDocsForViewer.length}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button asChild type="button" variant="outline" size="sm">
                          <a href={docViewerTarget.url} target="_blank" rel="noreferrer">
                            Abrir
                          </a>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setOpenDocViewer(false);
                            setDocViewerTarget(null);
                            setOpenView(true);
                          }}
                        >
                          <X className="h-4 w-4" />
                          Cerrar
                        </Button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 px-3 pb-3 sm:px-4">
                      <Button type="button" variant="outline" size="sm" onClick={openPrevDoc} disabled={docViewerIndex <= 0}>
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={openNextDoc}
                        disabled={docViewerIndex < 0 || docViewerIndex >= orderedDocsForViewer.length - 1}
                      >
                        Siguiente
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch] p-3 sm:p-4">
                    {isImageUrl(docViewerTarget.url) ? (
                      <img
                        src={docViewerTarget.url}
                        alt={docViewerTarget.name}
                        className="w-full rounded-lg border border-slate-200 object-contain bg-white"
                      />
                    ) : isPdfUrl(docViewerTarget.url) ? (
                      <iframe
                        src={docViewerTarget.url}
                        className="h-[75vh] w-full rounded-lg border border-slate-200 bg-white"
                        title={docViewerTarget.name}
                      />
                    ) : (
                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <FileText className="h-4 w-4" />
                          <span>No se puede previsualizar este tipo de archivo.</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>,
              document.body
            )
          : null}

        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent className="sm:max-w-[480px] border-[#D4AF37]/30">
            <DialogHeader>
              <DialogTitle className="text-[#D4AF37]">Confirmar eliminación</DialogTitle>
              <div className="text-sm text-slate-600">
                Esta acción eliminará el vehículo <span className="font-medium text-slate-900">{deleteTarget?.plate || ""}</span> y sus documentos asociados.
              </div>
            </DialogHeader>
            <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-yellow-700">
              Proceda solo si está seguro. Esta acción no se puede deshacer.
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting} className="border-zinc-700 text-slate-900 bg-white hover:bg-zinc-100">
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={deleting || !deleteTarget}
                className="bg-[#D4AF37] text-black hover:bg-[#B59530]"
                onClick={async () => {
                  if (!deleteTarget) return;
                  try {
                    setDeleting(true);
                    const res = await deleteVehicleInspectionVehicle({ projectId: props.projectId, vehicleId: deleteTarget.id });
                    if (!res.success) throw new Error(res.error || "No se pudo eliminar");
                    toast.success("Vehículo eliminado");
                    setConfirmDelete(false);
                    setDeleteTarget(null);
                    router.refresh();
                  } catch (e) {
                    const message = e instanceof Error ? e.message : "No se pudo eliminar";
                    toast.error(message);
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                {deleting ? "Eliminando..." : "Estoy de acuerdo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={open}
          onOpenChange={(next) => {
            if (!next && saving) return;
            setOpen(next);
            if (!next) reset();
          }}
        >
          <DialogContent showCloseButton={false} className="sm:max-w-[920px] max-h-[90vh] p-0 overflow-hidden">
            <div className="flex max-h-[90vh] flex-col">
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80">
                <DialogTitle>Añadir vehículo</DialogTitle>
                <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => setOpen(false)}>
                  <X className="h-4 w-4" />
                  Cerrar
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="rounded-xl border border-slate-200 bg-white">
              <div className="rounded-t-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                Información del vehículo
              </div>
              <div className="px-4">
                <FieldRow label="Fecha de verificación o ingreso">
                  <Input type="date" value={verificationDate} onChange={(e) => setVerificationDate(e.target.value)} />
                </FieldRow>
                <FieldRow label="Placas del vehículo">
                  <Input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="ABC123" />
                </FieldRow>
                <FieldRow label="Número SERIE / VIN">
                  <Input value={vin} onChange={(e) => setVin(e.target.value)} placeholder="VIN" />
                </FieldRow>
                <FieldRow label="Número de motor">
                  <Input value={engineNumber} onChange={(e) => setEngineNumber(e.target.value)} placeholder="Motor" />
                </FieldRow>
                <FieldRow label="Modelo">
                  <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Modelo" />
                </FieldRow>
                <FieldRow label="Licencia de tránsito">
                  <Input value={transitLicense} onChange={(e) => setTransitLicense(e.target.value)} placeholder="Licencia de tránsito" />
                </FieldRow>
                <FieldRow label="Marca">
                  <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Marca" />
                </FieldRow>
                <FieldRow label="Línea">
                  <Input value={line} onChange={(e) => setLine(e.target.value)} placeholder="Línea" />
                </FieldRow>
                <FieldRow label="Cilindraje">
                  <Input value={displacement} onChange={(e) => setDisplacement(e.target.value)} placeholder="Cilindraje" />
                </FieldRow>
                <FieldRow label="Color">
                  <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Color" />
                </FieldRow>
                <FieldRow label="Kilometraje">
                  <Input value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="0" />
                </FieldRow>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="rounded-t-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">Datos del propietario</div>
              <div className="px-4">
                <FieldRow label="Nombre">
                  <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Nombre" />
                </FieldRow>
                <FieldRow label="Cédula o NIT">
                  <Input value={ownerId} onChange={(e) => setOwnerId(e.target.value)} placeholder="Cédula o NIT" />
                </FieldRow>
                <FieldRow label="Conductor (opcional)">
                  <Select value={driverId || "none"} onValueChange={(v) => setDriverId(v === "none" ? "" : v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccione un conductor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin conductor</SelectItem>
                      {props.driverOptions.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="rounded-t-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                Documentos y vencimientos
              </div>
              <div className="px-4">
                <FieldRow label="SOAT fecha de vencimiento" right="Vence - carga documento">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Input type="date" value={soatDueDate} onChange={(e) => setSoatDueDate(e.target.value)} />
                    <div className="flex items-center gap-2">
                      <input
                        ref={soatInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => setSoatFile(e.target.files?.[0] || null)}
                      />
                      <Button type="button" variant="outline" className="w-full" onClick={() => soatInputRef.current?.click()}>
                        Cargar documento
                      </Button>
                      {soatFile ? (
                        <Button type="button" variant="outline" className="shrink-0" onClick={() => setSoatFile(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {soatFile ? <div className="mt-2 text-sm text-slate-600">{soatFile.name}</div> : null}
                </FieldRow>

                <FieldRow label="Estado (calcula vencimiento como la prioridad de actividad)" right="Vence">
                  <div className="text-sm text-slate-600">Se calcula automáticamente.</div>
                </FieldRow>

                <FieldRow label="Revisión técnico mecánica fecha de vencimiento" right="Vence - carga documento">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Input type="date" value={rtmDueDate} onChange={(e) => setRtmDueDate(e.target.value)} />
                    <div className="flex items-center gap-2">
                      <input
                        ref={rtmInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => setRtmFile(e.target.files?.[0] || null)}
                      />
                      <Button type="button" variant="outline" className="w-full" onClick={() => rtmInputRef.current?.click()}>
                        Cargar documento
                      </Button>
                      {rtmFile ? (
                        <Button type="button" variant="outline" className="shrink-0" onClick={() => setRtmFile(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {rtmFile ? <div className="mt-2 text-sm text-slate-600">{rtmFile.name}</div> : null}
                </FieldRow>

                <FieldRow label="Estado (calcula vencimiento como la prioridad de actividad)" right="Vence">
                  <div className="text-sm text-slate-600">Se calcula automáticamente.</div>
                </FieldRow>

                <FieldRow label="Cargar tarjeta de propiedad (licencia de tránsito)" right="No vence / carga documento">
                  <div className="flex items-center gap-2">
                    <input
                      ref={propertyCardInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => setPropertyCardFile(e.target.files?.[0] || null)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => propertyCardInputRef.current?.click()}
                    >
                      Cargar documento
                    </Button>
                    {propertyCardFile ? (
                      <Button type="button" variant="outline" className="shrink-0" onClick={() => setPropertyCardFile(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                  {propertyCardFile ? <div className="mt-2 text-sm text-slate-600">{propertyCardFile.name}</div> : null}
                </FieldRow>
              </div>
            </div>
              </div>

              <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    className="bg-[#D4AF37] text-black hover:bg-[#B59530]"
                    disabled={!canSubmit}
                    onClick={async () => {
                      if (!canSubmit) return;
                      try {
                        setSaving(true);
                        const files: Array<{ kind: "SOAT" | "RTM" | "PROPERTY_CARD"; file: File }> = [];
                        if (soatFile) files.push({ kind: "SOAT", file: soatFile });
                        if (rtmFile) files.push({ kind: "RTM", file: rtmFile });
                        if (propertyCardFile) files.push({ kind: "PROPERTY_CARD", file: propertyCardFile });

                        let uploadedDocs: Array<{ kind: "SOAT" | "RTM" | "PROPERTY_CARD"; name: string; url: string; key: string; sizeBytes?: number | null }> = [];

                        if (files.length > 0) {
                          const prep = await createVehicleInspectionUploadRequest({
                            projectId: props.projectId,
                            files: files.map((f) => ({ name: f.file.name, type: f.file.type, sizeBytes: f.file.size })),
                          });

                          if (!prep.success) throw new Error(prep.error || "No se pudo preparar la carga de documentos.");

                          for (let i = 0; i < files.length; i++) {
                            const file = files[i].file;
                            const up = prep.uploads[i];
                            const res = await fetch(up.uploadUrl, {
                              method: "PUT",
                              headers: { "Content-Type": file.type, "x-amz-server-side-encryption": "AES256" },
                              body: file,
                            });
                            if (!res.ok) throw new Error(`Error al subir "${file.name}"`);
                            uploadedDocs.push({
                              kind: files[i].kind,
                              name: up.name,
                              url: up.url,
                              key: up.key,
                              sizeBytes: up.sizeBytes,
                            });
                          }
                        }

                        if (editingVehicleId) {
                          const res = await updateVehicleInspectionVehicle({
                            projectId: props.projectId,
                            vehicleId: editingVehicleId,
                            verificationDate,
                            plate,
                            vin,
                            engineNumber,
                            model,
                            transitLicense,
                            brand,
                            line,
                            displacement,
                            color,
                            mileage,
                            ownerName,
                            ownerId,
                            driverCollaboratorId: driverId || null,
                            soatDueDate: soatDueDate || null,
                            rtmDueDate: rtmDueDate || null,
                          });
                          if (!res.success) throw new Error(res.error || "No se pudo actualizar el vehículo.");
                        } else {
                          const result = await createVehicleInspectionVehicle({
                            projectId: props.projectId,
                            verificationDate,
                            plate,
                            vin,
                            engineNumber,
                            model,
                            transitLicense,
                            brand,
                            line,
                            displacement,
                            color,
                            mileage,
                            ownerName,
                            ownerId,
                            driverCollaboratorId: driverId || null,
                            soatDueDate: soatDueDate || null,
                            rtmDueDate: rtmDueDate || null,
                            documents: uploadedDocs,
                          });
                          if (!result.success) throw new Error(result.error || "No se pudo guardar el vehículo.");
                        }

                        toast.success("Vehículo guardado.");
                        router.refresh();
                        setOpen(false);
                        setEditingVehicleId(null);
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
