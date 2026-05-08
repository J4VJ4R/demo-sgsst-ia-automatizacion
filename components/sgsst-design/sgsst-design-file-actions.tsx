"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar, Eye, History, Loader2, Trash2, Upload } from "lucide-react";
import {
  createSgSstDesignUploadRequest,
  finalizeSgSstDesignUpload,
  getSgSstDesignHistory,
  softDeleteSgSstDesignFile,
  updateSgSstDesignDueDate,
} from "@/app/sgsst-actions";
import { DocumentPreview } from "@/components/documents/document-preview";
import { calculateSgSstDueStatus, validateSgSstDueDate } from "@/lib/sgsst-due-logic";

type Doc = { id: string; name: string; url: string };
type HistoryItem = Doc & { uploadedAt: string; version: number; uploadedByUser?: { name: string; role: string } | null };
type PendingFileMeta = {
  files: { name: string; sizeMB: number; isLarge: boolean }[];
  previousName?: string;
  isReplacing: boolean;
};

export function SgSstDesignFileActions(props: {
  sectionId: string;
  sectionName: string;
  latestFile: Doc | null;
  canManage: boolean;
  currentDueDate?: string;
  currentUserRole?: string;
  onChanged: () => Promise<void> | void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingFileMeta, setPendingFileMeta] = useState<PendingFileMeta | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const density = "compact";
  const buttonHeight = density === "compact" ? "h-7" : "h-8";
  const buttonText = density === "compact" ? "text-xs" : "text-sm";
  const iconSize = density === "compact" ? "h-3.5 w-3.5" : "h-4 w-4";
  const gap = density === "compact" ? "gap-1.5" : "gap-2";

  const hasHistory = useMemo(() => history.length > 1, [history.length]);

  const openFileDialog = () => fileInputRef.current?.click();

  const clearFileSelection = () => {
    setPendingFiles([]);
    setPendingFileMeta(null);
    setDateError(null);
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const encryption = "AES256";
      let okCount = 0;
      for (const file of files) {
        const prep = await createSgSstDesignUploadRequest({
          sectionId: props.sectionId,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        });
        if (!prep.success) {
          toast.error(prep.error || "No se pudo preparar la carga");
          continue;
        }

        const putRes = await fetch(prep.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type, "x-amz-server-side-encryption": encryption },
          body: file,
        });
        if (!putRes.ok) {
          toast.error(`Error al subir "${file.name}"`);
          continue;
        }

        const finalize = await finalizeSgSstDesignUpload({
          sectionId: props.sectionId,
          key: prep.key,
          name: file.name,
          url: prep.publicUrl,
          sizeBytes: file.size,
        });
        if (!finalize.success) {
          toast.error(finalize.error || `No se pudo finalizar "${file.name}"`);
          continue;
        }

        okCount++;
      }

      if (okCount > 0) {
        toast.success(okCount === 1 ? "Archivo cargado" : "Archivos cargados");
      }
      await props.onChanged();
      setReplaceDialogOpen(false);
      clearFileSelection();
    } catch {
      toast.error("Error al subir el archivo");
    } finally {
      setUploading(false);
    }
  };

  const openHistory = async () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await getSgSstDesignHistory(props.sectionId);
      if (!res.success) {
        toast.error(res.error || "No se pudo cargar historial");
        setHistory([]);
        return;
      }
      setHistory(res.files as unknown as HistoryItem[]);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <>
      <div className={`flex flex-wrap items-center ${gap}`}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            e.currentTarget.value = "";
            if (files.length === 0) return;
            setPendingFiles(files);
            setPendingFileMeta({
              files: files.map((f) => {
                const sizeMB = f.size / (1024 * 1024);
                return { name: f.name, sizeMB, isLarge: sizeMB > 10 };
              }),
              previousName: props.latestFile?.name,
              isReplacing: !!props.latestFile,
            });
            setDueDate(props.currentDueDate || "");
            setDateError(null);
            setReplaceDialogOpen(true);
          }}
        />

        {props.canManage ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`${buttonHeight} ${buttonText} rounded-full border-zinc-300 text-slate-800 hover:bg-zinc-100`}
            onClick={openFileDialog}
            disabled={uploading}
          >
            {uploading ? <Loader2 className={`${iconSize} mr-1 animate-spin`} /> : <Upload className={`${iconSize} mr-1`} />}
            {props.latestFile ? "Agregar archivo" : "Carga de archivo"}
          </Button>
        ) : null}

        {props.latestFile ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`${buttonHeight} ${buttonText} rounded-full border-zinc-300 text-slate-800 hover:bg-zinc-100`}
              onClick={() => setPreviewDoc(props.latestFile)}
            >
              <Eye className={`${iconSize} mr-1`} />
              Ver
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`${buttonHeight} ${buttonText} rounded-full border-zinc-300 text-slate-800 hover:bg-zinc-100`}
              onClick={() => void openHistory()}
            >
              <History className={`${iconSize} mr-1`} />
              Historial
              {hasHistory ? <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" /> : null}
            </Button>

            {props.canManage ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={`${buttonHeight} ${buttonText} rounded-full border-red-200 text-red-700 hover:bg-red-50`}
                onClick={async () => {
                  const res = await softDeleteSgSstDesignFile(props.latestFile!.id);
                  if (!res.success) {
                    toast.error(res.error || "No se pudo eliminar");
                    return;
                  }
                  toast.success("Archivo eliminado");
                  await props.onChanged();
                }}
              >
                <Trash2 className={`${iconSize} mr-1`} />
                Quitar
              </Button>
            ) : null}
          </>
        ) : (
          <span className="text-xs text-muted-foreground">Sin archivo</span>
        )}
      </div>

      {previewDoc ? (
        <DocumentPreview
          key={previewDoc.id}
          document={previewDoc}
          onClose={() => setPreviewDoc(null)}
          currentUserRole={props.currentUserRole}
        />
      ) : null}

      <Dialog
        open={replaceDialogOpen}
        onOpenChange={(open) => {
          if (!open && uploading) return;
          setReplaceDialogOpen(open);
          if (!open) clearFileSelection();
        }}
      >
        <DialogContent className="sm:max-w-[440px] rounded-3xl border border-white/70 bg-gradient-to-br from-white/95 via-white/90 to-slate-50/95 px-6 pb-5 pt-6 shadow-[0_22px_80px_rgba(15,23,42,0.48)] backdrop-blur-2xl transition-all duration-200 ease-out dark:from-slate-900/95 dark:via-slate-900/90 dark:to-slate-950/95">
          <DialogHeader className="space-y-3">
            <div className="inline-flex items-center gap-3 rounded-full bg-white/70 px-3 py-1.5 shadow-[0_14px_40px_rgba(15,23,42,0.18)] ring-1 ring-slate-100/80 dark:bg-slate-900/70 dark:ring-slate-800/80">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#D4AF37] via-[#D4AF37] to-purple-500/80 shadow-[0_8px_22px_rgba(24,18,56,0.6)]">
                <Upload className="h-5 w-5 text-black" />
              </div>
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Actualizar documento
              </span>
            </div>
            <DialogTitle className="text-[clamp(1.05rem,1.1vw+0.9rem,1.25rem)] font-semibold tracking-tight text-slate-900">
              {pendingFileMeta?.isReplacing ? "Reemplazar archivo existente" : "Subir nuevo archivo"}
            </DialogTitle>
            <DialogDescription className="text-[0.9rem] leading-relaxed text-slate-600">
              {pendingFileMeta?.isReplacing
                ? "El nuevo archivo se convertirá en la versión vigente. Conservaremos las versiones anteriores para consultarlas desde el historial."
                : "El archivo se asociará a esta subsección y quedará disponible para consulta."}
            </DialogDescription>
          </DialogHeader>

          {pendingFileMeta ? (
            <div className="mt-4 space-y-3 text-xs sm:text-sm">
              <div className="grid grid-cols-1 gap-3 rounded-2xl bg-white/80 p-3 shadow-[0_16px_48px_rgba(15,23,42,0.2)] ring-1 ring-slate-100/90 dark:bg-slate-900/80 dark:ring-slate-800/90">
                {pendingFileMeta.previousName ? (
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
                      v{hasHistory ? history[0]?.version ?? 1 : 1}
                    </span>
                  </div>
                ) : null}

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
                      {pendingFileMeta.files.some((f) => f.isLarge) ? (
                        <span className="text-[0.68rem] font-medium text-yellow-700">
                          Tamaño superior a 10MB, puede tardar unos segundos más.
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-white/80 p-3 shadow-[0_16px_48px_rgba(15,23,42,0.2)] ring-1 ring-slate-100/90 dark:bg-slate-900/80 dark:ring-slate-800/90 space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor={`dueDate-${props.sectionId}`} className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Fecha de vencimiento
                    </Label>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          id={`dueDate-${props.sectionId}`}
                          type="date"
                          className="pl-9 h-9 text-sm"
                          value={dueDate}
                          onChange={(e) => {
                            setDueDate(e.target.value);
                            setDateError(null);
                          }}
                          min={new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split("T")[0]}
                        />
                      </div>
                      {dueDate ? (
                        (() => {
                          const status = calculateSgSstDueStatus(dueDate);
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
                        })()
                      ) : null}
                    </div>
                    {dateError ? <p className="text-xs font-medium text-red-500">{dateError}</p> : null}
                  </div>
                </div>
              </div>

              <p className="text-[0.78rem] leading-relaxed text-slate-500">
                Podrás revisar o descargar versiones anteriores desde el botón{" "}
                <span className="font-semibold text-slate-700">Historial</span>.
              </p>
            </div>
          ) : null}

          <DialogFooter className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setReplaceDialogOpen(false)}
              disabled={uploading}
              className="h-10 rounded-full border-slate-300/80 bg-white/85 px-5 text-sm font-medium text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.2)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-slate-100 hover:shadow-[0_16px_40px_rgba(15,23,42,0.28)]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={uploading || pendingFiles.length === 0}
              className="group relative h-10 rounded-full bg-gradient-to-r from-[#D4AF37] via-[#D4AF37] to-[#f6e6a9] px-6 text-sm font-semibold tracking-tight text-black shadow-[0_18px_50px_rgba(24,18,56,0.6)] transition-all duration-200 hover:-translate-y-[1.5px] hover:shadow-[0_24px_70px_rgba(24,18,56,0.7)]"
              onClick={async () => {
                if (pendingFiles.length === 0) return;
                const trimmed = dueDate.trim();
                if (!trimmed) {
                  setDateError("Fecha de vencimiento requerida.");
                  return;
                }
                const validation = validateSgSstDueDate(trimmed);
                if (!validation.ok) {
                  setDateError(validation.error);
                  return;
                }
                const update = await updateSgSstDesignDueDate(props.sectionId, trimmed);
                if (!update.success) {
                  setDateError(update.error || "No se pudo actualizar la fecha.");
                  return;
                }
                await uploadFiles(pendingFiles);
              }}
            >
              <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-black/5 text-[0.8rem] font-semibold shadow-[0_4px_10px_rgba(15,23,42,0.3)] transition-transform duration-200 group-hover:translate-y-[-1px]">
                {uploading ? "…" : "↻"}
              </span>
              {uploading
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

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Historial - {props.sectionName}</DialogTitle>
          </DialogHeader>

          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-[640px] w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-semibold leading-tight text-slate-600">
                  <th className="px-3 py-1.5">Versión</th>
                  <th className="px-3 py-1.5">Archivo</th>
                  <th className="px-3 py-1.5">Fecha</th>
                  <th className="px-3 py-1.5">Subido por</th>
                  <th className="px-3 py-1.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {historyLoading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                      Cargando...
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                      No hay historial disponible.
                    </td>
                  </tr>
                ) : (
                  history.map((h) => (
                    <tr key={h.id} className="border-t">
                      <td className="px-3 py-1.5 text-xs text-slate-700">v{h.version}</td>
                      <td className="px-3 py-1.5 text-xs text-slate-700 break-all">{h.name}</td>
                      <td className="px-3 py-1.5 text-xs text-slate-700">
                        {new Date(h.uploadedAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-1.5 text-xs text-slate-700">
                        {h.uploadedByUser?.name ? `${h.uploadedByUser.name}` : "-"}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={`${buttonHeight} ${buttonText} rounded-full border-zinc-300 text-slate-800 hover:bg-zinc-100`}
                          onClick={() => setPreviewDoc({ id: h.id, name: h.name, url: h.url })}
                        >
                          <Eye className={`${iconSize} mr-1`} />
                          Ver
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setHistoryOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
