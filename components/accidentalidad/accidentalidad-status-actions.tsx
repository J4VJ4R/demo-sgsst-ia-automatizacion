"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle, Undo2, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateAccidentalidadStatus } from "@/app/actions/accidentalidad-actions";
import { AccidentalidadRequirementActions } from "@/components/accidentalidad/accidentalidad-requirement-actions";
import { AccidentalidadRejectionReasonDialog } from "@/components/accidentalidad/rejection-reason-dialog";

type SimpleDoc = {
  id: string;
  name: string;
  url: string;
  uploadedAt: Date | string;
};

export function AccidentalidadStatusActions(props: {
  accidentalidadId: string;
  status: string;
  userRole: string;
  title: string;
  projectName: string;
  dueDate?: Date | string | null;
  documents?: SimpleDoc[];
  onPreview?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [note, setNote] = useState("");
  const devolverClass =
    "h-8 rounded-full border-[#DAA520] bg-white text-[#8B4512] hover:bg-[#DAA520]/10 active:bg-[#DAA520]/20 disabled:opacity-50 disabled:bg-white disabled:text-[#8B4512] disabled:border-[#DAA520]";

  const latestDoc = useMemo(() => {
    const d = props.documents && props.documents.length > 0 ? props.documents[0] : null;
    if (!d) return null;
    return { id: d.id, name: d.name, url: d.url };
  }, [props.documents]);

  const dueDateStr = useMemo(() => {
    if (!props.dueDate) return "";
    if (typeof props.dueDate === "string") return props.dueDate.slice(0, 10);
    return props.dueDate.toISOString().slice(0, 10);
  }, [props.dueDate]);

  const runChange = async (status: string, note?: string) => {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("accidentalidadId", props.accidentalidadId);
      fd.append("status", status);
      if (note) fd.append("note", note);
      const res = await updateAccidentalidadStatus(fd);
      if (!res.success) {
        toast.error(res.error || "No se pudo actualizar el estado.");
        return;
      }
      toast.success("Estado actualizado.");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {props.onPreview && latestDoc && (props.status === "IN_REVIEW" || props.status === "PENDING" || props.status === "REJECTED") && (
        <Button
          variant="outline"
          size="sm"
          onClick={props.onPreview}
          title="Ver documento"
          className="h-8 rounded-full border-zinc-200 bg-white text-slate-700 hover:bg-zinc-50 hover:text-[#D4AF37]"
        >
          <Eye className="mr-1 h-4 w-4" />
          <span className="text-xs font-medium">Ver</span>
        </Button>
      )}

      {(props.status === "PENDING" || props.status === "REJECTED") && props.userRole === "CONSULTANT" && (
        <AccidentalidadRequirementActions
          accidentalidadId={props.accidentalidadId}
          actividadTitle={props.title}
          projectName={props.projectName}
          dueDate={dueDateStr}
          status={props.status}
          latestDoc={latestDoc}
          documents={[]}
          canManage={true}
          canDelete={false}
          onStatusChange={() => router.refresh()}
        />
      )}

      {props.status === "REJECTED" && props.userRole === "CONSULTANT" && (
        <>
          <span className="text-red-600 font-medium flex items-center">
            <Undo2 className="w-4 h-4 mr-1" /> Rechazada
          </span>
          <AccidentalidadRejectionReasonDialog accidentalidadId={props.accidentalidadId} />
        </>
      )}

      {props.status === "IN_REVIEW" && (props.userRole === "ADMIN_PMD" || props.userRole === "GESTOR") && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => runChange("APPROVED")}
            disabled={loading}
            className="text-green-600 border-green-200 hover:bg-green-50"
          >
            <CheckCircle className="mr-1 h-3 w-3" /> Aprobar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setNote("");
              setReturnOpen(true);
            }}
            disabled={loading}
            className={devolverClass}
          >
            <Undo2 className="mr-1 h-3 w-3" /> Devolver
          </Button>
        </>
      )}

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="sm:max-w-[520px] border-[#D4AF37]/30">
          <DialogHeader>
            <DialogTitle className="text-[#D4AF37]">Devolver</DialogTitle>
            <DialogDescription>La actividad quedará en estado Rechazada.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Motivo de devolución (obligatorio)"
              className="min-h-[120px]"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setReturnOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!note.trim()) {
                  toast.error("El motivo de devolución es obligatorio.");
                  return;
                }
                await runChange("REJECTED", note.trim());
                setReturnOpen(false);
              }}
              disabled={loading}
              className="bg-[#D4AF37] text-black hover:bg-[#B59530]"
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
