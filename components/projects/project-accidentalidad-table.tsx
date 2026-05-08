"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AccidentalidadActions, type AccidentalidadFile } from "@/components/accidentalidad/accidentalidad-actions";
import { AccidentalidadActivityCreateDialog } from "@/components/accidentalidad/accidentalidad-activity-create-dialog";
import { AccidentalidadTaskCreateDialog, type AccidentalidadRowDto } from "@/components/accidentalidad/accidentalidad-task-create-dialog";
import { AccidentalidadRequirementActions, type AccidentalidadDoc } from "@/components/accidentalidad/accidentalidad-requirement-actions";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { updateAccidentalidadEmpresa, updateAccidentalidadStatus } from "@/app/actions/accidentalidad-actions";
import { toast } from "sonner";
import { getAccidentalidadEstadoBadgeClass, getAccidentalidadEstadoLabel } from "@/lib/accidentalidad-status";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { useRealTimeRefresh } from "@/hooks/use-real-time-refresh";

export type AccidentalidadRow = {
  id: string;
  actividad: string;
  status: string;
  priority: string;
  dueDate: string;
  createdAt: string;
  assignedTo: string | null;
  archivos: AccidentalidadFile[];
};

type AccidentalidadActividadMeta = {
  accidentId: string;
  accidentName: string;
  taskName: string;
  nombreColaborador: string;
  identificacion: string;
  area: string;
};

function parseAccidentalidadActividad(raw: string): AccidentalidadActividadMeta | null {
  const parts = (raw || "").split("|");
  if (parts.length < 6) return null;
  const [tag, accidentName, taskName, nombreColaborador, identificacion, area] = parts;
  if (!tag.startsWith("ACC:")) return null;
  const accidentId = tag.slice(4).trim();
  if (!accidentId) return null;
  return {
    accidentId,
    accidentName: (accidentName || "").trim(),
    taskName: (taskName || "").trim(),
    nombreColaborador: (nombreColaborador || "").trim(),
    identificacion: (identificacion || "").trim(),
    area: (area || "").trim(),
  };
}

type AccidentListItem = {
  id: string;
  name: string;
  fechaAccidente: string;
  nombreColaborador: string;
  identificacion: string;
  area: string;
  createdAt: string;
  tasksCount: number;
};

type AccidentCreatedPayload = {
  accident: {
    id: string;
    name: string;
    fechaAccidente: string;
    nombreColaborador: string;
    identificacion: string;
    area: string;
  };
  rows: AccidentalidadRow[];
};

