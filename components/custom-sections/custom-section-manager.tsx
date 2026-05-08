"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Eye, History, Pencil, Trash2, Upload, X } from "lucide-react";
import {
  attachCustomProjectSectionActivityDocument,
  createCustomProjectSectionActivity,
  createCustomSectionUploadRequest,
  getCustomProjectSectionActivityHistory,
  listCustomProjectSectionActivityDocuments,
  removeCustomProjectSectionActivityDocument,
  softDeleteCustomProjectSectionActivity,
  type CustomSectionActivityListItem,
  type CustomSectionActivityHistoryItem,
  updateCustomProjectSectionActivity,
} from "@/app/custom-sections-actions";
import { Badge } from "@/components/ui/badge";
import { calculatePriority } from "@/lib/priority-logic";
import { CustomSectionDocumentsPreview, type CustomSectionPreviewDocument } from "@/components/documents/custom-section-documents-preview";

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha desconocida";
  return `${date.toLocaleDateString("es-CO")} ${date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN_PMD: "Administrador SG-SST-IA",
  CONSULTANT: "Consultor",
  CLIENT_VIEWER: "Cliente",
  CLIENT: "Cliente",
  GESTOR: "Gestor",
};

export function CustomSectionManager(props: {
  projectId: string;
  sectionId: string;
  sectionName: string;
  canManage: boolean;
  initialActivities: CustomSectionActivityListItem[];
}) {
  const router = useRouter();
  const createFileInputRef = useRef<HTMLInputElement | null>(null);
  const rowFileInputRef = useRef<HTMLInputElement | null>(null);
  const rowUploadTargetRef = useRef<string | null>(null);

  const [openCreate, setOpenCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [activities, setActivities] = useState<CustomSectionActivityListItem[]>(props.initialActivities);

  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDueDate, setEditDueDate] = useState("");

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDocs, setHistoryDocs] = useState<CustomSectionPreviewDocument[]>([]);
  const [historyTargetName, setHistoryTargetName] = useState<string>("");
  const [removeDocOpen, setRemoveDocOpen] = useState(false);
  const [removeDocTarget, setRemoveDocTarget] = useState<{ id: string; activityName: string; documentName: string | null } | null>(null);
  const [removingDoc, setRemovingDoc] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewDocs, setPreviewDocs] = useState<CustomSectionPreviewDocument[]>([]);

  useEffect(() => {
    setActivities(props.initialActivities);
  }, [props.initialActivities]);

  const canSubmit = useMemo(() => {
    return name.trim().length > 0 && !saving;
  }, [name, saving]);

  const handleRowFileClick = (activityId: string) => {
    rowUploadTargetRef.current = activityId;
    rowFileInputRef.current?.click();
  };

  const uploadAndAttach = async (targetActivityId: string, picked: File) => {
    const req = await createCustomSectionUploadRequest({
      projectId: props.projectId,
      sectionId: props.sectionId,
      file: { name: picked.name, type: picked.type || "application/octet-stream", sizeBytes: picked.size },
    });
    if (!req.success) throw new Error(req.error || "No se pudo preparar la carga.");
    const res = await fetch(req.upload.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": picked.type || "application/octet-stream", "x-amz-server-side-encryption": "AES256" },
      body: picked,
    });
    if (!res.ok) throw new Error(`Error al subir "${picked.name}"`);
    const attach = await attachCustomProjectSectionActivityDocument({
      projectId: props.projectId,
      activityId: targetActivityId,
      document: { name: req.upload.name, url: req.upload.url, key: req.upload.key, sizeBytes: req.upload.sizeBytes },
    });
    if (!attach.success) throw new Error(attach.error || "No se pudo asociar el documento.");
  };

  const openPreview = async (a: CustomSectionActivityListItem) => {
    try {
      setPreviewOpen(true);
      setPreviewLoading(true);
      const res = await listCustomProjectSectionActivityDocuments({ projectId: props.projectId, activityId: a.id });
      if (!res.success) throw new Error(res.error || "No se pudieron cargar los documentos.");
      setPreviewDocs(res.documents.map((d) => ({ id: d.id, name: d.name, url: d.url })));
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se pudieron cargar los documentos.";
      toast.error(message);
      setPreviewDocs([]);
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const openEdit = (a: CustomSectionActivityListItem) => {
    setEditingId(a.id);
    setEditName(a.name);
    setEditDueDate(a.dueDate || "");
    setEditOpen(true);
  };

  const openDelete = (a: CustomSectionActivityListItem) => {
    setDeleteTarget({ id: a.id, name: a.name });
    setDeleteOpen(true);
  };

  const openRemoveDoc = (a: CustomSectionActivityListItem) => {
    setRemoveDocTarget({ id: a.id, activityName: a.name, documentName: a.documentName || null });
    setRemoveDocOpen(true);
  };

  const openHistory = async (a: CustomSectionActivityListItem) => {
    try {
      setHistoryOpen(true);
      setHistoryLoading(true);
      setHistoryTargetName(a.name);
      const res = await listCustomProjectSectionActivityDocuments({ projectId: props.projectId, activityId: a.id });
      if (!res.success) throw new Error(res.error || "No se pudo cargar el historial.");
      setHistoryDocs(res.documents.map((d) => ({ id: d.id, name: d.name, url: d.url })));
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se pudo cargar el historial.";
      toast.error(message);
      setHistoryDocs([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDueDateChange = async (a: CustomSectionActivityListItem, next: string) => {
    setActivities((prev) => prev.map((x) => (x.id === a.id ? { ...x, dueDate: next || null } : x)));
    try {
      const res = await updateCustomProjectSectionActivity({
        projectId: props.projectId,
        activityId: a.id,
        name: a.name,
        dueDate: next || null,
      });
      if (!res.success) throw new Error(res.error || "No se pudo actualizar.");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar.";
      toast.error(message);
      router.refresh();
    }
  };

  const handleRemoveDocument = async (a: CustomSectionActivityListItem) => {
    openRemoveDoc(a);
  };

  return (
    <Card className="gap-2 py-3">
      <CardHeader className="px-3 gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-1">
          <CardTitle>{props.sectionName}</CardTitle>
          <p className="text-sm leading-[1.5] text-slate-600">Módulo personalizado.</p>
        </div>
        {props.canManage ? (
          <Button className="bg-[#D4AF37] text-black hover:bg-[#B59530]" onClick={() => setOpenCreate(true)}>
            Agregar actividad
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="px-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          {activities.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-600">Aún no hay actividades.</div>
          ) : (
            <>
              <div className="grid gap-3 sm:hidden">
                {activities.map((a) => {
                  const priority = a.dueDate ? calculatePriority(new Date(a.dueDate)) : null;
                  const badgeText = priority?.priority || "—";
                  const badgeClass = priority?.color || "bg-slate-100 text-slate-800";
                  const buttons: Array<{ key: string; node: ReactNode }> = [];
                  if (props.canManage) {
                    buttons.push({
                      key: "upload",
                      node: (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full justify-center gap-2"
                          onClick={() => handleRowFileClick(a.id)}
                        >
                          <Upload className="h-4 w-4" />
                          Archivo
                        </Button>
                      ),
                    });
                  }
                  if (a.documentUrl) {
                    buttons.push({
                      key: "view",
                      node: (
                        <Button type="button" variant="outline" size="sm" className="w-full justify-center gap-2" onClick={() => openPreview(a)}>
                          <Eye className="h-4 w-4" />
                          Ver
                        </Button>
                      ),
                    });
                  }
                  buttons.push({
                    key: "history",
                    node: (
                      <Button type="button" variant="outline" size="sm" className="w-full justify-center gap-2" onClick={() => openHistory(a)}>
                        <History className="h-4 w-4" />
                        Historial
                      </Button>
                    ),
                  });
                  if (props.canManage) {
                    buttons.push({
                      key: "edit",
                      node: (
                        <Button type="button" variant="outline" size="sm" className="w-full justify-center gap-2" onClick={() => openEdit(a)}>
                          <Pencil className="h-4 w-4" />
                          Editar
                        </Button>
                      ),
                    });
                  }
                  if (props.canManage && a.documentUrl) {
                    buttons.push({
                      key: "remove-doc",
                      node: (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full justify-center gap-2 border-red-200 text-red-700 hover:bg-red-50"
                          onClick={() => handleRemoveDocument(a)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar archivo
                        </Button>
                      ),
                    });
                  }
                  if (props.canManage) {
                    buttons.push({
                      key: "delete",
                      node: (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full justify-center gap-2 border-red-200 text-red-700 hover:bg-red-50"
                          onClick={() => openDelete(a)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar actividad
                        </Button>
                      ),
                    });
                  }

                  const lastFullWidthIndex = buttons.length % 2 === 1 ? buttons.length - 1 : -1;
                  const fullWidthKeys = new Set<string>(["remove-doc", "delete"]);
                  return (
                    <div key={a.id} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900">{a.name}</div>
                          <div className="mt-1">
                            <Badge className={badgeClass}>{badgeText}</Badge>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3">
                        <div className="grid gap-2">
                          <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Vence</div>
                          <Input
                            type="date"
                            value={a.dueDate || ""}
                            disabled={!props.canManage}
                            onChange={(e) => handleDueDateChange(a, e.target.value)}
                          />
                        </div>

                        <div className="grid gap-1">
                          <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Documento</div>
                          {a.documentName ? (
                            <div className="truncate text-sm text-slate-900">{a.documentName}</div>
                          ) : (
                            <div className="text-sm text-slate-500">—</div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          {buttons.map((b, idx) => (
                            <div key={b.key} className={idx === lastFullWidthIndex || fullWidthKeys.has(b.key) ? "col-span-2" : ""}>
                              {b.node}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Vence</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activities.map((a) => {
                      const priority = a.dueDate ? calculatePriority(new Date(a.dueDate)) : null;
                      const badgeText = priority?.priority || "—";
                      const badgeClass = priority?.color || "bg-slate-100 text-slate-800";
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium text-slate-900">{a.name}</TableCell>
                          <TableCell className="min-w-[170px]">
                            <Input
                              type="date"
                              value={a.dueDate || ""}
                              disabled={!props.canManage}
                              onChange={(e) => handleDueDateChange(a, e.target.value)}
                            />
                          </TableCell>
                          <TableCell>
                            <Badge className={badgeClass}>{badgeText}</Badge>
                          </TableCell>
                          <TableCell>
                            {a.documentName ? (
                              <div className="min-w-0">
                                <div className="min-w-0 truncate text-sm text-slate-900">{a.documentName}</div>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-500">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              {props.canManage ? (
                                <Button type="button" variant="outline" size="sm" onClick={() => handleRowFileClick(a.id)}>
                                  <Upload className="h-4 w-4" />
                                  Agregar archivo
                                </Button>
                              ) : null}
                              {a.documentUrl ? (
                                <Button type="button" variant="outline" size="sm" onClick={() => openPreview(a)}>
                                  <Eye className="h-4 w-4" />
                                  Ver
                                </Button>
                              ) : null}
                              <Button type="button" variant="outline" size="sm" onClick={() => openHistory(a)}>
                                <History className="h-4 w-4" />
                                Historial
                              </Button>
                              {props.canManage ? (
                                <Button type="button" variant="outline" size="sm" onClick={() => openEdit(a)}>
                                  <Pencil className="h-4 w-4" />
                                  Editar
                                </Button>
                              ) : null}
                              {props.canManage && a.documentUrl ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="border-red-200 text-red-700 hover:bg-red-50"
                                  onClick={() => handleRemoveDocument(a)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Eliminar archivo
                                </Button>
                              ) : null}
                              {props.canManage ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="border-red-200 text-red-700 hover:bg-red-50"
                                  onClick={() => openDelete(a)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Eliminar actividad
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        <input
          ref={rowFileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={async (e) => {
            const list = Array.from(e.target.files || []);
            const targetId = rowUploadTargetRef.current;
            e.target.value = "";
            if (list.length === 0 || !targetId) return;
            try {
              for (const f of list) {
                await uploadAndAttach(targetId, f);
              }
              toast.success(list.length === 1 ? "Archivo cargado." : "Archivos cargados.");
              router.refresh();
            } catch (err) {
              const message = err instanceof Error ? err.message : "No se pudo cargar el archivo.";
              toast.error(message);
            } finally {
              rowUploadTargetRef.current = null;
            }
          }}
        />

        <Dialog open={openCreate} onOpenChange={(next) => (saving ? null : setOpenCreate(next))}>
          <DialogContent className="max-w-[720px]">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle>Agregar actividad</DialogTitle>
              <Button type="button" variant="outline" disabled={saving} onClick={() => setOpenCreate(false)}>
                <X className="h-4 w-4" />
                Cerrar
              </Button>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <div className="text-sm font-medium text-slate-900">Nombre</div>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la actividad" />
              </div>
              <div className="grid gap-2">
                <div className="text-sm font-medium text-slate-900">Fecha de vencimiento</div>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <div className="text-sm font-medium text-slate-900">Documento</div>
                <div className="flex items-center gap-2">
                  <input
                    ref={createFileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  />
                  <Button type="button" variant="outline" disabled={saving} onClick={() => createFileInputRef.current?.click()}>
                    Cargar
                  </Button>
                  {files.length > 0 ? (
                    <div className="min-w-0 truncate text-sm text-slate-700">{files.length === 1 ? files[0].name : `${files.length} archivos`}</div>
                  ) : (
                    <div className="text-sm text-slate-500">Opcional</div>
                  )}
                  {files.length > 0 ? (
                    <Button type="button" variant="outline" disabled={saving} onClick={() => setFiles([])}>
                      <X className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" disabled={saving} onClick={() => setOpenCreate(false)}>
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

                    const created = await createCustomProjectSectionActivity({
                      projectId: props.projectId,
                      sectionId: props.sectionId,
                      name,
                      dueDate: dueDate || null,
                      document: null,
                    });
                    if (!created.success) throw new Error(created.error || "No se pudo crear.");

                    if (files.length > 0) {
                      for (const f of files) {
                        await uploadAndAttach(created.activityId, f);
                      }
                    }

                    toast.success("Actividad creada.");
                    setOpenCreate(false);
                    setName("");
                    setDueDate("");
                    setFiles([]);
                    router.refresh();
                  } catch (e) {
                    const message = e instanceof Error ? e.message : "No se pudo crear.";
                    toast.error(message);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <CustomSectionDocumentsPreview
          open={previewOpen}
          onOpenChange={(o) => {
            if (previewLoading) return;
            setPreviewOpen(o);
            if (!o) setPreviewDocs([]);
          }}
          documents={previewDocs}
        />

        <Dialog open={editOpen} onOpenChange={(next) => (saving ? null : setEditOpen(next))}>
          <DialogContent className="max-w-[720px]">
            <DialogHeader>
              <DialogTitle>Editar actividad</DialogTitle>
              <DialogDescription className="text-sm text-slate-600">Actualiza nombre y fecha de vencimiento.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <div className="text-sm font-medium text-slate-900">Nombre</div>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <div className="text-sm font-medium text-slate-900">Fecha de vencimiento</div>
                <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" disabled={saving} onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="bg-[#D4AF37] text-black hover:bg-[#B59530]"
                disabled={saving || editName.trim().length === 0 || !editingId}
                onClick={async () => {
                  if (!editingId) return;
                  try {
                    setSaving(true);
                    const res = await updateCustomProjectSectionActivity({
                      projectId: props.projectId,
                      activityId: editingId,
                      name: editName,
                      dueDate: editDueDate || null,
                    });
                    if (!res.success) throw new Error(res.error || "No se pudo actualizar.");
                    toast.success("Actividad actualizada.");
                    setEditOpen(false);
                    setEditingId(null);
                    router.refresh();
                  } catch (e) {
                    const message = e instanceof Error ? e.message : "No se pudo actualizar.";
                    toast.error(message);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={historyOpen} onOpenChange={(next) => (historyLoading ? null : setHistoryOpen(next))}>
          <DialogContent className="sm:max-w-[720px]">
            <DialogHeader>
              <DialogTitle>Historial - {historyTargetName}</DialogTitle>
            </DialogHeader>
            <div className="overflow-x-auto rounded-md border border-slate-200">
              <table className="min-w-[640px] w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-semibold leading-tight text-slate-600">
                    <th className="px-3 py-1.5">#</th>
                    <th className="px-3 py-1.5">Archivo</th>
                    <th className="px-3 py-1.5 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {historyLoading ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-sm text-muted-foreground">
                        Cargando...
                      </td>
                    </tr>
                  ) : historyDocs.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-sm text-muted-foreground">
                        Sin historial.
                      </td>
                    </tr>
                  ) : (
                    historyDocs.map((h, idx) => (
                      <tr key={h.id} className="border-t">
                        <td className="px-3 py-1.5 text-xs text-slate-700">{`v${idx + 1}`}</td>
                        <td className="px-3 py-1.5 text-xs text-slate-700 break-all">{h.name}</td>
                        <td className="px-3 py-1.5 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPreviewDocs(historyDocs);
                              setPreviewOpen(true);
                            }}
                          >
                            Ver
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setHistoryOpen(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={removeDocOpen} onOpenChange={(next) => (removingDoc ? null : setRemoveDocOpen(next))}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Eliminar archivo</DialogTitle>
              <DialogDescription className="text-sm text-slate-600">
                Se quitará el archivo de la actividad. Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                {removeDocTarget?.activityName || "Actividad"}
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                {removeDocTarget?.documentName || "Archivo"}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" disabled={removingDoc} onClick={() => setRemoveDocOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="bg-red-600 text-white hover:bg-red-700"
                disabled={removingDoc || !removeDocTarget}
                onClick={async () => {
                  if (!removeDocTarget) return;
                  try {
                    setRemovingDoc(true);
                    const res = await removeCustomProjectSectionActivityDocument({
                      projectId: props.projectId,
                      activityId: removeDocTarget.id,
                    });
                    if (!res.success) throw new Error(res.error || "No se pudo quitar el archivo.");
                    toast.success("Archivo quitado.");
                    setRemoveDocOpen(false);
                    setRemoveDocTarget(null);
                    router.refresh();
                  } catch (e) {
                    const message = e instanceof Error ? e.message : "No se pudo quitar el archivo.";
                    toast.error(message);
                  } finally {
                    setRemovingDoc(false);
                  }
                }}
              >
                Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={deleteOpen} onOpenChange={(next) => (deleting ? null : setDeleteOpen(next))}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Eliminar actividad</DialogTitle>
              <DialogDescription className="text-sm text-slate-600">
                Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
              {deleteTarget?.name || "Actividad"}
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" disabled={deleting} onClick={() => setDeleteOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="bg-red-600 text-white hover:bg-red-700"
                disabled={deleting || !deleteTarget}
                onClick={async () => {
                  if (!deleteTarget) return;
                  try {
                    setDeleting(true);
                    const res = await softDeleteCustomProjectSectionActivity({
                      projectId: props.projectId,
                      activityId: deleteTarget.id,
                    });
                    if (!res.success) throw new Error(res.error || "No se pudo eliminar.");
                    toast.success("Actividad eliminada.");
                    setDeleteOpen(false);
                    setDeleteTarget(null);
                    router.refresh();
                  } catch (e) {
                    const message = e instanceof Error ? e.message : "No se pudo eliminar.";
                    toast.error(message);
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

