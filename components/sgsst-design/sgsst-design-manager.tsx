"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FolderOpen, Loader2, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createSgSstDesignActivity,
  deleteSgSstDesignSection,
  ensureDefaultSgSstDesignSections,
  getSgSstDesignSections,
  updateSgSstDesignDueDate,
  updateSgSstDesignSection,
} from "@/app/sgsst-actions";
import { SgSstDesignFileActions } from "@/components/sgsst-design/sgsst-design-file-actions";
import { calculateSgSstDueStatus, validateSgSstDueDate } from "@/lib/sgsst-due-logic";
import { PERIODICITY_OPTIONS } from "@/lib/periodicity";

type DueFilter = "Todas" | "Vencido" | "Por vencer" | "Cumplido";

const toDateInputValue = (value: unknown) => {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && typeof (value as { toString?: unknown }).toString === "function") {
    const str = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  }
  return "";
};

type SectionRow = {
  id: string;
  name: string;
  sortOrder: number;
  isDefault: boolean;
  dueDate?: string | Date | null;
  dueStatus?: string;
  periodicity?: string | null;
  _count: { files: number };
  files: Array<{
    id: string;
    name: string;
    url: string;
    uploadedAt: string;
    version: number;
  }>;
};

export function SgSstDesignManager(props: { projectId: string; canManage?: boolean; userRole?: string }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SectionRow[]>([]);
  const [search, setSearch] = useState("");
  const [dueFilter, setDueFilter] = useState<DueFilter>("Todas");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [localDueDates, setLocalDueDates] = useState<Record<string, string>>({});
  const [savingDueId, setSavingDueId] = useState<string | null>(null);
  const [dueErrorById, setDueErrorById] = useState<Record<string, string>>({});

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDueDate, setCreateDueDate] = useState<string>("");
  const [createPeriodicity, setCreatePeriodicity] = useState<string>("Mensual");
  const [createError, setCreateError] = useState<string>("");
  const [createPending, startCreateTransition] = useTransition();

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPeriodicity, setEditPeriodicity] = useState<string>("none");
  const [editSaving, setEditSaving] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await getSgSstDesignSections(props.projectId);
      if (!res.success) {
        const msg = res.error || "No se pudo cargar la información";
        setLoadError(msg);
        toast.error(msg);
        setRows([]);
        return;
      }
      const next = res.sections as unknown as SectionRow[];
      setRows(next);
      setLocalDueDates((prev) => {
        const nextMap: Record<string, string> = { ...prev };
        for (const r of next) {
          const v = toDateInputValue(r.dueDate);
          if (v) nextMap[r.id] = v;
        }
        return nextMap;
      });
    } finally {
      setLoading(false);
    }
  }, [props.projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? rows.filter((r) => r.name.toLowerCase().includes(q) || (r.files[0]?.name || "").toLowerCase().includes(q))
      : rows;

    if (dueFilter === "Todas") return base;
    return base.filter((r) => {
      const localDue = localDueDates[r.id];
      if (!localDue) return false;
      return calculateSgSstDueStatus(localDue) === dueFilter;
    });
  }, [rows, search, dueFilter, localDueDates]);

  const getDueBadge = (dueDate: string | null | undefined) => {
    if (!dueDate) return <span className="text-xs text-muted-foreground">Sin fecha</span>;
    const status = calculateSgSstDueStatus(dueDate);
    if (status === "Vencido") return <Badge className="bg-red-600 text-white hover:bg-red-700">Vencido</Badge>;
    if (status === "Por vencer") return <Badge className="bg-yellow-400 text-black hover:bg-yellow-500">Por vencer</Badge>;
    return <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">Cumplido</Badge>;
  };

  const handleDueDateChange = async (sectionId: string, value: string) => {
    setLocalDueDates((prev) => ({ ...prev, [sectionId]: value }));
    setDueErrorById((prev) => ({ ...prev, [sectionId]: "" }));

    if (!value) {
      setDueErrorById((prev) => ({ ...prev, [sectionId]: "Fecha requerida." }));
      return;
    }

    setSavingDueId(sectionId);
    const res = await updateSgSstDesignDueDate(sectionId, value);
    setSavingDueId(null);
    if (!res.success) {
      setDueErrorById((prev) => ({ ...prev, [sectionId]: res.error || "No se pudo actualizar" }));
      return;
    }
    toast.success("Fecha de vencimiento actualizada");
    await load();
  };

  const getCreateStatusBadge = (due: string) => {
    const trimmed = due.trim();
    if (!trimmed) return null;
    const status = calculateSgSstDueStatus(trimmed);
    const cls =
      status === "Vencido"
        ? "bg-red-600 text-white"
        : status === "Por vencer"
          ? "bg-yellow-400 text-black"
          : "bg-emerald-500 text-white";
    return (
      <Badge className={`${cls} h-9 px-3`}>
        {status}
      </Badge>
    );
  };

  const openEdit = (row: SectionRow) => {
    setEditId(row.id);
    setEditName(row.name);
    setEditPeriodicity(row.periodicity || "none");
    setEditOpen(true);
  };

  const openDelete = (row: SectionRow) => {
    setDeleteId(row.id);
    setDeleteOpen(true);
  };

  return (
    <Card className="gap-2 py-3">
      <CardHeader className="px-3 gap-1">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-[#D4AF37]" />
              Sección Diseño SG-SST
            </CardTitle>
            <p className="text-sm leading-[1.5] text-slate-600">
              Gestiona documentos base del sistema. Las subsecciones precargadas organizan la información por tipo de contenido.
            </p>
          </div>
          {props.canManage && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  className="h-9 rounded-full bg-[#D4AF37] text-black hover:bg-[#B59530]"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar actividad
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[480px] border-[#D4AF37]/30 max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-[#D4AF37]">Nueva actividad del proyecto</DialogTitle>
                  <DialogDescription>Crea una nueva actividad para este proyecto.</DialogDescription>
                </DialogHeader>
                <form
                  className="space-y-4 mt-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const trimmedTitle = createTitle.trim();
                    if (!trimmedTitle) {
                      toast.error("El nombre de la actividad es obligatorio.");
                      return;
                    }
                    const trimmedDue = createDueDate.trim();
                    if (trimmedDue) {
                      const result = validateSgSstDueDate(trimmedDue);
                      if (!result.ok) {
                        setCreateError(result.error || "Fecha de vencimiento inválida.");
                        toast.error(result.error || "Fecha de vencimiento inválida.");
                        return;
                      }
                    }
                    setCreateError("");

                    startCreateTransition(async () => {
                      const res = await createSgSstDesignActivity(
                        props.projectId,
                        trimmedTitle,
                        trimmedDue || undefined,
                        createPeriodicity
                      );
                      if (!res.success) {
                        toast.error(res.error || "No se pudo crear la actividad.");
                        return;
                      }
                      toast.success("Actividad creada correctamente.");
                      setCreateTitle("");
                      setCreateDueDate("");
                      setCreatePeriodicity("Mensual");
                      setCreateOpen(false);
                      await load();
                    });
                  }}
                >
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Nombre de la actividad *</label>
                    <Input
                      placeholder="Nombre de la actividad"
                      value={createTitle}
                      onChange={(event) => setCreateTitle(event.target.value)}
                      autoFocus
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Fecha de vencimiento</label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="date"
                        placeholder="dd/mm/aaaa"
                        value={createDueDate}
                        onChange={(e) => {
                          setCreateDueDate(e.target.value);
                          setCreateError("");
                        }}
                        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900 shadow-sm focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
                      />
                      {getCreateStatusBadge(createDueDate)}
                    </div>
                    {createError ? <p className="text-xs text-red-500 mt-1">{createError}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Periodicidad *</label>
                    <Select value={createPeriodicity} onValueChange={setCreatePeriodicity}>
                      <SelectTrigger className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900 shadow-sm focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]">
                        <SelectValue placeholder="Selecciona la periodicidad" />
                      </SelectTrigger>
                      <SelectContent>
                        {PERIODICITY_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      className="bg-[#D4AF37] text-black hover:bg-[#B59530]"
                      disabled={createPending || !!createError}
                    >
                      {createPending ? "Guardando..." : "Guardar actividad"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-3">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-6">
            <div className="grid gap-1">
              <span className="sr-only">Buscar</span>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por subsección o nombre de archivo"
                className="h-9"
              />
            </div>
          </div>
          <div className="lg:col-span-6 flex items-center justify-start lg:justify-end">
            <div className="flex flex-wrap items-center gap-2 rounded-full bg-slate-50 px-2 py-1 text-xs">
              <span className="text-slate-500">Estado:</span>
              <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
                {(["Todas", "Vencido", "Por vencer", "Cumplido"] as const).map((v) => {
                  const active = dueFilter === v;
                  let extra = "text-slate-600 hover:bg-slate-100 hover:text-slate-900";
                  if (v === "Vencido") extra = "text-red-800 hover:bg-red-50 data-[active=true]:bg-red-600 data-[active=true]:text-white";
                  if (v === "Por vencer") extra = "text-yellow-800 hover:bg-yellow-50 data-[active=true]:bg-yellow-400 data-[active=true]:text-black";
                  if (v === "Cumplido") extra = "text-emerald-800 hover:bg-emerald-50 data-[active=true]:bg-emerald-400 data-[active=true]:text-black";
                  return (
                    <Button
                      key={v}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "ghost"}
                      data-active={active ? "true" : "false"}
                      className={`h-8 px-3 text-xs font-medium data-[active=true]:shadow-[0_10px_26px_rgba(15,23,42,0.16)] ${extra}`}
                      onClick={() => setDueFilter(v)}
                    >
                      {v}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-[1250px] w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold leading-tight text-slate-600">
                <th className="px-3 py-1.5">Subsección</th>
                <th className="px-3 py-1.5">Último archivo</th>
                <th className="px-3 py-1.5">Archivos</th>
                <th className="px-3 py-1.5">Última carga</th>
                <th className="px-3 py-1.5">Fecha vencimiento</th>
                <th className="px-3 py-1.5">Periodicidad</th>
                <th className="px-3 py-1.5">Estado</th>
                <th className="px-3 py-1.5">Gestión de archivos</th>
                <th className="px-3 py-1.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Cargando...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    <div className="grid gap-3">
                      <span>{loadError ? loadError : "No hay subsecciones para los filtros seleccionados."}</span>
                      {props.canManage ? (
                        <div className="flex justify-center">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 rounded-full border-zinc-300 text-slate-800 hover:bg-zinc-100"
                            onClick={async () => {
                              const res = await ensureDefaultSgSstDesignSections(props.projectId);
                              if (!res.success) {
                                toast.error(res.error || "No se pudo inicializar");
                                return;
                              }
                              toast.success("Subsecciones precargadas creadas");
                              await load();
                            }}
                          >
                            Crear subsecciones precargadas
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const latest = row.files[0] || null;
                  const uploadedAt = latest ? new Date(latest.uploadedAt).toLocaleDateString() : "-";
                  const localDue = localDueDates[row.id] || toDateInputValue(row.dueDate);
                  return (
                    <tr key={row.id} className="border-t hover:bg-slate-50/60">
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-xs text-slate-700">
                        {latest ? (
                          <span className="break-all">{latest.name}</span>
                        ) : (
                          <span className="text-muted-foreground">Sin archivo</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-slate-700">{row._count.files}</td>
                      <td className="px-3 py-1.5 text-xs text-slate-700">{uploadedAt}</td>
                      <td className="px-3 py-1.5">
                        <div className="flex flex-col gap-0.5">
                          <input
                            type="date"
                            className="h-7 w-36 rounded-md border border-slate-200 px-2 text-xs text-slate-900 shadow-sm focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37] disabled:opacity-70 disabled:cursor-not-allowed disabled:bg-slate-50"
                            value={localDue}
                            onChange={(e) => handleDueDateChange(row.id, e.target.value)}
                            disabled={!props.canManage}
                          />
                          {dueErrorById[row.id] ? (
                            <span className="text-[0.7rem] text-red-600">{dueErrorById[row.id]}</span>
                          ) : null}
                          {savingDueId === row.id ? (
                            <span className="text-[0.7rem] text-slate-400">Guardando cambios…</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-xs text-slate-700">{row.periodicity || "-"}</td>
                      <td className="px-3 py-1.5">{getDueBadge(localDue || null)}</td>
                      <td className="px-3 py-1.5">
                        <SgSstDesignFileActions
                          sectionId={row.id}
                          sectionName={row.name}
                          latestFile={latest ? { id: latest.id, name: latest.name, url: latest.url } : null}
                          canManage={!!props.canManage}
                          currentDueDate={localDue || undefined}
                          currentUserRole={props.userRole}
                          onChanged={load}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-[#D4AF37]">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onSelect={() => openEdit(row)} disabled={!props.canManage}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => openDelete(row)}
                                disabled={!props.canManage || row.isDefault}
                                className="text-red-600 focus:text-red-700"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Editar subsección</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nombre" />
            <div className="text-sm font-medium text-slate-900">Periodicidad</div>
            <Select value={editPeriodicity} onValueChange={setEditPeriodicity}>
              <SelectTrigger>
                <SelectValue placeholder="Periodicidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin definir</SelectItem>
                {PERIODICITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-[#D4AF37] text-black hover:bg-[#B59530]"
              disabled={editSaving}
              onClick={async () => {
                if (!editId) return;
                const name = editName.trim();
                if (!name) {
                  toast.error("Nombre requerido");
                  return;
                }
                setEditSaving(true);
                const res = await updateSgSstDesignSection(editId, name, editPeriodicity === "none" ? "" : editPeriodicity);
                setEditSaving(false);
                if (!res.success) {
                  toast.error(res.error || "No se pudo actualizar");
                  return;
                }
                toast.success("Subsección actualizada");
                setEditOpen(false);
                setEditId(null);
                await load();
              }}
            >
              {editSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Eliminar subsección</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-600">
            Esta acción no se puede deshacer. Solo se pueden eliminar subsecciones creadas manualmente y sin archivos cargados.
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteSaving}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteSaving}
              onClick={async () => {
                if (!deleteId) return;
                setDeleteSaving(true);
                const res = await deleteSgSstDesignSection(deleteId);
                setDeleteSaving(false);
                if (!res.success) {
                  toast.error(res.error || "No se pudo eliminar");
                  return;
                }
                toast.success("Subsección eliminada");
                setDeleteOpen(false);
                setDeleteId(null);
                await load();
              }}
            >
              {deleteSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
