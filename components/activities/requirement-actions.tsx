'use client'

import { useRef, useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Eye, Trash2, History, AlertTriangle, CalendarIcon } from "lucide-react";
import { DocumentPreview } from "@/components/documents/document-preview";
import { cancelActivityUpload, cancelActivityUploads, createActivityUploadRequest, finalizeActivityUpload, finalizeActivityUploadBatchWithReply, finalizeActivityUploadWithReply, logClientUploadError, removeActivityFile, softDeleteDocument, getActivityHistory } from "@/app/actions";
import { toast } from "sonner";
import { calculatePriority } from "@/lib/priority-logic";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RejectionReasonDialog } from "@/components/activities/rejection-reason-dialog";

export interface RequirementActionsProps {
  activityId: string;
  status?: string;
  rejectionReason?: string | null;
  activityDueDate?: Date | string | null;
  latestDoc: {
    id: string;
    name: string;
    url: string;
    activity: {
      title: string;
      project: { name: string };
    };
  } | null;
  documents?: {
    id: string;
    name: string;
    url: string;
    uploadedAt?: Date | string;
    version?: number | null;
    sizeBytes?: number | null;
    uploadedByUser?: {
      name: string | null;
      role?: string | null;
    } | null;
  }[];
  canManage?: boolean;
  canDelete?: boolean;
  userRole?: string;
  priority?: string | null;
}

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function formatBytes(value?: number | null) {
  if (!value || value <= 0) return "Tamaño desconocido";
  const kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

function formatDateTime(value?: Date | string) {
  if (!value) return "Fecha desconocida";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Fecha desconocida";
  return `${date.toLocaleDateString("es-CO")} ${date.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN_PMD: "Administrador PMD",
  CONSULTANT: "Consultor",
  CLIENT_VIEWER: "Cliente",
  CLIENT: "Cliente",
};

export function RequirementActions({ activityId, status, rejectionReason, activityDueDate, latestDoc, documents = [], canManage = true, canDelete = false, userRole }: RequirementActionsProps) {
  const [previewDoc, setPreviewDoc] = useState<{
    id: string;
    name: string;
    url: string;
    activity: {
      id?: string;
      status?: string;
      title: string;
      project: { name: string };
    };
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingFilesRef = useRef<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  void activityDueDate;
  const isUploadDisabled = (status || "").toUpperCase() === "APPROVED";

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

  // New state for expiration date
  const [dueDate, setDueDate] = useState<string>("");
  const [dateError, setDateError] = useState<string | null>(null);

  const softLimitMB = 10;
  const hardLimitMB = 20;

  const removeActivityFileAction =
    removeActivityFile as unknown as (formData: FormData) => Promise<void>;

  const isReadOnly = !canManage;
  const isConsultant = userRole === "CONSULTANT";
  const mustReplyToAdmin =
    isConsultant &&
    (status || "").toUpperCase() === "REJECTED" &&
    Boolean(rejectionReason?.trim());
  const [replyDraft, setReplyDraft] = useState("");
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const showAiElectricalSuggestion = useMemo(() => {
    const t = (latestDoc?.activity.title || "").toLowerCase();
    const d = replyDraft.toLowerCase();
    const inTitle =
      t.includes("riesgo eléctrico") ||
      t.includes("riesgo electrico") ||
      t.includes("eléctr") ||
      t.includes("electr");
    const inDraft =
      d.includes("distancias") ||
      d.includes("arco") ||
      d.includes("dielec") ||
      d.includes("epp") ||
      d.includes("sobretension") ||
      d.includes("sobretensión");
    return inTitle || inDraft;
  }, [latestDoc?.activity.title, replyDraft]);
  const [pendingFinalize, setPendingFinalize] = useState<{
    originalName: string;
    key: string;
    fileSize: string;
    dueDate: string | null;
  } | null>(null);
  const [sendingReply, setSendingReply] = useState(false);
  
  const [historyDocuments, setHistoryDocuments] = useState(documents);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const hasHistory = (documents.length > 1) || (historyDocuments.length > 1);
  const uploadSpanClass = latestDoc ? "col-span-1" : "col-span-2";

  // Fetch history when dialog opens
  useEffect(() => {
    if (historyOpen && documents.length <= 1) {
      const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
          const result = await getActivityHistory(activityId);
          if (result.success && Array.isArray(result.documents)) {
            // Map to match the interface if needed, currently direct mapping works as types align mostly
            // We need to cast or ensure types match. 
            // The action returns documents with Date objects.
            // The component expects documents with Date | string.
            setHistoryDocuments(
              result.documents as unknown as NonNullable<RequirementActionsProps["documents"]>
            );
          }
        } catch (error) {
          console.error("Failed to fetch history:", error);
        } finally {
          setLoadingHistory(false);
        }
      };
      fetchHistory();
    } else if (historyOpen && documents.length > 1) {
        setHistoryDocuments(documents);
    }
  }, [historyOpen, activityId, documents]);

  // Calculate priority based on dueDate
  const priorityResult = useMemo(() => {
    if (!dueDate) return null;
    // We assume the user picks a date, we calculate priority relative to today
    // The date input string is YYYY-MM-DD (local time usually)
    // We create a date object.
    // Note: calculatePriority takes a Date object.
    // new Date("YYYY-MM-DD") creates a UTC date.
    // We should be careful about timezones.
    // However, input type="date" gives YYYY-MM-DD.
    // Let's treat it as local date by appending time or splitting.
    const [y, m, d] = dueDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d); // Local time 00:00:00
    
    const result = calculatePriority(dateObj);
    return result;
  }, [dueDate]);

  const handleOpenFileDialog = () => {
    fileInputRef.current?.click();
  };

  const logUploadStageError = async (payload: {
    stage: string;
    message?: string;
    stack?: string;
    extra?: Record<string, unknown>;
  }) => {
    try {
      const errorForm = new FormData();
      errorForm.append("activityId", activityId);
      errorForm.append("stage", payload.stage);
      if (payload.message) errorForm.append("message", payload.message);
      if (payload.stack) errorForm.append("stack", payload.stack);
      if (payload.extra) errorForm.append("extra", JSON.stringify(payload.extra));
      await logClientUploadError(errorForm);
    } catch {
      // ignore
    }
  };

  const putToPresignedUrl = async (uploadUrl: string, file: File) => {
    const contentType = file.type || "application/octet-stream";
    const encryption = "AES256";

    const fetchUpload = async () => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 2 * 60 * 1000);
      try {
        const res = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": contentType, "x-amz-server-side-encryption": encryption },
          signal: controller.signal,
        });
        return res;
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    try {
      const res = await fetchUpload();
      const responseText = res.ok ? "" : await res.text().catch(() => "");
      return { ok: res.ok, status: res.status, statusText: res.statusText, responseText };
    } catch (err) {
      const status = await new Promise<number>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", contentType);
        xhr.setRequestHeader("x-amz-server-side-encryption", encryption);
        xhr.timeout = 2 * 60 * 1000;
        xhr.onload = () => resolve(xhr.status);
        xhr.onerror = () => reject(new TypeError("Network error"));
        xhr.ontimeout = () => reject(new TypeError("Timeout"));
        xhr.onabort = () => reject(new TypeError("Aborted"));
        xhr.send(file);
      });

      return { ok: status >= 200 && status < 300, status, statusText: "", responseText: "" };
    }
  };

  const clearFileSelection = () => {
    pendingFilesRef.current = [];
    setPendingFileMeta(null);
    setDueDate("");
    setDateError(null);
    setPendingFinalize(null);
    setReplyDialogOpen(false);
    setReplyError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);

    try {
      if (mustReplyToAdmin) {
        const trimmed = replyDraft.trim();
        if (!trimmed) {
          setReplyError("La respuesta es requerida.");
          toast.error("Debe escribir una respuesta para el administrador.");
          return;
        }
      }

      const requestFormData = new FormData();
      requestFormData.append("activityId", activityId);
      requestFormData.append("fileName", file.name);
      requestFormData.append("fileType", file.type || "application/octet-stream");
      requestFormData.append("fileSize", file.size.toString());

      const requestResult = await createActivityUploadRequest(requestFormData);

      if (!requestResult || !requestResult.success || !requestResult.uploadUrl || !requestResult.key) {
        await logUploadStageError({
          stage: "prepare",
          message: requestResult?.error || "Upload request failed",
          extra: {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          },
        });
        toast.error(requestResult?.error || "No se pudo preparar la subida del documento.");
        return;
      }

      const uploadResult = await putToPresignedUrl(requestResult.uploadUrl, file);
      if (!uploadResult.ok) {
        const responseLower = (uploadResult.responseText || "").toLowerCase();
        const isInvalidAccessKey =
          responseLower.includes("<code>invalidaccesskeyid</code>") ||
          responseLower.includes("invalidaccesskeyid");
        await logUploadStageError({
          stage: "upload",
          message: "Upload to presigned URL failed",
          extra: {
            status: uploadResult.status,
            statusText: uploadResult.statusText,
            responseText: uploadResult.responseText,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          },
        });
        toast.error(
          isInvalidAccessKey
            ? "Credenciales S3 inválidas en el servidor (InvalidAccessKeyId)."
            : uploadResult.status
              ? `Error al subir el archivo (${uploadResult.status}).`
              : "Error de conexión al subir el archivo (posible CORS o red móvil)."
        );
        return;
      }

      const finalizeFormData = new FormData();
      finalizeFormData.append("activityId", activityId);
      finalizeFormData.append("originalName", file.name);
      finalizeFormData.append("key", requestResult.key);
      finalizeFormData.append("fileSize", file.size.toString());

      // Append due date and priority if set (for consultants)
      if (dueDate) {
        finalizeFormData.append("dueDate", dueDate);
      }
      if (mustReplyToAdmin) {
        setPendingFinalize({
          originalName: file.name,
          key: requestResult.key,
          fileSize: file.size.toString(),
          dueDate: dueDate || null,
        });
        setReplyDialogOpen(true);
        return;
      }

      const finalizeResult = await finalizeActivityUpload(finalizeFormData);

      if (!finalizeResult || !finalizeResult.success) {
        await logUploadStageError({
          stage: "finalize",
          message: finalizeResult?.error || "Finalize upload failed",
          extra: {
            fileName: file.name,
            key: requestResult.key,
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          },
        });
        toast.error(finalizeResult?.error || "Error al registrar el documento.");
        return;
      }

      toast.success("Documento subido exitosamente.");
    } catch (error) {
      console.error(error);
      await logUploadStageError({
        stage: "exception",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        extra: {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        },
      });
      
      const msg = error instanceof Error ? error.message : String(error);
      const normalized = msg.toLowerCase();
      if (
        error instanceof TypeError &&
        (normalized.includes("failed to fetch") ||
          normalized.includes("load failed") ||
          normalized.includes("network") ||
          normalized.includes("timeout"))
      ) {
        toast.error("Error de red al subir el archivo.", {
          description:
            "En móviles puede ocurrir por conexión inestable o restricciones CORS. Intente de nuevo con Wi‑Fi o pruebe otro archivo.",
          duration: 8000,
        });
      } else {
        toast.error("Error inesperado al subir el documento.");
      }
    } finally {
      setIsUploading(false);
      if (!mustReplyToAdmin) {
        clearFileSelection();
      }
    }
  };

  const handleConfirmReplace = async () => {
    const files = pendingFilesRef.current;
    if (!files || files.length === 0) {
      setReplaceDialogOpen(false);
      clearFileSelection();
      return;
    }

    if (mustReplyToAdmin) {
      const trimmed = replyDraft.trim();
      if (!trimmed) {
        setReplyError("La respuesta es requerida.");
        toast.error("Debe escribir una respuesta para el administrador.");
        return;
      }
    }

    if (isConsultant && dueDate) {
        // Check if date is future (calculatePriority handles this logic partially, but let's be explicit if needed)
        // calculatePriority returns isValid: false if > 15 days, but user wants "validar que la fecha ingresada sea posterior a la fecha actual"
        // Actually calculatePriority considers past/today as High priority (valid but urgent).
        // The user requirement: "validar que la fecha ingresada sea posterior a la fecha actual"
        const [y, m, d] = dueDate.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const today = new Date();
        today.setHours(0,0,0,0);
        
        if (dateObj <= today) {
             setDateError("La fecha debe ser posterior a la fecha actual.");
             return;
        }

        // Also check if priority is valid (e.g. <= 15 days if that's a hard requirement, but usually it's just a warning)
        // User said: "dejar la misma funcionalidad de la prioridad... respecto a los 15 días"
        // If > 15 days, calculatePriority returns isValid: false with error.
        if (priorityResult && !priorityResult.isValid) {
            setDateError(priorityResult.error || "Fecha inválida.");
            return;
        }
    }

    setIsUploading(true);
    const uploaded: { originalName: string; key: string; fileSize: string }[] = [];
    try {
      for (const file of files) {
        const requestFormData = new FormData();
        requestFormData.append("activityId", activityId);
        requestFormData.append("fileName", file.name);
        requestFormData.append("fileType", file.type || "application/octet-stream");
        requestFormData.append("fileSize", file.size.toString());

        const requestResult = await createActivityUploadRequest(requestFormData);
        if (!requestResult || !requestResult.success || !requestResult.uploadUrl || !requestResult.key) {
          throw new Error(requestResult?.error || "No se pudo preparar la subida.");
        }

        const uploadResult = await putToPresignedUrl(requestResult.uploadUrl, file);
        if (!uploadResult.ok) {
          await logUploadStageError({
            stage: "upload",
            message: "Upload to presigned URL failed (batch)",
            extra: {
              status: uploadResult.status,
              statusText: uploadResult.statusText,
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
            },
          });
          throw new Error(
            uploadResult.status
              ? `Error al subir el archivo (${uploadResult.status}).`
              : "Error de conexión al subir el archivo (posible CORS o red móvil)."
          );
        }

        uploaded.push({
          originalName: file.name,
          key: requestResult.key,
          fileSize: file.size.toString(),
        });
      }

      if (mustReplyToAdmin) {
        const fd = new FormData();
        fd.append("activityId", activityId);
        if (dueDate) fd.append("dueDate", dueDate);
        fd.append("replyMessage", replyDraft.trim());
        fd.append("files", JSON.stringify(uploaded));

        const result = await finalizeActivityUploadBatchWithReply(fd);
        if (!result?.success) {
          throw new Error(result?.error || "Error al enviar la respuesta.");
        }

        toast.success("Archivo(s) subido(s) y respuesta enviada al administrador.");
      } else {
        for (const item of uploaded) {
          const fd = new FormData();
          fd.append("activityId", activityId);
          fd.append("originalName", item.originalName);
          fd.append("key", item.key);
          fd.append("fileSize", item.fileSize);
          if (dueDate) fd.append("dueDate", dueDate);

          const result = await finalizeActivityUpload(fd);
          if (!result?.success) {
            throw new Error(result?.error || "Error al registrar el documento.");
          }
        }

        toast.success(uploaded.length > 1 ? "Documentos subidos exitosamente." : "Documento subido exitosamente.");
      }

      setReplaceDialogOpen(false);
      clearFileSelection();
    } catch (e) {
      const keys = uploaded.map((u) => u.key);
      if (keys.length > 0) {
        const fd = new FormData();
        fd.append("keys", JSON.stringify(keys));
        await cancelActivityUploads(fd);
      }
      const msg = e instanceof Error ? e.message : "Error al subir archivos.";
      toast.error(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelReplace = () => {
    setReplaceDialogOpen(false);
    toast.info("Carga cancelada.");
    clearFileSelection();
  };

  const handleFileSelected = async () => {
    const list = fileInputRef.current?.files;
    if (!list || list.length === 0) return;

    const files = Array.from(list);

    const oversize = files.find((f) => f.size / (1024 * 1024) > hardLimitMB);
    if (oversize) {
      toast.error(`El archivo "${oversize.name}" supera el límite máximo de ${hardLimitMB}MB.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const isReplacing = Boolean(latestDoc) && files.length === 1;

    const metaFiles = files.map((file) => {
      const sizeMB = file.size / (1024 * 1024);
      return { name: file.name, sizeMB, isLarge: sizeMB > softLimitMB };
    });

    const shouldOpenDialog =
      mustReplyToAdmin ||
      isConsultant ||
      isReplacing ||
      metaFiles.some((f) => f.isLarge) ||
      files.length > 1;

    if (shouldOpenDialog) {
      pendingFilesRef.current = files;
      setPendingFileMeta({
        files: metaFiles,
        isReplacing,
        previousName: latestDoc ? latestDoc.name : null,
      });
      setReplaceDialogOpen(true);
      return;
    }

    await uploadFile(files[0]);
  };

  const handleSendReply = async () => {
    if (!pendingFinalize) return;

    const trimmed = replyDraft.trim();
    if (!trimmed) {
      setReplyError("La respuesta es requerida.");
      return;
    }

    setSendingReply(true);
    try {
      const fd = new FormData();
      fd.append("activityId", activityId);
      fd.append("originalName", pendingFinalize.originalName);
      fd.append("key", pendingFinalize.key);
      fd.append("fileSize", pendingFinalize.fileSize);
      if (pendingFinalize.dueDate) fd.append("dueDate", pendingFinalize.dueDate);
      fd.append("replyMessage", trimmed);

      const result = await finalizeActivityUploadWithReply(fd);
      if (!result?.success) {
        toast.error(result?.error || "Error al enviar la respuesta.");
        return;
      }
      toast.success("Respuesta enviada al administrador.");
      clearFileSelection();
      setReplyDraft("");
    } catch (e) {
      console.error(e);
      toast.error("Error inesperado al enviar la respuesta.");
    } finally {
      setSendingReply(false);
    }
  };

  const handleCancelReply = async () => {
    if (pendingFinalize?.key) {
      const fd = new FormData();
      fd.append("key", pendingFinalize.key);
      await cancelActivityUpload(fd);
    }
    toast.info("Envío cancelado.");
    clearFileSelection();
  };

  const handleDeleteClick = (doc: { id: string; name: string }) => {
    setDocumentToDelete(doc);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!documentToDelete) return;

    setIsDeleting(true);
    try {
      const result = await softDeleteDocument(documentToDelete.id);
      if (result.success) {
        toast.success("Documento eliminado correctamente.");
        setDeleteDialogOpen(false);
        setDocumentToDelete(null);
        // The server action calls revalidatePath, which will refresh the server component
        // and update the documents prop.
      } else {
        toast.error(result.error || "Error al eliminar el documento.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error inesperado al eliminar el documento.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        {mustReplyToAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <RejectionReasonDialog reason={rejectionReason} />
          </div>
        )}

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          {!isReadOnly && (
            <>
              <input
                ref={fileInputRef}
                name="file"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleFileSelected}
              />

              {isUploadDisabled ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className={uploadSpanClass}>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full border-zinc-300 bg-slate-50 text-slate-400 cursor-not-allowed sm:w-auto"
                          disabled
                        >
                          <Upload className="h-4 w-4" />
                          {latestDoc ? "Agregar archivo" : "Cargar archivos"}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>La carga no está disponible porque la actividad ya fue aprobada.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={`${uploadSpanClass} w-full justify-center border-zinc-300 text-slate-800 hover:bg-zinc-100 sm:w-auto`}
                  title={latestDoc ? "Subir un nuevo archivo para reemplazar el existente" : "Cargar archivos"}
                  onClick={handleOpenFileDialog}
                  disabled={isUploading}
                >
                  <Upload className="h-4 w-4" />
                  <span className="truncate whitespace-nowrap">
                    {isUploading
                      ? "Subiendo..."
                      : latestDoc
                        ? "Agregar archivo"
                        : "Cargar archivos"}
                  </span>
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
                className="w-full border-zinc-300 text-slate-800 hover:bg-zinc-100 sm:w-auto"
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
                      id: activityId,
                      status,
                      title: latestDoc.activity.title,
                      project: latestDoc.activity.project,
                    },
                  });
                }}
              >
                <Eye className="h-4 w-4" />
                Ver
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-zinc-300 text-slate-800 hover:bg-zinc-100 sm:w-auto"
                title="Mostrar versiones anteriores"
                onClick={() => setHistoryOpen(true)}
              >
                <History className="h-4 w-4" />
                Historial
                {hasHistory && (
                  <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                )}
              </Button>

              {canDelete && !isReadOnly && (
                <form
                  action={removeActivityFileAction}
                  className="col-span-2 sm:col-span-1"
                  onSubmit={(e) => {
                    if (!confirm("¿Está seguro de que desea eliminar este archivo? Esta acción no se puede deshacer.")) {
                      e.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="activityId" value={activityId} />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    className="w-full border-red-200 text-red-700 hover:bg-red-50 sm:w-auto"
                    title="Quitar archivo y dejar el requisito pendiente"
                  >
                    <Trash2 className="h-4 w-4" />
                    Quitar
                  </Button>
                </form>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent
          className="w-[min(94vw,560px)] max-h-[85vh] overflow-y-auto overflow-x-hidden overscroll-none touch-pan-y no-scrollbar border-[#D4AF37]/30 px-0 pb-4 pt-6"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="px-4 sm:px-6">
            <DialogHeader>
            <DialogTitle className="text-[#D4AF37]">Enviar respuesta</DialogTitle>
            <DialogDescription>
              Su respuesta será enviada al administrador junto con el archivo cargado.
            </DialogDescription>
            </DialogHeader>
          </div>
          <div className="mt-4 space-y-2 px-4 sm:px-6">
            <Label className="text-sm text-slate-600">Respuesta</Label>
            <Textarea
              value={replyDraft}
              onChange={(e) => {
                setReplyDraft(e.target.value);
                setReplyError(null);
              }}
              rows={10}
              maxLength={5000}
              className="text-base"
            />
            {showAiElectricalSuggestion ? (
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
                Sugerencia de IA: Según la normativa, se requiere verificación de EPP dieléctricos inmediatamente.
              </div>
            ) : null}
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{replyDraft.trim().length} caracteres</span>
              {replyError ? <span className="text-red-600">{replyError}</span> : <span />}
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:flex-row sm:justify-end sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelReply}
              disabled={sendingReply}
              className="h-11 rounded-xl px-5 text-base font-semibold"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSendReply}
              disabled={sendingReply}
              className="h-11 rounded-xl bg-[#D4AF37] px-6 text-base font-semibold text-black hover:bg-[#B59530]"
            >
              {sendingReply ? "Enviando..." : "Enviar respuesta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-3 rounded-full bg-white/70 px-3 py-1.5 shadow-[0_14px_40px_rgba(15,23,42,0.18)] ring-1 ring-slate-100/80 dark:bg-slate-900/70 dark:ring-slate-800/80">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#D4AF37] via-[#D4AF37] to-purple-500/80 shadow-[0_8px_22px_rgba(24,18,56,0.6)]">
                  <History className="h-5 w-5 text-black" />
                </div>
                <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Historial de versiones
                </span>
              </div>
            </div>
            <DialogTitle className="text-[clamp(1.05rem,1.1vw+0.9rem,1.25rem)] font-semibold tracking-tight text-slate-900">
              Línea de tiempo del documento
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
              No hay información de versiones disponible para este requisito.
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
                              ? (ROLE_LABELS[doc.uploadedByUser.role] || doc.uploadedByUser.role) 
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
          }
        }}
      >
        <DialogContent
          className="w-[min(94vw,520px)] max-h-[85vh] overflow-y-auto overflow-x-hidden overscroll-none touch-pan-y no-scrollbar rounded-3xl border border-white/70 bg-gradient-to-br from-white/95 via-white/90 to-slate-50/95 px-0 pb-4 pt-6 shadow-[0_22px_80px_rgba(15,23,42,0.48)] backdrop-blur-2xl transition-all duration-200 ease-out dark:from-slate-900/95 dark:via-slate-900/90 dark:to-slate-950/95"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="px-4 sm:px-6">
            <DialogHeader className="space-y-3">
            <div className="inline-flex items-center gap-3 rounded-full bg-white/70 px-3 py-1.5 shadow-[0_14px_40px_rgba(15,23,42,0.18)] ring-1 ring-slate-100/80 dark:bg-slate-900/70 dark:ring-slate-800/80">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#D4AF37] via-[#D4AF37] to-purple-500/80 shadow-[0_8px_22px_rgba(24,18,56,0.6)]">
                <Upload className="h-5 w-5 text-black" />
              </div>
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Actualizar requisito
              </span>
            </div>
            <DialogTitle className="text-[clamp(1.05rem,1.1vw+0.9rem,1.25rem)] font-semibold tracking-tight text-slate-900">
              {pendingFileMeta?.isReplacing ? "Reemplazar archivo existente" : "Subir nuevo archivo"}
            </DialogTitle>
            <DialogDescription className="text-[0.9rem] leading-relaxed text-slate-600">
              {pendingFileMeta?.isReplacing
                ? "El nuevo archivo se convertirá en la versión vigente. Conservaremos todas las versiones anteriores para que puedas consultarlas desde el historial."
                : "El archivo se asociará a este requisito y quedará disponible para revisión."}
            </DialogDescription>
            </DialogHeader>
          </div>

          {pendingFileMeta && (
            <div className="mt-4 space-y-4 px-4 sm:px-6">
              {mustReplyToAdmin && (
                <div className="rounded-2xl border border-[#D4AF37]/25 bg-white/85 p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold text-slate-800">
                      Respuesta al administrador
                    </Label>
                    <span className="text-xs text-slate-500">
                      {replyDraft.trim().length} caracteres
                    </span>
                  </div>
                  <Textarea
                    value={replyDraft}
                    onChange={(e) => {
                      setReplyDraft(e.target.value);
                      setReplyError(null);
                    }}
                    rows={6}
                    className="mt-2 text-base"
                    placeholder="Escriba una explicación detallada para el administrador..."
                  />
                  {replyError && (
                    <div className="mt-2 text-xs font-medium text-red-600">{replyError}</div>
                  )}
                </div>
              )}

              {pendingFileMeta.previousName && (
                <div className="rounded-2xl border border-slate-200 bg-white/85 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Archivo actual
                      </div>
                      <div className="mt-1 line-clamp-2 break-all text-sm font-medium text-slate-900">
                        {pendingFileMeta.previousName}
                      </div>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      v{hasHistory ? documents[0]?.version ?? 1 : 1}
                    </span>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white/85 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {pendingFileMeta.files.length > 1 ? "Archivos seleccionados" : "Archivo seleccionado"}
                </div>
                <div className="mt-2 space-y-2">
                  {pendingFileMeta.files.map((f) => (
                    <div key={f.name} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900" title={f.name}>
                          {f.name}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {f.sizeMB.toFixed(2)} MB
                      </span>
                    </div>
                  ))}
                </div>
                {pendingFileMeta.files.some((f) => f.isLarge) && (
                  <div className="mt-2 text-xs font-medium text-yellow-700">
                    Tamaño superior a {softLimitMB}MB, puede tardar unos segundos más.
                  </div>
                )}
              </div>

              {isConsultant && (
                <div className="rounded-2xl border border-slate-200 bg-white/85 p-3 space-y-2">
                  <Label htmlFor="dueDate" className="text-sm font-semibold text-slate-800">
                    Fecha de vencimiento
                  </Label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative w-full min-w-0 flex-1">
                      <CalendarIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        id="dueDate"
                        type="date"
                        className="pl-9 h-11 text-base"
                        value={dueDate}
                        onChange={(e) => {
                          setDueDate(e.target.value);
                          setDateError(null);
                        }}
                        min={new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]}
                      />
                    </div>
                    {priorityResult && (
                      <Badge className={`${priorityResult.color} h-11 w-full justify-center px-3 text-sm sm:w-auto sm:shrink-0`}>
                        Prioridad {priorityResult.priority}
                      </Badge>
                    )}
                  </div>
                  {dateError && (
                    <p className="text-xs font-medium text-red-600">{dateError}</p>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="sticky bottom-0 mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:flex-row sm:justify-end sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelReplace}
              disabled={isUploading}
              className="h-11 rounded-xl border-slate-300/80 bg-white px-5 text-base font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmReplace}
              disabled={isUploading || (mustReplyToAdmin && !replyDraft.trim())}
              className="group relative h-11 rounded-xl bg-[#D4AF37] px-6 text-base font-semibold tracking-tight text-black shadow-sm transition-colors hover:bg-[#B59530] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#D4AF37]"
            >
              {isUploading 
                ? (pendingFileMeta?.isReplacing ? "Reemplazando..." : "Subiendo...") 
                : mustReplyToAdmin
                  ? "Enviar y subir"
                  : (pendingFileMeta?.isReplacing ? "Aceptar y reemplazar" : "Aceptar y cargar")}
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
                Está a punto de eliminar el documento <span className="font-medium text-slate-900 dark:text-slate-200">&quot;{documentToDelete?.name}&quot;</span>. Esta acción registrará el evento en la auditoría.
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
              variant="destructive"
              onClick={confirmDelete}
              className="rounded-full bg-red-600 px-5 hover:bg-red-700"
              disabled={isDeleting}
            >
              {isDeleting ? "Eliminando..." : "Confirmar eliminación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
