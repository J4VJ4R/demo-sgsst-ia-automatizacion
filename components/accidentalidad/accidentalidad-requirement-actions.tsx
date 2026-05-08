'use client'

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Eye, Trash2, History, AlertTriangle, CalendarIcon } from "lucide-react";
import { DocumentPreview } from "@/components/documents/document-preview";
import {
  createAccidentalidadUploadRequest,
  finalizeAccidentalidadUpload,
  getAccidentalidadFileHistory,
  removeAccidentalidadFile,
} from "@/app/actions/accidentalidad-actions";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { parseDateOnly } from "@/lib/accidentalidad-logic";

export type AccidentalidadDoc = {
  id: string;
  name: string;
  url: string;
  uploadedAt: Date | string;
  version: number;
  sizeBytes: number | null;
  uploadedByUser?: {
    name: string | null;
    role?: string | null;
  } | null;
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN_PMD: "Administrador PMD",
  CONSULTANT: "Consultor",
  CLIENT_VIEWER: "Cliente",
  CLIENT: "Cliente",
};

function formatBytes(value?: number | null) {
  if (!value || value <= 0) return "Tamaño desconocido";
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

function formatDateTime(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Fecha desconocida";
  return `${date.toLocaleDateString("es-CO")} ${date.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function AccidentalidadRequirementActions(props: {
  accidentalidadId: string;
  actividadTitle: string;
  projectName: string;
  dueDate: string;
  status: string;
  density?: "default" | "compact";
  latestDoc: { id: string; name: string; url: string } | null;
  documents?: AccidentalidadDoc[];
  canManage?: boolean;
  canDelete?: boolean;
  userRole?: string;
  onDocumentsChange?: (docs: AccidentalidadDoc[]) => void;
  onStatusChange?: (status: string) => void;
}) {
  const {
    accidentalidadId,
    actividadTitle,
    projectName,
    dueDate,
    status,
    density = "default",
    latestDoc,
    documents = [],
    canManage = true,
    canDelete = false,
    userRole,
    onDocumentsChange,
    onStatusChange,
  } = props;

  const [previewDoc, setPreviewDoc] = useState<{
    id: string;
    name: string;
    url: string;
    activity: { title: string; project: { name: string } };
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingFilesRef = useRef<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const dueDateForCalc = dueDate ? dueDate.slice(0, 10) : "";
  const isUploadDisabled = status === "APPROVED";

  const [historyOpen, setHistoryOpen] = useState(false);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [pendingFileMeta, setPendingFileMeta] = useState<{
    files: { name: string; sizeMB: number; isLarge: boolean }[];
    isReplacing: boolean;
    previousName: string | null;
  } | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [historyDocuments, setHistoryDocuments] = useState<AccidentalidadDoc[]>(documents);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const hasHistory = historyDocuments.length > 1;

  const [editDueDate, setEditDueDate] = useState(dueDateForCalc);
  const [dateError, setDateError] = useState<string | null>(null);

  useEffect(() => {
    setHistoryDocuments(documents);
  }, [documents]);

  useEffect(() => {
    if (!replaceDialogOpen) {
      setEditDueDate(dueDateForCalc);
    }
  }, [replaceDialogOpen, dueDateForCalc]);

  const handleOpenFileDialog = () => {
    fileInputRef.current?.click();
  };

  const clearFileSelection = () => {
    pendingFilesRef.current = [];
    setPendingFileMeta(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const softLimitMB = 10;
  const hardLimitMB = 20;

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(event.target.files || []);
    if (fileList.length === 0) return;

    const allowedExt = ["pdf", "doc", "docx", "xls", "xlsx"];
    const accepted: File[] = [];
    let rejected = 0;
    for (const file of fileList) {
      const ext = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : "";
      const sizeMB = file.size / (1024 * 1024);
      const okExt = !!ext && allowedExt.includes(ext);
      const okSize = sizeMB <= hardLimitMB;
      if (!okExt || !okSize) {
        rejected++;
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length === 0) {
      toast.error("No se seleccionaron archivos válidos. Use PDF, DOC, DOCX, XLS o XLSX (máx 20MB).");
      clearFileSelection();
      return;
    }
    if (rejected > 0) {
      toast.info("Algunos archivos fueron omitidos.", {
        description: "Verifique formato (PDF/DOC/DOCX/XLS/XLSX) y tamaño (máx 20MB).",
      });
    }

    pendingFilesRef.current = accepted;
    setPendingFileMeta({
      files: accepted.map((f) => {
        const sizeMB = f.size / (1024 * 1024);
        return { name: f.name, sizeMB, isLarge: sizeMB > softLimitMB };
      }),
      isReplacing: !!latestDoc,
      previousName: latestDoc?.name ?? null,
    });
    setReplaceDialogOpen(true);
  };

  const uploadSingleFile = async (file: File) => {
    try {
      const encryption = "AES256";
      const requestFormData = new FormData();
      requestFormData.append("accidentalidadId", accidentalidadId);
      requestFormData.append("fileName", file.name);
      requestFormData.append("fileType", file.type || "application/octet-stream");
      requestFormData.append("fileSize", file.size.toString());

      const requestResult = await createAccidentalidadUploadRequest(requestFormData);

      if (!requestResult || !requestResult.success || !requestResult.uploadUrl || !requestResult.key) {
        toast.error(requestResult?.error || "No se pudo preparar la subida del documento.");
        return;
      }

      const uploadResponse = await fetch(requestResult.uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "x-amz-server-side-encryption": encryption,
        },
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text().catch(() => "");
        toast.error("Error al subir el archivo a S3.", {
          description: `${uploadResponse.status}${errorText ? ` · ${errorText.slice(0, 160)}` : ""}`,
        });
        return;
      }

      const finalizeFormData = new FormData();
      finalizeFormData.append("accidentalidadId", accidentalidadId);
      finalizeFormData.append("originalName", file.name);
      finalizeFormData.append("key", requestResult.key);
      finalizeFormData.append("fileSize", file.size.toString());
      if (editDueDate) {
        finalizeFormData.append("dueDate", editDueDate);
      }

      const finalizeResult = await finalizeAccidentalidadUpload(finalizeFormData);

      if (!finalizeResult || !finalizeResult.success) {
        toast.error(finalizeResult?.error || "Error al registrar el documento.");
        return null;
      }

      const newDoc: AccidentalidadDoc = {
        id: finalizeResult.file.id,
        name: finalizeResult.file.name,
        url: finalizeResult.file.url,
        uploadedAt: finalizeResult.file.uploadedAt,
        version: finalizeResult.file.version,
        sizeBytes: finalizeResult.file.sizeBytes,
        uploadedByUser: null,
      };

      return newDoc;
    } catch (error) {
      console.error(error);
      if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
        toast.error("Error de conexión con S3 (posible CORS).", {
          description: "Verifique su conexión a internet y la configuración CORS del bucket.",
          duration: 8000,
        });
      } else {
        toast.error("Error inesperado al subir el documento.");
      }
      return null;
    }
  };

  const handleCancelReplace = () => {
    if (isUploading) return;
    setReplaceDialogOpen(false);
    clearFileSelection();
    setDateError(null);
  };

  const handleConfirmReplace = async () => {
    if (pendingFilesRef.current.length === 0) {
      setReplaceDialogOpen(false);
      return;
    }

    if (editDueDate) {
      const parsed = parseDateOnly(editDueDate);
      if (!parsed) {
        setDateError("Fecha inválida.");
        return;
      }
      setDateError(null);
    } else {
      setDateError("Fecha requerida.");
      return;
    }
    setIsUploading(true);
    try {
      const created: AccidentalidadDoc[] = [];
      for (const file of pendingFilesRef.current) {
        const doc = await uploadSingleFile(file);
        if (doc) created.push(doc);
      }
      if (created.length > 0) {
        const nextDocs = [...created.reverse(), ...historyDocuments];
        setHistoryDocuments(nextDocs);
        onDocumentsChange?.(nextDocs);
        onStatusChange?.("IN_REVIEW");
        toast.success(created.length === 1 ? "Documento subido exitosamente." : "Documentos subidos exitosamente.");
      }
      setReplaceDialogOpen(false);
    } finally {
      setIsUploading(false);
      clearFileSelection();
    }
  };

  const openHistory = async () => {
    setHistoryOpen(true);
    if (documents.length > 1) {
      setHistoryDocuments(documents);
      return;
    }
    setLoadingHistory(true);
    try {
      const result = await getAccidentalidadFileHistory(accidentalidadId);
      if (result.success && result.files) {
        const mapped = (result.files as any[]).map((d) => ({
          id: d.id,
          name: d.name,
          url: d.url,
          uploadedAt: d.uploadedAt,
          version: d.version,
          sizeBytes: d.sizeBytes ?? null,
          uploadedByUser: d.uploadedByUser
            ? { name: d.uploadedByUser.name, role: d.uploadedByUser.role }
            : null,
        })) as AccidentalidadDoc[];
        setHistoryDocuments(mapped);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDeleteClick = (doc: { id: string; name: string }) => {
    setDocumentToDelete(doc);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirmed = async () => {
    if (!documentToDelete) return;
    setIsDeleting(true);
    try {
      const fd = new FormData();
      fd.append("fileId", documentToDelete.id);
      const result = await removeAccidentalidadFile(fd);
      if (!result.success) {
        toast.error(result.error || "Error al eliminar el documento.");
        return;
      }
      const nextDocs = historyDocuments.filter((d) => d.id !== documentToDelete.id);
      setHistoryDocuments(nextDocs);
      onDocumentsChange?.(nextDocs);
      if (result.remaining === 0) {
        onStatusChange?.("PENDING");
      }
      toast.success("Documento eliminado.");
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    } catch (e) {
      console.error(e);
      toast.error("Error al eliminar el documento.");
    } finally {
      setIsDeleting(false);
    }
  };

  const buttonHeight = density === "compact" ? "h-7" : "h-8";
  const buttonText = density === "compact" ? "text-xs" : "text-sm";
  const buttonGap = density === "compact" ? "gap-1.5" : "gap-2";
  const iconSize = density === "compact" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <>
      <div className={`flex flex-wrap items-center ${buttonGap}`}>
        {!canManage ? null : (
          <>
            <input
              ref={fileInputRef}
              name="file"
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              className="hidden"
              onChange={handleFileSelected}
            />

            {isUploadDisabled ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={`${buttonHeight} ${buttonText} rounded-full border-zinc-300 text-slate-400 bg-slate-50 cursor-not-allowed`}
                        disabled
                      >
                        <Upload className={`${iconSize} mr-1`} />
                        {latestDoc ? "Agregar archivo" : "Carga de archivo"}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {status === "APPROVED"
                        ? "La carga no está disponible porque la actividad ya fue aprobada."
                        : "La carga no está disponible."}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={`${buttonHeight} ${buttonText} rounded-full border-zinc-300 text-slate-800 hover:bg-zinc-100`}
                title={latestDoc ? "Subir un nuevo archivo para reemplazar el existente" : "Cargar archivo"}
                onClick={handleOpenFileDialog}
                disabled={isUploading}
              >
                <Upload className={`${iconSize} mr-1`} />
                {isUploading ? "Subiendo..." : latestDoc ? "Agregar archivo" : "Carga de archivo"}
              </Button>
            )}
          </>
        )}

        {latestDoc && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`${buttonHeight} ${buttonText} rounded-full border-zinc-300 text-slate-800 hover:bg-zinc-100`}
              title="Ver documento"
              onClick={() => {
                if (!latestDoc?.url) {
                  toast.error("Documento no disponible");
                  return;
                }
                setPreviewDoc({
                  id: latestDoc.id,
                  name: latestDoc.name,
                  url: latestDoc.url,
                  activity: {
                    title: actividadTitle,
                    project: { name: projectName },
                  },
                });
              }}
            >
              <Eye className={`${iconSize} mr-1`} />
              Ver
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`${buttonHeight} ${buttonText} rounded-full border-zinc-300 text-slate-800 hover:bg-zinc-100`}
              title="Mostrar versiones anteriores"
              onClick={openHistory}
            >
              <History className={`${iconSize} mr-1`} />
              Historial
              {hasHistory && (
                <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
              )}
            </Button>

            {canDelete && canManage && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={`${buttonHeight} ${buttonText} rounded-full border-red-200 text-red-700 hover:bg-red-50`}
                title="Quitar archivo"
                onClick={() => handleDeleteClick({ id: latestDoc.id, name: latestDoc.name })}
              >
                <Trash2 className={`${iconSize} mr-1`} />
                Quitar
              </Button>
            )}
          </>
        )}
      </div>

      {previewDoc && (
        <DocumentPreview
          key={previewDoc.id}
          document={previewDoc}
          documents={documents.map((d) => ({ id: d.id, name: d.name, url: d.url }))}
          currentUserRole={userRole}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-[720px] rounded-3xl border border-white/70 bg-gradient-to-br from-white/95 via-white/90 to-slate-50/95 px-6 pb-5 pt-6 shadow-[0_22px_80px_rgba(15,23,42,0.48)] backdrop-blur-2xl transition-all duration-200 ease-out dark:from-slate-900/95 dark:via-slate-900/90 dark:to-slate-950/95">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-[clamp(1.05rem,1.1vw+0.9rem,1.25rem)] font-semibold tracking-tight text-slate-900">
              Historial de versiones
            </DialogTitle>
            <DialogDescription className="text-[0.9rem] leading-relaxed text-slate-600">
              Consulta todas las versiones cargadas, quién las subió y descárgalas cuando lo necesites.
            </DialogDescription>
          </DialogHeader>

          {loadingHistory ? (
            <div className="flex justify-center p-8">
              <span className="animate-spin h-6 w-6 border-2 border-current border-t-transparent text-slate-400 rounded-full" />
            </div>
          ) : historyDocuments.length === 0 ? (
            <div className="mt-4 rounded-2xl bg-white/80 p-4 text-sm text-slate-500 shadow-[0_16px_48px_rgba(15,23,42,0.2)] ring-1 ring-slate-100/90 dark:bg-slate-900/80 dark:text-slate-300 dark:ring-slate-800/90">
              No hay información de versiones disponible para esta actividad.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-white/80 p-3 shadow-[0_18px_52px_rgba(15,23,42,0.35)] ring-1 ring-slate-100/90 dark:bg-slate-900/80 dark:ring-slate-800/90">
                <div className="mb-2 flex items-center justify-between gap-3 text-[0.75rem] sm:text-xs">
                  <div className="flex flex-wrap items-center gap-2 text-slate-600">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[0.7rem] font-medium text-slate-700 shadow-inner">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Versión actual: v{historyDocuments[0]?.version ?? 1}
                    </span>
                    {historyDocuments.length > 1 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 text-[0.7rem] font-medium text-purple-700 ring-1 ring-purple-100">
                        {historyDocuments.length} versiones guardadas
                      </span>
                    )}
                  </div>
                  <span className="text-[0.7rem] text-slate-400">
                    Las versiones se ordenan de la más reciente a la más antigua.
                  </span>
                </div>
                <div className="max-h-80 overflow-y-auto rounded-2xl bg-gradient-to-b from-slate-50/70 via-white/90 to-slate-50/60 p-2">
                  <table className="min-w-full text-[0.75rem] sm:text-xs">
                    <thead className="sticky top-0 z-10 bg-gradient-to-r from-white/95 via-white/95 to-slate-50/95 text-slate-500 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-md">
                      <tr className="text-left">
                        <th className="px-3 py-2 font-medium">Versión</th>
                        <th className="px-3 py-2 font-medium">Fecha de carga</th>
                        <th className="px-3 py-2 font-medium">Nombre</th>
                        <th className="px-3 py-2 font-medium">Tamaño</th>
                        <th className="px-3 py-2 font-medium">Usuario</th>
                        <th className="px-3 py-2 font-medium">Rol</th>
                        <th className="px-3 py-2 text-right font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyDocuments.map((doc, index) => (
                        <tr
                          key={doc.id}
                          className="border-t border-slate-100/80 last:border-b hover:bg-white/80 dark:border-slate-800/80 dark:hover:bg-slate-900/80"
                        >
                          <td className="px-3 py-2 align-top">
                            <span
                              className={[
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[0.7rem] font-semibold shadow-inner",
                                index === 0
                                  ? "bg-gradient-to-r from-[#D4AF37] via-[#D4AF37] to-[#f6e6a9] text-black"
                                  : "bg-slate-100 text-slate-700",
                              ].join(" ")}
                            >
                              v{doc.version}
                            </span>
                          </td>
                          <td className="px-3 py-2 align-top text-slate-700 dark:text-slate-200">
                            {formatDateTime(doc.uploadedAt)}
                          </td>
                          <td className="px-3 py-2 align-top">
                            <div className="line-clamp-2 break-all text-slate-800 dark:text-slate-100">
                              {doc.name}
                            </div>
                          </td>
                          <td className="px-3 py-2 align-top text-slate-700 dark:text-slate-200">
                            {formatBytes(doc.sizeBytes)}
                          </td>
                          <td className="px-3 py-2 align-top text-slate-700 dark:text-slate-200">
                            {doc.uploadedByUser?.name || "No registrado"}
                          </td>
                          <td className="px-3 py-2 align-top text-slate-700 dark:text-slate-200">
                            {doc.uploadedByUser?.role
                              ? ROLE_LABELS[doc.uploadedByUser.role] || doc.uploadedByUser.role
                              : "Desconocido"}
                          </td>
                          <td className="px-3 py-2 align-top text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="h-7 rounded-full border-slate-300/80 bg-white/90 px-3 text-[0.7rem] font-medium text-slate-800 shadow-[0_8px_22px_rgba(15,23,42,0.25)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-slate-100 hover:shadow-[0_14px_32px_rgba(15,23,42,0.35)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400"
                              >
                                <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                  Descargar
                                </a>
                              </Button>
                              {canDelete && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteClick({ id: doc.id, name: doc.name })}
                                  className="h-7 w-7 rounded-full border-red-200 bg-red-50 p-0 text-red-600 shadow-sm transition-all hover:bg-red-100 hover:text-red-700 hover:border-red-300"
                                  title="Eliminar esta versión"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setHistoryOpen(false)}
              className="h-10 rounded-full border-slate-300/80 bg-white/85 px-5 text-sm font-medium text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.2)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-slate-100 hover:shadow-[0_16px_40px_rgba(15,23,42,0.28)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={replaceDialogOpen}
        onOpenChange={(open) => {
          if (!open && isUploading) return;
          setReplaceDialogOpen(open);
          if (!open) {
            clearFileSelection();
            setDateError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[440px] rounded-3xl border border-white/70 bg-gradient-to-br from-white/95 via-white/90 to-slate-50/95 px-6 pb-5 pt-6 shadow-[0_22px_80px_rgba(15,23,42,0.48)] backdrop-blur-2xl transition-all duration-200 ease-out dark:from-slate-900/95 dark:via-slate-900/90 dark:to-slate-950/95">
          <DialogHeader className="space-y-3">
            <div className="inline-flex items-center gap-3 rounded-full bg-white/70 px-3 py-1.5 shadow-[0_14px_40px_rgba(15,23,42,0.18)] ring-1 ring-slate-100/80 dark:bg-slate-900/70 dark:ring-slate-800/80">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#D4AF37] via-[#D4AF37] to-purple-500/80 shadow-[0_8px_22px_rgba(24,18,56,0.6)]">
                <Upload className="h-5 w-5 text-black" />
              </div>
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Actualizar actividad
              </span>
            </div>
            <DialogTitle className="text-[clamp(1.05rem,1.1vw+0.9rem,1.25rem)] font-semibold tracking-tight text-slate-900">
              {pendingFileMeta?.isReplacing ? "Reemplazar archivo existente" : "Subir nuevo archivo"}
            </DialogTitle>
            <DialogDescription className="text-[0.9rem] leading-relaxed text-slate-600">
              {pendingFileMeta?.isReplacing
                ? "El nuevo archivo se convertirá en la versión vigente. Conservaremos todas las versiones anteriores para que puedas consultarlas desde el historial."
                : "El archivo se asociará a esta actividad y quedará disponible para revisión."}
            </DialogDescription>
          </DialogHeader>

          {pendingFileMeta && (
            <div className="mt-4 space-y-3 text-xs sm:text-sm">
              <div className="grid grid-cols-1 gap-3 rounded-2xl bg-white/80 p-3 shadow-[0_16px_48px_rgba(15,23,42,0.2)] ring-1 ring-slate-100/90 dark:bg-slate-900/80 dark:ring-slate-800/90">
                {pendingFileMeta.previousName && (
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-[0.7rem] font-medium uppercase tracking-[0.22em] text-slate-500">
                        Archivo actual
                      </p>
                      <p className="line-clamp-2 break-all text-[0.8rem] font-medium text-slate-800">
                        {pendingFileMeta.previousName}
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[0.7rem] font-semibold text-slate-600 shadow-inner">
                      v{historyDocuments[0]?.version ?? 1}
                    </span>
                  </div>
                )}

                <div className="flex flex-col gap-3 rounded-2xl bg-gradient-to-br from-slate-50/90 via-white/90 to-purple-50/90 p-3 shadow-[0_12px_34px_rgba(88,28,135,0.35)] ring-1 ring-purple-100/80 dark:from-slate-900/90 dark:via-slate-900/90 dark:to-slate-950/90 dark:ring-purple-900/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-[0.7rem] font-medium uppercase tracking-[0.22em] text-slate-600">
                        Nuevos archivos
                      </p>
                      <div className="space-y-1">
                        {pendingFileMeta.files.slice(0, 4).map((f) => (
                          <p key={f.name} className="line-clamp-1 break-all text-[0.86rem] font-semibold text-slate-900">
                            {f.name}
                          </p>
                        ))}
                        {pendingFileMeta.files.length > 4 ? (
                          <p className="text-[0.78rem] font-medium text-slate-600">
                            +{pendingFileMeta.files.length - 4} más
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="inline-flex items-center rounded-full bg-purple-600 text-[0.7rem] font-semibold text-white shadow-[0_10px_26px_rgba(88,28,135,0.7)]">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/90 text-[0.75rem] font-semibold">
                          ⬆
                        </span>
                        <span className="px-2">
                          {pendingFileMeta.files.length} archivo(s)
                        </span>
                      </span>
                      {pendingFileMeta.files.some((f) => f.isLarge) && (
                        <span className="text-[0.68rem] font-medium text-yellow-700">
                          Tamaño superior a {softLimitMB}MB, puede tardar unos segundos más.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-white/80 p-3 shadow-[0_16px_48px_rgba(15,23,42,0.2)] ring-1 ring-slate-100/90 dark:bg-slate-900/80 dark:ring-slate-800/90 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="dueDate" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Fecha del accidente
                    </Label>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <CalendarIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          id="dueDate"
                          type="date"
                          className="pl-9 h-9 text-sm"
                          value={editDueDate}
                          onChange={(e) => {
                            setEditDueDate(e.target.value);
                            setDateError(null);
                          }}
                        />
                      </div>
                    </div>
                    {dateError && <p className="text-xs font-medium text-red-500 animate-pulse">{dateError}</p>}
                  </div>
                </div>
              </div>

              <p className="text-[0.78rem] leading-relaxed text-slate-500">
                Podrás revisar o descargar versiones anteriores desde el botón{" "}
                <span className="font-semibold text-slate-700">Historial</span> una vez guardado el cambio.
              </p>
            </div>
          )}

          <DialogFooter className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelReplace}
              disabled={isUploading}
              className="h-10 rounded-full border-slate-300/80 bg-white/85 px-5 text-sm font-medium text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.2)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-slate-100 hover:shadow-[0_16px_40px_rgba(15,23,42,0.28)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmReplace}
              disabled={isUploading}
              className="group relative h-10 rounded-full bg-gradient-to-r from-[#D4AF37] via-[#D4AF37] to-[#f6e6a9] px-6 text-sm font-semibold tracking-tight text-black shadow-[0_18px_50px_rgba(24,18,56,0.6)] transition-all duration-200 hover:-translate-y-[1.5px] hover:shadow-[0_24px_70px_rgba(24,18,56,0.7)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#D4AF37]"
            >
              <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-black/5 text-[0.8rem] font-semibold shadow-[0_4px_10px_rgba(15,23,42,0.3)] transition-transform duration-200 group-hover:translate-y-[-1px]">
                {isUploading ? "…" : "↻"}
              </span>
              {isUploading
                ? pendingFileMeta?.isReplacing
                  ? "Reemplazando..."
                  : "Subiendo..."
                : pendingFileMeta?.isReplacing
                  ? "Aceptar y reemplazar"
                  : "Aceptar y cargar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-3xl border border-red-100 bg-white p-6 shadow-xl dark:border-red-900 dark:bg-slate-950">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 ring-4 ring-red-50 dark:bg-red-900/30 dark:ring-red-900/10">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                ¿Eliminar documento?
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 dark:text-slate-400">
                Está a punto de eliminar el documento{" "}
                <span className="font-medium text-slate-900 dark:text-slate-200">
                  "{documentToDelete?.name}"
                </span>
                .
              </DialogDescription>
            </div>
          </div>
          <DialogFooter className="mt-6 sm:justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="rounded-full border-slate-200 px-5"
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleDeleteConfirmed}
              disabled={isDeleting}
              className="rounded-full bg-red-600 px-5 hover:bg-red-700"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
