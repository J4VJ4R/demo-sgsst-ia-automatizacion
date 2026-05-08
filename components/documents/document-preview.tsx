 'use client'

import { useEffect, useMemo, useState } from "react";
import { X, ZoomIn, ZoomOut, CheckCircle, Undo2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteActivityDocument, markActivityRepliesAsRead, updateActivityStatus, returnActivityToConsultant } from "@/app/actions";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";

interface DocumentPreviewProps {
  document: {
    id: string;
    name: string;
    url: string;
    activity?: {
      id?: string;
      status?: string;
      title: string;
      project: {
        name: string;
      };
    };
  } | null;
  documents?: {
    id: string;
    name: string;
    url: string;
  }[];
  replies?: {
    id: string;
    adminMessage: string | null;
    message: string;
    createdAt: Date | string;
    isRead: boolean;
    document: { id: string; name: string; url: string };
    createdByUser: { name: string | null; role: string };
  }[];
  onClose: () => void;
  currentUserRole?: string;
}

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"];
const PDF_EXTENSIONS = ["pdf"];
const WORD_EXTENSIONS = ["doc", "docx"];

export function DocumentPreview({
  document,
  documents,
  replies,
  onClose,
  currentUserRole,
}: DocumentPreviewProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [approving, setApproving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnNote, setReturnNote] = useState("");
  const [returning, setReturning] = useState(false);
  const [activeDocId, setActiveDocId] = useState<string | null>(() => document?.id ?? null);
  const [removedDocIds, setRemovedDocIds] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const docOptions = useMemo(() => {
    if (!document) return [];
    const activity = document.activity;
    const map = new Map<string, { id: string; name: string; url: string; activity?: typeof activity }>();
    map.set(document.id, { id: document.id, name: document.name, url: document.url, activity });
    (documents || []).forEach((d) => {
      map.set(d.id, { id: d.id, name: d.name, url: d.url, activity });
    });
    return Array.from(map.values()).filter((d) => !removedDocIds.includes(d.id));
  }, [document, documents, removedDocIds]);

  const current =
    (activeDocId ? docOptions.find((d) => d.id === activeDocId) : null) ||
    docOptions[0] ||
    document;
  if (!current) {
    return null;
  }

  const extension = (() => {
    const parts = current.name.split(".");
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
  })();

  const isImage = IMAGE_EXTENSIONS.includes(extension);
  const isPdf = PDF_EXTENSIONS.includes(extension);
  const isWord = WORD_EXTENSIONS.includes(extension);
  const isSupported = isImage || isPdf || isWord;

  const previewUrl = (() => {
    if (typeof window === "undefined") {
      return current.url;
    }

    const absoluteUrl = current.url.startsWith("http")
      ? current.url
      : `${window.location.origin}${current.url}`;

    if (isPdf) {
      const separator = absoluteUrl.includes("#") ? "&" : "#";
      return `${absoluteUrl}${separator}zoom=page-fit&view=FitH`;
    }

    return absoluteUrl;
  })();

  const activity = current.activity;
  const canDeleteFiles =
    (currentUserRole === "CONSULTANT" || currentUserRole === "ADMIN_PMD") &&
    activity?.status === "REJECTED";
  const canQuickApprove =
    !!activity &&
    activity.status === "IN_REVIEW" &&
    !!activity.id &&
    currentUserRole === "ADMIN_PMD";

  const unreadRepliesCount = useMemo(() => {
    if (!replies || replies.length === 0) return 0;
    return replies.filter((r) => !r.isRead).length;
  }, [replies]);

  const latestReply = useMemo(() => {
    if (!replies || replies.length === 0) return null;
    const sorted = [...replies].sort((a, b) => {
      const ad = typeof a.createdAt === "string" ? new Date(a.createdAt) : a.createdAt;
      const bd = typeof b.createdAt === "string" ? new Date(b.createdAt) : b.createdAt;
      const at = Number.isNaN(ad.getTime()) ? 0 : ad.getTime();
      const bt = Number.isNaN(bd.getTime()) ? 0 : bd.getTime();
      return bt - at;
    });
    return sorted[0] || null;
  }, [replies]);

  useEffect(() => {
    if (currentUserRole !== "ADMIN_PMD") return;
    if (!activity?.id) return;
    if (!replies || replies.length === 0) return;
    if (unreadRepliesCount === 0) return;
    markActivityRepliesAsRead(activity.id).catch(() => {});
  }, [activity?.id, currentUserRole, replies, unreadRepliesCount]);

  const handleZoomIn = () => {
    setZoom((z) => Math.min(3, z + 0.25));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(0.5, z - 0.25));
  };

  const handleQuickApprove = async () => {
    if (!activity?.id) return;
    try {
      setApproving(true);
      const result = await updateActivityStatus(activity.id, "APPROVED");
      setApproving(false);

      if (result.success) {
        toast.success("Actividad aprobada exitosamente");
      } else {
        toast.error("Error al aprobar la actividad");
      }
    } catch {
      setApproving(false);
      toast.error("Error al aprobar la actividad");
    }
  };

  const handleReturnActivity = async () => {
    if (!activity?.id) return;
    const note = returnNote.trim();
    if (!note) {
      toast.error("Ingrese una nota para devolver la actividad.");
      return;
    }

    setReturning(true);
    const result = await returnActivityToConsultant(activity.id, note);
    setReturning(false);

    if (result.success) {
      toast.success("Actividad devuelta al consultor.");
      setReturnDialogOpen(false);
      setReturnNote("");
    } else {
      toast.error(result.error || "Error al devolver la actividad.");
    }
  };

  const renderViewer = () => {
    if (!isSupported) {
      return (
        <div className="flex h-full items-center justify-center p-8 text-center">
          <div className="space-y-2">
            <h4 className="text-lg font-semibold text-slate-900">Formato no soportado</h4>
            <p className="text-slate-600 max-w-md mx-auto">
              Solo se pueden visualizar en esta sección archivos PDF, documentos de Word
              e imágenes (JPG, PNG, GIF, WEBP). Utilice la opción de descarga para otros formatos.
            </p>
          </div>
        </div>
      );
    }

    if (!previewUrl) {
      return (
        <div className="flex h-full items-center justify-center p-8 text-center">
          <div className="space-y-2">
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D4AF37]" />
            </div>
            <p className="text-slate-500 text-sm">
              Preparando vista previa del documento...
            </p>
          </div>
        </div>
      );
    }

    if (isImage) {
      return (
        <div className="h-full w-full overflow-auto bg-slate-50">
          <div
            className="inline-block"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
          >
            <img
              src={previewUrl}
              alt={current.name}
              className="max-w-full h-auto"
              onLoad={() => setLoading(false)}
              onError={() => setError("No se pudo cargar la imagen")}
            />
          </div>
        </div>
      );
    }

    if (isPdf || isWord) {
      return (
        <div className="h-full w-full relative bg-slate-50">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D4AF37]" />
            </div>
          )}
          {error ? (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div className="space-y-2">
                <h4 className="text-lg font-semibold text-red-600">No se puede visualizar el documento</h4>
                <p className="text-slate-600 max-w-md mx-auto">
                  Verifique que el archivo exista y sea un formato compatible. También puede descargarlo para abrirlo en su equipo.
                </p>
              </div>
            </div>
          ) : (
            <iframe
              src={previewUrl}
              className="w-full h-full rounded-lg"
              title="Vista previa del documento"
              onLoad={() => setLoading(false)}
              onError={() => setError("Error al cargar el documento")}
            />
          )}
        </div>
      );
    }

    return null;
  };

  return (
    document && (
    <div className="fixed inset-y-0 right-0 z-[10000] w-full md:w-3/5 lg:w-1/2 bg-white shadow-2xl border-l border-slate-200 transform transition-transform duration-300 ease-in-out">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{current.name}</h3>
            <p className="text-sm text-slate-500">
              {document.activity?.project.name} - {document.activity?.title}
            </p>
            {docOptions.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {docOptions.map((d, idx) => {
                  const isActive = d.id === current.id;
                  return (
                    <div key={d.id} className="inline-flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setActiveDocId(d.id);
                          setError(null);
                          setZoom(1);
                          setLoading(true);
                        }}
                        className={
                          isActive
                            ? "h-8 rounded-full border-[#D4AF37]/60 bg-[#D4AF37]/10 text-slate-900 hover:bg-[#D4AF37]/15"
                            : "h-8 rounded-full border-zinc-200 bg-white text-slate-700 hover:bg-zinc-50 hover:text-[#D4AF37]"
                        }
                        title={d.name}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        <span className="text-xs font-semibold">{`Ver ${idx + 1}`}</span>
                        <span className="ml-2 max-w-[180px] truncate text-xs font-medium">{d.name}</span>
                      </Button>
                      {canDeleteFiles ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full border-red-200 bg-white text-red-700 hover:bg-red-50"
                          title="Eliminar archivo"
                          onClick={() => {
                            setDeleteTarget({ id: d.id, name: d.name });
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
            {docOptions.length <= 1 && canDeleteFiles ? (
              <div className="mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full border-red-200 bg-white px-4 text-red-700 hover:bg-red-50"
                  onClick={() => {
                    setDeleteTarget({ id: current.id, name: current.name });
                    setDeleteDialogOpen(true);
                  }}
                  title="Eliminar archivo"
                >
                  <X className="mr-2 h-4 w-4" />
                  <span className="text-xs font-semibold">Eliminar archivo</span>
                </Button>
              </div>
            ) : null}
            {latestReply && (
              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">Último comentario del consultor</div>
                  {unreadRepliesCount > 0 ? (
                    <span className="rounded-full bg-[#D4AF37]/15 px-2.5 py-1 text-[0.7rem] font-semibold text-slate-900">
                      Nuevo: {unreadRepliesCount}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2">
                  {(() => {
                    const created =
                      typeof latestReply.createdAt === "string"
                        ? new Date(latestReply.createdAt)
                        : latestReply.createdAt;
                    const when = Number.isNaN(created.getTime())
                      ? ""
                      : created.toLocaleString();
                    return (
                      <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/80">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                          <span>{when}</span>
                          <button
                            type="button"
                            className="text-xs font-semibold text-slate-700 hover:text-[#D4AF37]"
                            onClick={() => {
                              setActiveDocId(latestReply.document.id);
                              setError(null);
                              setZoom(1);
                              setLoading(true);
                            }}
                            title={latestReply.document.name}
                          >
                            Ver archivo
                          </button>
                        </div>
                        {latestReply.adminMessage ? (
                          <div className="mt-2 text-xs text-slate-600">
                            <span className="font-semibold">Admin:</span> {latestReply.adminMessage}
                          </div>
                        ) : null}
                        <div className="mt-1 text-sm text-slate-900">
                          <span className="font-semibold">Consultor:</span> {latestReply.message}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} title="Cerrar vista previa">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex items-center justify-between px-6 py-2 border-b border-slate-100 bg-slate-50">
          <p className="text-xs text-slate-500">
            {isPdf && "Usa la barra del visor para cambiar de página, hacer zoom y desplazarte por el PDF."}
            {isWord && "La visualización de Word depende de las capacidades del navegador. Si no se muestra correctamente, descarga el archivo."}
            {isImage && "Puedes hacer zoom con los controles y desplazarte por la imagen."}
            {!isSupported && "Formato no soportado para vista integrada. Descarga el archivo para abrirlo localmente."}
          </p>
          {isImage && (
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleZoomOut}
                title="Reducir zoom"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs text-slate-600 w-10 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleZoomIn}
                title="Aumentar zoom"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 bg-slate-50 p-6 overflow-hidden">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 h-full flex flex-col">
            <div className="flex-1 flex">
              {renderViewer()}
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-end gap-3">
          <Button asChild title="Descargar el archivo" variant="outline" className="rounded-full border-zinc-300 text-slate-700 hover:bg-zinc-50 cursor-pointer">
              <a href={current.url} target="_blank" rel="noopener noreferrer">
                Descargar Archivo
              </a>
          </Button>
          
          {canQuickApprove && (
            <>
              <Button
                type="button"
                onClick={() => setReturnDialogOpen(true)}
                disabled={approving || returning}
                className="rounded-full bg-[#fef9c3] text-[#854d0e] border border-[#fde047] hover:bg-[#fef08a] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                title="Devolver"
              >
                <Undo2 className="mr-1 h-4 w-4" />
                Devolver
              </Button>
              <Button
                type="button"
                onClick={handleQuickApprove}
                disabled={approving || returning}
                className="rounded-full bg-[#10b981] text-white hover:bg-[#059669] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                title="Aprobar actividad"
              >
                <CheckCircle className="mr-1 h-4 w-4" />
                {approving ? "Aprobando..." : "Aprobar"}
              </Button>
            </>
          )}
        </div>
      </div>

      <Dialog open={returnDialogOpen} onOpenChange={setReturnDialogOpen}>
        <DialogContent className="sm:max-w-[480px] border-[#D4AF37]/30 z-[10010]">
          <DialogHeader>
            <DialogTitle className="text-[#D4AF37]">
              Devolver al consultor
            </DialogTitle>
            <DialogDescription>
              Escriba una nota con la novedad para que el consultor realice los ajustes necesarios.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">
                Nota para el consultor
              </span>
              <Textarea
                value={returnNote}
                onChange={(e) => setReturnNote(e.target.value)}
                rows={4}
                maxLength={1000}
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReturnDialogOpen(false)}
              className="border-zinc-700 text-slate-900 bg-white hover:bg-zinc-100"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleReturnActivity}
              disabled={returning}
              className="bg-[#D4AF37] text-black hover:bg-[#B59530]"
            >
              {returning ? "Devolviendo..." : "Devolver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open && deleting) return;
          setDeleteDialogOpen(open);
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-[460px] rounded-3xl border border-white/70 bg-gradient-to-br from-white/95 via-white/90 to-slate-50/95 px-6 pb-5 pt-6 shadow-[0_22px_80px_rgba(15,23,42,0.48)] backdrop-blur-2xl transition-all duration-200 ease-out">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-slate-900">¿Eliminar archivo?</DialogTitle>
            <DialogDescription className="text-slate-600">
              {deleteTarget
                ? `Archivo a eliminar: ${deleteTarget.name}. Esta acción no se puede deshacer.`
                : "Este archivo será removido de la actividad. Esta acción no se puede deshacer."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl px-5 text-base font-semibold"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="h-11 rounded-xl bg-red-600 px-5 text-base font-semibold text-white hover:bg-red-700"
              disabled={deleting || !deleteTarget}
              onClick={async () => {
                if (!deleteTarget) return;
                setDeleting(true);
                try {
                  const fd = new FormData();
                  fd.set("documentId", deleteTarget.id);
                  const res = await deleteActivityDocument(fd);
                  if (!res.success) {
                    toast.error(res.error || "No se pudo eliminar el archivo.");
                    setDeleting(false);
                    return;
                  }
                  setRemovedDocIds((prev) => [...prev, deleteTarget.id]);
                  if (activeDocId === deleteTarget.id) {
                    const remainingIds = docOptions.filter((d) => d.id !== deleteTarget.id).map((d) => d.id);
                    setActiveDocId(remainingIds[0] || null);
                  }
                  toast.success("Archivo eliminado");
                  setDeleteDialogOpen(false);
                  router.refresh();
                } catch (e) {
                  toast.error("Error al eliminar el archivo.");
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    )
  );
}
