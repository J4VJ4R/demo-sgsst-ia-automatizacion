"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Eye, FileText, X } from "lucide-react";
import {
  createDriverInspectionDriver,
  createDriverInspectionUploadRequest,
  deleteDriverInspectionDriver,
  listDriverInspectionDocuments,
  listDriverInspectionDrivers,
  syncDriverInspectionDriversFromCollaborators,
  updateDriverInspectionDriver,
} from "@/app/drivers-inspection-actions";

type DriverInspectionListItem = {
  id: string;
  fullName: string;
  documentType: string;
  documentNumber: string;
  position: string | null;
  licenseCategory: string | null;
  licenseDueDate: string | null;
  licenseStatus: string | null;
  roadSafetyTraining: boolean | null;
  evaluationDueDate: string | null;
  vehiclePlate: string | null;
  missionTripsPlanner: string | null;
  documentsCount: number;
  createdAt: string;
};

type DriverInspectionDocument = {
  id: string;
  kind: string;
  name: string;
  url: string;
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

const docTypeOptions = ["CC", "CE", "TI", "NIT", "PA"] as const;
const priorityOptions = ["Alta", "Media", "Baja"] as const;

const coerceDocType = (value: string): (typeof docTypeOptions)[number] | "" => {
  if ((docTypeOptions as readonly string[]).includes(value)) {
    return value as (typeof docTypeOptions)[number];
  }
  return "";
};

const coercePriority = (value: string): (typeof priorityOptions)[number] | "" => {
  if ((priorityOptions as readonly string[]).includes(value)) {
    return value as (typeof priorityOptions)[number];
  }
  return "";
};

export function DriversInspectionManager(props: {
  projectId: string;
  canManage: boolean;
  initialDrivers: DriverInspectionListItem[];
}) {
  const router = useRouter();
  const licenseInputRef = useRef<HTMLInputElement | null>(null);
  const evaluationInputRef = useRef<HTMLInputElement | null>(null);
  const refreshInFlightRef = useRef(false);
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);

  const [query, setQuery] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [openView, setOpenView] = useState(false);
  const [viewTarget, setViewTarget] = useState<DriverInspectionListItem | null>(null);
  const [viewDocs, setViewDocs] = useState<DriverInspectionDocument[]>([]);
  const [viewDocsLoading, setViewDocsLoading] = useState(false);

  const [openDocViewer, setOpenDocViewer] = useState(false);
  const [docViewerTarget, setDocViewerTarget] = useState<DriverInspectionDocument | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DriverInspectionListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [autoRefreshing, setAutoRefreshing] = useState(false);

  const [fullName, setFullName] = useState("");
  const [documentType, setDocumentType] = useState<(typeof docTypeOptions)[number] | "">("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [position, setPosition] = useState("");
  const [licenseCategory, setLicenseCategory] = useState("");
  const [licenseDueDate, setLicenseDueDate] = useState("");
  const [licenseStatus, setLicenseStatus] = useState<(typeof priorityOptions)[number] | "">("");
  const [roadSafetyTraining, setRoadSafetyTraining] = useState<"SI" | "NO" | "">("");
  const [evaluationDueDate, setEvaluationDueDate] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [missionTripsPlanner, setMissionTripsPlanner] = useState("");

  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [evaluationFile, setEvaluationFile] = useState<File | null>(null);

  const [drivers, setDrivers] = useState<DriverInspectionListItem[]>(props.initialDrivers);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter((d) => {
      const haystack = [d.fullName, d.documentType, d.documentNumber, d.position || "", d.vehiclePlate || ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [drivers, query]);

  const canSubmit = useMemo(() => {
    return fullName.trim().length > 0 && documentType.trim().length > 0 && documentNumber.trim().length > 0 && !saving;
  }, [documentNumber, documentType, fullName, saving]);

  const resetForm = () => {
    setEditingId(null);
    setFullName("");
    setDocumentType("");
    setDocumentNumber("");
    setPosition("");
    setLicenseCategory("");
    setLicenseDueDate("");
    setLicenseStatus("");
    setRoadSafetyTraining("");
    setEvaluationDueDate("");
    setVehiclePlate("");
    setMissionTripsPlanner("");
    setLicenseFile(null);
    setEvaluationFile(null);
  };

  useEffect(() => {
    setDrivers(props.initialDrivers);
  }, [props.initialDrivers]);

  useEffect(() => {
    let cancelled = false;

    const refresh = async (opts?: { syncFromCollaborators?: boolean }) => {
      if (refreshInFlightRef.current) return;
      refreshInFlightRef.current = true;
      setAutoRefreshing(true);
      try {
        if (opts?.syncFromCollaborators && props.canManage) {
          const sync = await syncDriverInspectionDriversFromCollaborators({ projectId: props.projectId });
          if (!sync.success) throw new Error(sync.error || "No se pudo sincronizar");
        }
        const res = await listDriverInspectionDrivers({ projectId: props.projectId });
        if (!res.success) throw new Error(res.error || "No se pudo cargar la lista");
        if (cancelled) return;
        setDrivers(res.drivers);
      } catch {
      } finally {
        if (!cancelled) setAutoRefreshing(false);
        refreshInFlightRef.current = false;
      }
    };

    const scheduleReconnect = () => {
      if (reconnectTimerRef.current) return;
      const retry = Math.min(retryRef.current, 6);
      const delay = 500 * Math.pow(2, retry);
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        retryRef.current += 1;
        connect();
      }, delay);
    };

    const connect = () => {
      esRef.current?.close();
      const url = `/api/realtime/drivers?projectId=${encodeURIComponent(props.projectId)}`;
      const es = new EventSource(url);
      esRef.current = es;

      const handleConnected = (_evt?: Event) => {
        retryRef.current = 0;
        void refresh({ syncFromCollaborators: true });
      };

      es.addEventListener("open", handleConnected);
      es.addEventListener("connected", handleConnected);
      es.addEventListener("drivers_inspection_changed", () => {
        void refresh();
      });
      es.addEventListener("error", () => {
        es.close();
        scheduleReconnect();
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };

    void refresh({ syncFromCollaborators: true });
    connect();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
      esRef.current?.close();
      esRef.current = null;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [props.canManage, props.projectId]);

  const formatDate = (iso: string | null) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("es-CO");
  };

  const isImageUrl = (url: string) => {
    return /\.(png|jpg|jpeg|webp|gif)$/i.test(url.split("?")[0] || "");
  };
  const isPdfUrl = (url: string) => {
    return /\.pdf$/i.test(url.split("?")[0] || "");
  };

  const parseLocalDate = (value: string) => {
    const parts = value.split("-");
    if (parts.length !== 3) return null;
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const date = new Date(y, m - 1, d);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  };

  const getLicenseState = (iso: string | null) => {
    if (!iso) return "";
    const due = parseLocalDate(iso.slice(0, 10));
    if (!due) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today ? "Vencida" : "Vigente";
  };

  const getTrainingState = (iso: string | null) => {
    if (!iso) return "";
    const due = parseLocalDate(iso.slice(0, 10));
    if (!due) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due <= today ? "Vencida" : "Vigente";
  };

  const licenseComputedState = useMemo<"" | "Vigente" | "Vencida">(() => {
    if (!licenseDueDate) return "";
    const due = parseLocalDate(licenseDueDate);
    if (!due) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due < today ? "Vencida" : "Vigente";
  }, [licenseDueDate]);

  const evaluationComputedState = useMemo<"" | "Vigente" | "Vencida">(() => {
    if (!evaluationDueDate) return "";
    const due = parseLocalDate(evaluationDueDate);
    if (!due) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return due <= today ? "Vencida" : "Vigente";
  }, [evaluationDueDate]);

  const orderedDocsForViewer = useMemo(() => {
    const priority: Record<string, number> = { LICENSE: 0, EVALUATION: 1 };
    return [...viewDocs].sort((a, b) => {
      const pa = priority[a.kind] ?? 99;
      const pb = priority[b.kind] ?? 99;
      if (pa !== pb) return pa - pb;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [viewDocs]);

  const docViewerIndex = useMemo(() => {
    if (!docViewerTarget) return -1;
    return orderedDocsForViewer.findIndex((d) => d.id === docViewerTarget.id);
  }, [docViewerTarget, orderedDocsForViewer]);

  const openViewer = (doc: DriverInspectionDocument) => {
    setDocViewerTarget(doc);
    setOpenDocViewer(true);
    setOpenView(false);
  };

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

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!openView || !viewTarget) return;
      setViewDocs([]);
      setViewDocsLoading(true);
      try {
        const res = await listDriverInspectionDocuments({ projectId: props.projectId, driverId: viewTarget.id });
        if (!res.success) throw new Error(res.error || "No se pudieron cargar los documentos.");
        if (cancelled) return;
        setViewDocs(
          res.documents.map((d) => ({
            id: d.id,
            kind: d.kind,
            name: d.name,
            url: d.url,
          }))
        );
      } catch {
        if (cancelled) return;
        setViewDocs([]);
      } finally {
        if (!cancelled) setViewDocsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [openView, viewTarget?.id, props.projectId]);

  const docLink = useMemo(() => {
    const out: Record<string, DriverInspectionDocument | null> = { LICENSE: null, EVALUATION: null };
    for (const d of viewDocs) {
      if (!out[d.kind]) out[d.kind] = d;
    }
    return out;
  }, [viewDocs]);

  return (
    <Card className="gap-2 py-3">
      <CardHeader className="px-3 gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-1">
          <CardTitle>Listado de conductores</CardTitle>
          <p className="text-sm leading-[1.5] text-slate-600">Administra inspecciones de conductores.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {autoRefreshing ? <div className="text-xs text-slate-500">Actualizando…</div> : null}
          <Button className="bg-[#D4AF37] text-black hover:bg-[#B59530]" disabled={!props.canManage} onClick={() => setOpenForm(true)}>
            Añadir conductor
          </Button>
        </div>
      </CardHeader>

      <CardContent className="px-3 pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, documento, cargo o placa…"
              className="w-full sm:max-w-[520px]"
            />
            <div className="text-sm text-slate-600">{filtered.length} conductor{filtered.length === 1 ? "" : "es"}</div>
          </div>

          <div className="mt-4">
            {filtered.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-600">Aún no hay conductores registrados.</div>
            ) : (
              <>
                <div className="lg:hidden grid grid-cols-1 gap-3">
                  {filtered.map((d) => (
                    <div key={d.id} className="w-full rounded-lg border border-slate-200 bg-white p-3">
                      {(() => {
                        const licenseState = getLicenseState(d.licenseDueDate);
                        const trainingState = getTrainingState(d.evaluationDueDate);
                        return (
                          <>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-base font-semibold text-slate-900">{d.fullName}</div>
                          <div className="text-xs text-slate-600">
                            {d.documentType} {d.documentNumber}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setViewTarget(d);
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
                              setEditingId(d.id);
                              setFullName(d.fullName);
                              setDocumentType(coerceDocType(d.documentType));
                              setDocumentNumber(d.documentNumber);
                              setPosition(d.position || "");
                              setLicenseCategory(d.licenseCategory || "");
                              setLicenseDueDate(d.licenseDueDate?.slice(0, 10) || "");
                              setLicenseStatus(coercePriority(d.licenseStatus || ""));
                              setRoadSafetyTraining(d.roadSafetyTraining === true ? "SI" : d.roadSafetyTraining === false ? "NO" : "");
                              setEvaluationDueDate(d.evaluationDueDate?.slice(0, 10) || "");
                              setVehiclePlate(d.vehiclePlate || "");
                              setMissionTripsPlanner(d.missionTripsPlanner || "");
                              setOpenForm(true);
                            }}
                            disabled={!props.canManage}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            className="h-8 px-2"
                            onClick={() => {
                              setDeleteTarget(d);
                              setConfirmDelete(true);
                            }}
                            disabled={!props.canManage}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-slate-500">Cargo</div>
                          <div>{d.position || "-"}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Placa</div>
                          <div>{d.vehiclePlate || "-"}</div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-slate-500">Vencimiento licencia</div>
                          <div>{formatDate(d.licenseDueDate)}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Licencia</div>
                          {licenseState ? (
                            <span
                              className={
                                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium " +
                                (licenseState === "Vencida"
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700")
                              }
                            >
                              {licenseState}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-500">—</span>
                          )}
                        </div>
                        <div>
                          <div className="text-slate-500">Evaluación conductor</div>
                          {trainingState ? (
                            <span
                              className={
                                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium " +
                                (trainingState === "Vencida"
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700")
                              }
                            >
                              {trainingState}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-500">—</span>
                          )}
                        </div>
                      </div>
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>

                <div className="hidden lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead>Placa</TableHead>
                        <TableHead>Licencia vence</TableHead>
                        <TableHead>Licencia</TableHead>
                        <TableHead>Evaluación conductor</TableHead>
                        <TableHead>Docs</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((d) => (
                        <TableRow key={d.id}>
                          {(() => {
                            const licenseState = getLicenseState(d.licenseDueDate);
                            const trainingState = getTrainingState(d.evaluationDueDate);
                            return (
                              <>
                          <TableCell className="font-medium text-slate-900">{d.fullName}</TableCell>
                          <TableCell>
                            {d.documentType} {d.documentNumber}
                          </TableCell>
                          <TableCell>{d.position || "-"}</TableCell>
                          <TableCell>{d.vehiclePlate || "-"}</TableCell>
                          <TableCell>{formatDate(d.licenseDueDate)}</TableCell>
                          <TableCell>
                            {licenseState ? (
                              <span
                                className={
                                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium " +
                                  (licenseState === "Vencida"
                                    ? "border-red-200 bg-red-50 text-red-700"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700")
                                }
                              >
                                {licenseState}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-500">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {trainingState ? (
                              <span
                                className={
                                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium " +
                                  (trainingState === "Vencida"
                                    ? "border-red-200 bg-red-50 text-red-700"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700")
                                }
                              >
                                {trainingState}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-500">—</span>
                            )}
                          </TableCell>
                          <TableCell>{d.documentsCount}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setViewTarget(d);
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
                                  setEditingId(d.id);
                                  setFullName(d.fullName);
                                  setDocumentType(coerceDocType(d.documentType));
                                  setDocumentNumber(d.documentNumber);
                                  setPosition(d.position || "");
                                  setLicenseCategory(d.licenseCategory || "");
                                  setLicenseDueDate(d.licenseDueDate?.slice(0, 10) || "");
                                  setLicenseStatus(coercePriority(d.licenseStatus || ""));
                                  setRoadSafetyTraining(d.roadSafetyTraining === true ? "SI" : d.roadSafetyTraining === false ? "NO" : "");
                                  setEvaluationDueDate(d.evaluationDueDate?.slice(0, 10) || "");
                                  setVehiclePlate(d.vehiclePlate || "");
                                  setMissionTripsPlanner(d.missionTripsPlanner || "");
                                  setOpenForm(true);
                                }}
                                disabled={!props.canManage}
                              >
                                Editar
                              </Button>
                              <Button
                                variant="outline"
                                className="h-8 px-2"
                                onClick={() => {
                                  setDeleteTarget(d);
                                  setConfirmDelete(true);
                                }}
                                disabled={!props.canManage}
                              >
                                Eliminar
                              </Button>
                            </div>
                          </TableCell>
                              </>
                            );
                          })()}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        </div>

        <Dialog
          open={openView}
          onOpenChange={(next) => {
            setOpenView(next);
            if (!next) setViewTarget(null);
          }}
        >
          <DialogContent
            showCloseButton={false}
            className="sm:max-w-[680px] border-[#D4AF37]/30 p-0 overflow-hidden"
            onPointerDownOutside={(e) => e.preventDefault()}
            onInteractOutside={(e) => e.preventDefault()}
          >
            <div className="flex max-h-[90vh] flex-col">
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80">
                <DialogTitle className="text-[#D4AF37]">Detalle del conductor</DialogTitle>
                <Button type="button" variant="outline" size="sm" onClick={() => setOpenView(false)} className="shrink-0">
                  <X className="h-4 w-4" />
                  Cerrar
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {viewTarget ? (
                  <div className="grid gap-2 text-sm text-slate-700">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Nombres</span>
                      <span className="font-medium text-slate-900">{viewTarget.fullName}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Documento</span>
                      <span>
                        {viewTarget.documentType} {viewTarget.documentNumber}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Cargo</span>
                      <span>{viewTarget.position || "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Categoría licencia</span>
                      <span>{viewTarget.licenseCategory || "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Vence licencia</span>
                      <span>{formatDate(viewTarget.licenseDueDate)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Estado licencia</span>
                      <span>{viewTarget.licenseStatus || "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Capacitación Seguridad Vial</span>
                      <span>
                        {viewTarget.roadSafetyTraining === true ? "Sí" : viewTarget.roadSafetyTraining === false ? "No" : "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Evaluación (vence)</span>
                      <span>{formatDate(viewTarget.evaluationDueDate)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Placa vehículo</span>
                      <span>{viewTarget.vehiclePlate || "-"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Planifica desplazamientos</span>
                      <span>{viewTarget.missionTripsPlanner || "-"}</span>
                    </div>
                    <div className="grid gap-2 rounded-md border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-500">Documentos</span>
                        <span className="text-slate-700">{viewDocsLoading ? "Cargando…" : viewDocs.length}</span>
                      </div>
                      <div className="grid gap-2">
                        {[
                          { kind: "LICENSE", label: "Licencia de conducción" },
                          { kind: "EVALUATION", label: "Evaluación conductor" },
                        ].map((k) => {
                          const doc = docLink[k.kind];
                          return (
                            <div key={k.kind} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900">{k.label}</div>
                                <div className="text-xs text-slate-600 truncate">{doc ? doc.name : "Sin documento"}</div>
                              </div>
                              <Button type="button" variant="outline" size="sm" disabled={!doc} onClick={() => (doc ? openViewer(doc) : null)}>
                                <Eye className="h-4 w-4" />
                                Ver
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                <Button type="button" className="w-full bg-[#D4AF37] text-black hover:bg-[#B59530]" onClick={() => setOpenView(false)}>
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

        <Dialog
          open={confirmDelete}
          onOpenChange={(next) => {
            if (deleting) return;
            setConfirmDelete(next);
            if (!next) setDeleteTarget(null);
          }}
        >
          <DialogContent className="sm:max-w-[480px] border-[#D4AF37]/30">
            <DialogTitle className="text-[#D4AF37]">Confirmar eliminación</DialogTitle>
            <div className="text-sm text-slate-600">
              Esta acción eliminará al conductor <span className="font-medium text-slate-900">{deleteTarget?.fullName || ""}</span> y sus documentos asociados.
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="bg-[#D4AF37] text-black hover:bg-[#B59530]"
                disabled={deleting || !deleteTarget}
                onClick={async () => {
                  if (!deleteTarget) return;
                  try {
                    setDeleting(true);
                    const res = await deleteDriverInspectionDriver({ projectId: props.projectId, driverId: deleteTarget.id });
                    if (!res.success) throw new Error(res.error || "No se pudo eliminar");
                    toast.success("Conductor eliminado");
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
          open={openForm}
          onOpenChange={(next) => {
            if (!next && saving) return;
            setOpenForm(next);
            if (!next) resetForm();
          }}
        >
          <DialogContent showCloseButton={false} className="sm:max-w-[920px] max-h-[90vh] p-0 overflow-hidden">
            <div className="flex max-h-[90vh] flex-col">
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80">
                <DialogTitle>{editingId ? "Editar conductor" : "Añadir conductor"}</DialogTitle>
                <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => setOpenForm(false)}>
                  <X className="h-4 w-4" />
                  Cerrar
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="rounded-xl border border-slate-200 bg-white">
                  <div className="rounded-t-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">Datos del conductor</div>
                  <div className="px-4">
                    <FieldRow label="Nombres">
                      <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nombres y apellidos" />
                    </FieldRow>
                    <FieldRow label="Tipo de Documento de Identidad">
                      <Select value={documentType} onValueChange={(v) => setDocumentType(v as (typeof docTypeOptions)[number])}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {docTypeOptions.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldRow>
                    <FieldRow label="N° de Documento de Identidad">
                      <Input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} />
                    </FieldRow>
                    <FieldRow label="Cargo">
                      <Input value={position} onChange={(e) => setPosition(e.target.value)} />
                    </FieldRow>
                    <FieldRow label="Placa vehículo">
                      <Input value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} placeholder="ABC123" />
                    </FieldRow>
                    <FieldRow label="Quién planifica los desplazamientos misionales">
                      <Input value={missionTripsPlanner} onChange={(e) => setMissionTripsPlanner(e.target.value)} />
                    </FieldRow>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-white">
                  <div className="rounded-t-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">Licencia de conducción</div>
                  <div className="px-4">
                    <FieldRow label="Categoría licencia de conducción">
                      <Input value={licenseCategory} onChange={(e) => setLicenseCategory(e.target.value)} placeholder="Ej: C1" />
                    </FieldRow>
                    <FieldRow label="Fecha vencimiento licencia">
                      <div className="flex items-center gap-2">
                        <Input type="date" value={licenseDueDate} onChange={(e) => setLicenseDueDate(e.target.value)} />
                        <input
                          ref={licenseInputRef}
                          type="file"
                          className="hidden"
                          onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
                        />
                        <Button type="button" variant="outline" onClick={() => licenseInputRef.current?.click()}>
                          Cargar
                        </Button>
                        {licenseFile ? (
                          <Button type="button" variant="outline" className="shrink-0" onClick={() => setLicenseFile(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                      {licenseFile ? <div className="mt-2 text-sm text-slate-600">{licenseFile.name}</div> : null}
                    </FieldRow>
                    <FieldRow label="Estado licencia de conducción">
                      <div>
                        {licenseComputedState ? (
                          <span
                            className={
                              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium " +
                              (licenseComputedState === "Vencida"
                                ? "border-red-200 bg-red-50 text-red-700"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700")
                            }
                          >
                            {licenseComputedState}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-500">—</span>
                        )}
                      </div>
                    </FieldRow>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-white">
                  <div className="rounded-t-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">Evaluación conductor</div>
                  <div className="px-4">
                    <FieldRow label="Ha recibido capacitación en Seguridad Vial">
                      <Select value={roadSafetyTraining} onValueChange={(v) => setRoadSafetyTraining(v as "SI" | "NO" | "")}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SI">Sí</SelectItem>
                          <SelectItem value="NO">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldRow>
                    <FieldRow label="Evaluación conductor">
                      <div className="flex items-center gap-2">
                        <Input type="date" value={evaluationDueDate} onChange={(e) => setEvaluationDueDate(e.target.value)} />
                        <input
                          ref={evaluationInputRef}
                          type="file"
                          className="hidden"
                          onChange={(e) => setEvaluationFile(e.target.files?.[0] || null)}
                        />
                        <Button type="button" variant="outline" onClick={() => evaluationInputRef.current?.click()}>
                          Cargar
                        </Button>
                        {evaluationFile ? (
                          <Button type="button" variant="outline" className="shrink-0" onClick={() => setEvaluationFile(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                      {evaluationFile ? <div className="mt-2 text-sm text-slate-600">{evaluationFile.name}</div> : null}
                      <div className="mt-2 text-sm text-slate-600">
                        Estado:{" "}
                        {evaluationComputedState ? (
                          <span
                            className={
                              "ml-1 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium " +
                              (evaluationComputedState === "Vencida"
                                ? "border-red-200 bg-red-50 text-red-700"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700")
                            }
                          >
                            {evaluationComputedState}
                          </span>
                        ) : (
                          <span className="ml-1 text-slate-500">—</span>
                        )}
                      </div>
                    </FieldRow>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" disabled={saving} onClick={() => setOpenForm(false)}>
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

                        const files: Array<{ kind: "LICENSE" | "EVALUATION"; file: File }> = [];
                        if (licenseFile) files.push({ kind: "LICENSE", file: licenseFile });
                        if (evaluationFile) files.push({ kind: "EVALUATION", file: evaluationFile });

                        const uploadedDocs: Array<{ kind: "LICENSE" | "EVALUATION"; name: string; url: string; key: string; sizeBytes?: number | null }> =
                          [];

                        if (files.length > 0) {
                          const prep = await createDriverInspectionUploadRequest({
                            projectId: props.projectId,
                            files: files.map((f) => ({
                              kind: f.kind,
                              name: f.file.name,
                              type: f.file.type,
                              sizeBytes: f.file.size,
                            })),
                          });
                          if (!prep.success) throw new Error(prep.error || "No se pudo preparar la carga de documentos.");

                          for (let i = 0; i < files.length; i++) {
                            const file = files[i].file;
                            const up = prep.uploads[i];
                            const res = await fetch(up.uploadUrl, {
                              method: "PUT",
                              headers: {
                                "Content-Type": file.type || "application/octet-stream",
                                "x-amz-server-side-encryption": "AES256",
                              },
                              body: file,
                            });
                            if (!res.ok) {
                              let detail = "";
                              try {
                                detail = await res.text();
                              } catch {
                                detail = "";
                              }
                              console.error("S3 upload failed", {
                                name: file.name,
                                status: res.status,
                                detail: detail ? detail.slice(0, 500) : "",
                              });
                              throw new Error(`Error al subir "${file.name}" (${res.status})`);
                            }
                            uploadedDocs.push({
                              kind: files[i].kind,
                              name: up.name,
                              url: up.url,
                              key: up.key,
                              sizeBytes: up.sizeBytes,
                            });
                          }
                        }

                        if (editingId) {
                          const res = await updateDriverInspectionDriver({
                            projectId: props.projectId,
                            driverId: editingId,
                            fullName,
                            documentType,
                            documentNumber,
                            position,
                            licenseCategory,
                            licenseDueDate: licenseDueDate || null,
                            licenseStatus: null,
                            roadSafetyTraining:
                              roadSafetyTraining === "SI" ? true : roadSafetyTraining === "NO" ? false : null,
                            evaluationDueDate: evaluationDueDate || null,
                            vehiclePlate,
                            missionTripsPlanner,
                            documents: uploadedDocs,
                          });
                          if (!res.success) throw new Error(res.error || "No se pudo actualizar el conductor.");
                        } else {
                          const created = await createDriverInspectionDriver({
                            projectId: props.projectId,
                            fullName,
                            documentType,
                            documentNumber,
                            position,
                            licenseCategory,
                            licenseDueDate: licenseDueDate || null,
                            licenseStatus: null,
                            roadSafetyTraining:
                              roadSafetyTraining === "SI" ? true : roadSafetyTraining === "NO" ? false : null,
                            evaluationDueDate: evaluationDueDate || null,
                            vehiclePlate,
                            missionTripsPlanner,
                            documents: uploadedDocs,
                          });
                          if (!created.success) throw new Error(created.error || "No se pudo guardar el conductor.");
                        }

                        toast.success("Conductor guardado.");
                        const refreshed = await listDriverInspectionDrivers({ projectId: props.projectId });
                        if (refreshed.success) setDrivers(refreshed.drivers);
                        router.refresh();
                        setOpenForm(false);
                        resetForm();
                      } catch (e) {
                        const message = e instanceof Error ? e.message : "No se pudo guardar el conductor.";
                        toast.error(message);
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