export function ProjectAccidentalidadTable(props: {
  rows: AccidentalidadRow[];
  projectId: string;
  projectName: string;
  canEdit: boolean;
  canDelete: boolean;
  userRole: string;
}) {
  useRealTimeRefresh(5000);
  const [rows, setRows] = useState<AccidentalidadRow[]>(props.rows);
  const [selectedAccidentId, setSelectedAccidentId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [localDueDates, setLocalDueDates] = useState<Record<string, string>>(() =>
    Object.fromEntries(props.rows.map((r) => [r.id, r.dueDate.slice(0, 10)]))
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setRows(props.rows);
  }, [props.rows]);

  useEffect(() => {
    setLocalDueDates(Object.fromEntries(rows.map((r) => [r.id, r.dueDate.slice(0, 10)])));
  }, [rows]);

  useEffect(() => {
    setCurrentPage(1);
  }, [props.rows]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, fromDate, toDate]);

  const structuredRows = useMemo(() => {
    return rows
      .map((r) => ({ row: r, meta: parseAccidentalidadActividad(r.actividad) }))
      .filter((x): x is { row: AccidentalidadRow; meta: AccidentalidadActividadMeta } => Boolean(x.meta));
  }, [rows]);

  const accidents = useMemo<AccidentListItem[]>(() => {
    const byId = new Map<string, AccidentListItem>();
    for (const item of structuredRows) {
      const { row, meta } = item;
      const existing = byId.get(meta.accidentId);
      if (!existing) {
        byId.set(meta.accidentId, {
          id: meta.accidentId,
          name: meta.accidentName,
          fechaAccidente: row.dueDate,
          nombreColaborador: meta.nombreColaborador,
          identificacion: meta.identificacion,
          area: meta.area,
          createdAt: row.createdAt,
          tasksCount: 1,
        });
      } else {
        existing.tasksCount += 1;
        if (new Date(row.createdAt).getTime() < new Date(existing.createdAt).getTime()) {
          existing.createdAt = row.createdAt;
        }
      }
    }

    return Array.from(byId.values()).sort((a, b) => {
      const at = new Date(a.createdAt).getTime();
      const bt = new Date(b.createdAt).getTime();
      return bt - at;
    });
  }, [structuredRows]);

  useEffect(() => {
    if (!selectedAccidentId) return;
    if (!accidents.some((a) => a.id === selectedAccidentId)) {
      setSelectedAccidentId(null);
    }
  }, [accidents, selectedAccidentId]);

  const selectedAccident = selectedAccidentId
    ? accidents.find((a) => a.id === selectedAccidentId) || null
    : null;

  const selectedRows = useMemo(() => {
    if (!selectedAccidentId) return [];
    return structuredRows
      .filter((x) => x.meta.accidentId === selectedAccidentId)
      .map((x) => x.row);
  }, [structuredRows, selectedAccidentId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return selectedRows.filter((r) => {
      const meta = parseAccidentalidadActividad(r.actividad);
      const taskLabel = meta?.taskName || r.actividad;
      if (q && !taskLabel.toLowerCase().includes(q)) return false;
      const localDue = localDueDates[r.id] || r.dueDate.slice(0, 10);
      if (fromDate) {
        const d = new Date(localDue);
        const f = new Date(fromDate);
        f.setHours(0, 0, 0, 0);
        if (d.getTime() < f.getTime()) return false;
      }
      if (toDate) {
        const d = new Date(localDue);
        const t = new Date(toDate);
        t.setHours(23, 59, 59, 999);
        if (d.getTime() > t.getTime()) return false;
      }
      return true;
    });
  }, [selectedRows, search, fromDate, toDate, localDueDates]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const handleStatusChange = async (accidentalidadId: string, status: string, note?: string) => {
    try {
      const fd = new FormData();
      fd.append("accidentalidadId", accidentalidadId);
      fd.append("status", status);
      if (note) fd.append("note", note);
      const res = await updateAccidentalidadStatus(fd);
      if (!res.success) {
        toast.error(res.error || "No se pudo actualizar el estado.");
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === accidentalidadId ? { ...r, status } : r)));
      toast.success("Estado actualizado.");
    } catch (e) {
      console.error(e);
      toast.error("Error al actualizar el estado.");
    }
  };

  const handleDueDateChange = async (id: string, value: string) => {
    setLocalDueDates((prev) => ({ ...prev, [id]: value }));
    setErrorById((prev) => ({ ...prev, [id]: "" }));

    try {
      setSavingId(id);
      const fd = new FormData();
      fd.append("dueDate", value);
      const res = await updateAccidentalidadEmpresa(id, fd);
      if (!res.success) {
        const message = res.error || "No se pudo guardar la fecha.";
        setErrorById((prev) => ({ ...prev, [id]: message }));
        toast.error(message);
      }
    } finally {
      setSavingId((prev) => (prev === id ? null : prev));
    }
  };

  const handleAccidentCreated = (payload: AccidentCreatedPayload) => {
    const createdRows = payload?.rows || [];
    if (createdRows.length === 0) return;
    setRows((prev) => [...createdRows, ...prev]);
    setLocalDueDates((prev) => ({
      ...prev,
      ...Object.fromEntries(createdRows.map((r) => [r.id, (r.dueDate || "").slice(0, 10)])),
    }));
    setSelectedAccidentId(null);
    setCurrentPage(1);
  };

  if (!selectedAccidentId) {
    return (
      <div className="space-y-3">
        {accidents.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8">
            <div className="mx-auto max-w-xl text-center">
              <div className="text-base font-semibold text-slate-900">Sin accidentes registrados</div>
              <div className="mt-2 text-sm text-slate-600">
                Registra un accidente para que aparezca en el listado y puedas adjuntar evidencias.
              </div>
              <div className="mt-5 flex justify-center">
                <AccidentalidadActivityCreateDialog
                  projectId={props.projectId}
                  canCreate={props.canEdit}
                  onCreated={handleAccidentCreated}
                />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-center text-sm font-semibold text-slate-900 sm:text-left">Accidentes</div>
              <div className="flex justify-center sm:justify-end">
                <div className="w-full max-w-[260px] sm:max-w-none sm:w-auto">
                  <AccidentalidadActivityCreateDialog
                    projectId={props.projectId}
                    canCreate={props.canEdit}
                    onCreated={handleAccidentCreated}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              {accidents.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left hover:bg-slate-50"
                  onClick={() => {
                    setSelectedAccidentId(a.id);
                    setSearch("");
                    setFromDate("");
                    setToDate("");
                    setCurrentPage(1);
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{a.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span>Fecha: {new Date(a.fechaAccidente).toLocaleDateString()}</span>
                        <span>Colaborador: {a.nombreColaborador}</span>
                        <span>ID: {a.identificacion}</span>
                        <span>Área: {a.area}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-xs font-medium text-slate-700">
                      {a.tasksCount} actividades
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="outline"
          className="h-9 rounded-full border-zinc-300 bg-white text-slate-800 hover:bg-zinc-100"
          onClick={() => setSelectedAccidentId(null)}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Volver a accidentes
        </Button>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          {selectedAccident ? (
            <div className="text-xs text-slate-600">
              {selectedAccident.name} · {new Date(selectedAccident.fechaAccidente).toLocaleDateString()}
            </div>
          ) : null}
          {selectedAccident ? (
            <AccidentalidadTaskCreateDialog
              projectId={props.projectId}
              accidentId={selectedAccident.id}
              accidentName={selectedAccident.name}
              canCreate={props.canEdit}
              onCreated={(row: AccidentalidadRowDto) => {
                const newRow = row as unknown as AccidentalidadRow;
                setRows((prev) => [newRow, ...prev]);
                setLocalDueDates((prev) => ({ ...prev, [newRow.id]: (newRow.dueDate || "").slice(0, 10) }));
                setCurrentPage(1);
              }}
            />
          ) : null}
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-2 lg:grid-cols-12 lg:items-end`}>
        <div className="lg:col-span-4">
          <div className="grid gap-1">
            <span className="sr-only">Buscar por actividad</span>
            <input
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm shadow-sm focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              placeholder="Buscar por nombre de actividad"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="flex flex-wrap items-end gap-2 lg:justify-end">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Desde</span>
              <input
                type="date"
                className="h-9 w-36 rounded-md border border-slate-200 px-2 text-sm shadow-sm focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Hasta</span>
              <input
                type="date"
                className="h-9 w-36 rounded-md border border-slate-200 px-2 text-sm shadow-sm focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 sm:hidden">
        {pageRows.map((row) => {
          const meta = parseAccidentalidadActividad(row.actividad);
          const latestFile = row.archivos.length > 0 ? row.archivos[0] : null;
          const fechaCarga = latestFile ? new Date(latestFile.uploadedAt).toLocaleDateString() : "-";
          const localDue = localDueDates[row.id] || row.dueDate.slice(0, 10);

          return (
            <Card key={row.id} className="rounded-2xl border-slate-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="break-words text-sm font-semibold text-slate-900">
                      {meta?.taskName || row.actividad}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={getAccidentalidadEstadoBadgeClass(row.status)}>
                        {getAccidentalidadEstadoLabel(row.status)}
                      </Badge>
                    </div>
                  </div>

                  {(props.userRole === "ADMIN_PMD" || props.userRole === "GESTOR") && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-slate-600 hover:text-[#D4AF37]"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onSelect={() => handleStatusChange(row.id, "PENDING")} disabled={row.status === "PENDING"}>
                          Pendiente
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleStatusChange(row.id, "IN_REVIEW")} disabled={row.status === "IN_REVIEW"}>
                          En revisión
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleStatusChange(row.id, "APPROVED")} disabled={row.status === "APPROVED"}>
                          Aprobada
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleStatusChange(row.id, "REJECTED")} disabled={row.status === "REJECTED"}>
                          Rechazada
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                <div className="mt-3 grid gap-2 text-xs text-slate-700">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Fecha del accidente</span>
                    <input
                      type="date"
                      className="h-8 w-40 rounded-md border border-slate-200 px-2 text-xs text-slate-900 shadow-sm focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37] disabled:opacity-70 disabled:cursor-not-allowed disabled:bg-slate-50"
                      value={localDue}
                      onChange={(e) => handleDueDateChange(row.id, e.target.value)}
                      disabled={!props.canEdit}
                    />
                  </div>
                  {errorById[row.id] ? <div className="text-[0.75rem] text-red-600">{errorById[row.id]}</div> : null}
                  {savingId === row.id ? <div className="text-[0.75rem] text-slate-400">Guardando cambios…</div> : null}

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Fecha de carga</span>
                    <span>{fechaCarga}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Asignado a</span>
                    <span>{row.assignedTo || "Sin asignar"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Archivo adjunto</span>
                    {latestFile ? (
                      <a
                        href={latestFile.url}
                        target="_blank"
                        rel="noreferrer"
                        className="max-w-[200px] truncate text-blue-700 hover:text-blue-900 hover:underline"
                      >
                        {latestFile.name}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Sin archivo</span>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <AccidentalidadRequirementActions
                    accidentalidadId={row.id}
                    actividadTitle={meta?.taskName || row.actividad}
                    projectName={props.projectName}
                    dueDate={localDue}
                    status={row.status}
                    density="compact"
                    latestDoc={latestFile ? { id: latestFile.id, name: latestFile.name, url: latestFile.url } : null}
                    documents={row.archivos as unknown as AccidentalidadDoc[]}
                    canManage={props.canEdit}
                    canDelete={props.canDelete}
                    onDocumentsChange={(docs) => {
                      const mapped = (docs || []).map((d) => ({
                        id: d.id,
                        name: d.name,
                        url: d.url,
                        uploadedAt: typeof d.uploadedAt === "string" ? d.uploadedAt : d.uploadedAt.toISOString(),
                        version: d.version,
                        sizeBytes: d.sizeBytes,
                      })) as AccidentalidadFile[];
                      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, archivos: mapped } : r)));
                    }}
                    onStatusChange={(nextStatus) => {
                      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: nextStatus } : r)));
                    }}
                  />
                  <AccidentalidadActions
                    accidentalidadId={row.id}
                    canEdit={props.canEdit}
                    canDelete={props.canDelete}
                    actividad={meta?.taskName || row.actividad}
                    dueDate={row.dueDate}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filtered.length === 0 ? (
          <Card className="rounded-2xl border-slate-200">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No hay actividades para los filtros seleccionados.
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="hidden sm:block overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-[980px] w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold leading-tight text-slate-600">
              <th className="px-3 py-1.5">Actividad</th>
              <th className="px-3 py-1.5">Fecha de carga</th>
              <th className="px-3 py-1.5">Fecha del accidente</th>
              <th className="px-3 py-1.5">Estado</th>
              <th className="px-3 py-1.5">Asignado a</th>
              <th className="px-3 py-1.5">Archivo adjunto</th>
              <th className="px-3 py-1.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {pageRows.map((row) => {
              const meta = parseAccidentalidadActividad(row.actividad);
              const latestFile = row.archivos.length > 0 ? row.archivos[0] : null;
              const fechaCarga = latestFile ? new Date(latestFile.uploadedAt).toLocaleDateString() : "-";
              const localDue = localDueDates[row.id] || row.dueDate.slice(0, 10);
              return (
                <tr key={row.id} className="border-t hover:bg-slate-50/60">
                  <td className="px-3 py-1.5 font-medium text-slate-900 max-w-[360px]">
                    <span className="break-words">{meta?.taskName || row.actividad}</span>
                  </td>
                  <td className="px-3 py-1.5 text-xs text-slate-600">{fechaCarga}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex flex-col gap-0.5">
                      <input
                        type="date"
                        className="h-7 w-36 rounded-md border border-slate-200 px-2 text-xs text-slate-900 shadow-sm focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37] disabled:opacity-70 disabled:cursor-not-allowed disabled:bg-slate-50"
                        value={localDue}
                        onChange={(e) => handleDueDateChange(row.id, e.target.value)}
                        disabled={!props.canEdit}
                      />
                      {errorById[row.id] && (
                        <span className="text-[0.7rem] text-red-600">{errorById[row.id]}</span>
                      )}
                      {savingId === row.id && (
                        <span className="text-[0.7rem] text-slate-400">Guardando cambios…</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getAccidentalidadEstadoBadgeClass(row.status)}>
                        {getAccidentalidadEstadoLabel(row.status)}
                      </Badge>
                      {(props.userRole === "ADMIN_PMD" || props.userRole === "GESTOR") && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-600 hover:text-[#D4AF37]"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-44">
                            <DropdownMenuItem
                              onSelect={() => handleStatusChange(row.id, "PENDING")}
                              disabled={row.status === "PENDING"}
                            >
                              Pendiente
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => handleStatusChange(row.id, "IN_REVIEW")}
                              disabled={row.status === "IN_REVIEW"}
                            >
                              En revisión
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => handleStatusChange(row.id, "APPROVED")}
                              disabled={row.status === "APPROVED"}
                            >
                              Aprobada
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={() => handleStatusChange(row.id, "REJECTED")}
                              disabled={row.status === "REJECTED"}
                            >
                              Rechazada
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-xs text-slate-700">{row.assignedTo || "Sin asignar"}</td>
                  <td className="px-3 py-1.5">
                    {latestFile ? (
                      <a
                        href={latestFile.url}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all text-xs text-blue-700 hover:text-blue-900 hover:underline"
                      >
                        {latestFile.name}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin archivo</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <AccidentalidadRequirementActions
                        accidentalidadId={row.id}
                        actividadTitle={meta?.taskName || row.actividad}
                        projectName={props.projectName}
                        dueDate={localDue}
                        status={row.status}
                        density="compact"
                        latestDoc={
                          latestFile ? { id: latestFile.id, name: latestFile.name, url: latestFile.url } : null
                        }
                        documents={row.archivos as unknown as AccidentalidadDoc[]}
                        canManage={props.canEdit}
                        canDelete={props.canDelete}
                        onDocumentsChange={(docs) => {
                          const mapped = (docs || []).map((d) => ({
                            id: d.id,
                            name: d.name,
                            url: d.url,
                            uploadedAt:
                              typeof d.uploadedAt === "string" ? d.uploadedAt : d.uploadedAt.toISOString(),
                            version: d.version,
                            sizeBytes: d.sizeBytes,
                          })) as AccidentalidadFile[];
                          setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, archivos: mapped } : r)));
                        }}
                        onStatusChange={(nextStatus) => {
                          setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: nextStatus } : r)));
                        }}
                      />
                      <AccidentalidadActions
                        accidentalidadId={row.id}
                        canEdit={props.canEdit}
                        canDelete={props.canDelete}
                        actividad={meta?.taskName || row.actividad}
                        dueDate={row.dueDate}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No hay actividades para los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">
            Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} de{" "}
            {filtered.length} registros
          </div>
          <div className="flex items-center justify-end space-x-2">
            <Button type="button" variant="outline" size="icon" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-xs text-muted-foreground">
              Página {currentPage} de {totalPages}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
