"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"];
const PDF_EXTENSIONS = ["pdf"];
const WORD_EXTENSIONS = ["doc", "docx"];

export type CustomSectionPreviewDocument = {
  id: string;
  name: string;
  url: string;
};

function getExtension(name: string) {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

export function CustomSectionDocumentsPreview(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: CustomSectionPreviewDocument[];
  initialIndex?: number;
}) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!props.open) return;
    const safeIndex =
      typeof props.initialIndex === "number" && props.initialIndex >= 0 && props.initialIndex < props.documents.length
        ? props.initialIndex
        : props.documents.length > 0
          ? props.documents.length - 1
          : 0;
    setIndex(safeIndex);
    setZoom(1);
    setLoading(true);
    setError(null);
  }, [props.open, props.initialIndex, props.documents.length]);

  const current = props.documents[index] || null;
  const extension = current ? getExtension(current.name) : "";
  const isImage = IMAGE_EXTENSIONS.includes(extension);
  const isPdf = PDF_EXTENSIONS.includes(extension);
  const isWord = WORD_EXTENSIONS.includes(extension);

  const previewUrl = useMemo(() => {
    if (!current) return "";
    if (typeof window === "undefined") return current.url;
    const absoluteUrl = current.url.startsWith("http") ? current.url : `${window.location.origin}${current.url}`;
    if (isPdf) {
      const separator = absoluteUrl.includes("#") ? "&" : "#";
      return `${absoluteUrl}${separator}zoom=page-fit&view=FitH`;
    }
    return absoluteUrl;
  }, [current, isPdf]);

  const hasPrev = index > 0;
  const hasNext = index < props.documents.length - 1;

  const handlePrev = () => {
    if (!hasPrev) return;
    setIndex((i) => Math.max(0, i - 1));
    setZoom(1);
    setLoading(true);
    setError(null);
  };

  const handleNext = () => {
    if (!hasNext) return;
    setIndex((i) => Math.min(props.documents.length - 1, i + 1));
    setZoom(1);
    setLoading(true);
    setError(null);
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-[980px] w-[calc(100vw-24px)] sm:w-full h-[90vh] p-0">
        <div className="flex h-full flex-col">
          <DialogHeader className="px-4 py-3 border-b border-slate-100">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <DialogTitle className="truncate text-base">{current?.name || "Documento"}</DialogTitle>
                {props.documents.length > 1 ? (
                  <div className="mt-1 text-xs text-slate-500">{`Archivo ${index + 1} de ${props.documents.length}`}</div>
                ) : null}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => props.onOpenChange(false)}>
                Cerrar
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={!hasPrev} onClick={handlePrev}>
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={!hasNext} onClick={handleNext}>
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {isImage ? (
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <div className="min-w-[70px] text-center text-xs font-semibold text-slate-700">{`${Math.round(zoom * 100)}%`}</div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </div>
          </DialogHeader>

          <div className="relative flex-1 bg-slate-50">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D4AF37]" />
              </div>
            ) : null}
            {error ? (
              <div className="flex h-full items-center justify-center p-8 text-center">
                <div className="space-y-2">
                  <h4 className="text-lg font-semibold text-red-600">No se puede visualizar el documento</h4>
                  <p className="text-slate-600 max-w-md mx-auto">{error}</p>
                </div>
              </div>
            ) : current ? (
              isImage ? (
                <div className="h-full w-full overflow-auto p-3">
                  <div className="w-full">
                    <img
                      src={previewUrl}
                      alt={current.name}
                      className="block mx-auto h-auto rounded-lg shadow-sm"
                      style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
                      onLoad={() => setLoading(false)}
                      onError={() => {
                        setLoading(false);
                        setError("Error al cargar la imagen.");
                      }}
                    />
                  </div>
                </div>
              ) : isPdf || isWord ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full"
                  title="Vista previa del documento"
                  onLoad={() => setLoading(false)}
                  onError={() => {
                    setLoading(false);
                    setError("Error al cargar el documento.");
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center p-8 text-center">
                  <div className="space-y-2">
                    <h4 className="text-lg font-semibold text-red-600">Formato no soportado</h4>
                    <p className="text-slate-600 max-w-md mx-auto">Descarga el archivo para abrirlo en tu equipo.</p>
                  </div>
                </div>
              )
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-center text-slate-600">Sin documento</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
