'use client'

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MessageSquareX, AlertCircle } from "lucide-react";

type HistoryItem = {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string | Date;
};

export function AccidentalidadRejectionReasonDialog(props: { accidentalidadId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [changedAt, setChangedAt] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/accidentalidad/${props.accidentalidadId}/history`, { cache: "no-store" });
      const json = (await res.json()) as { history?: HistoryItem[] };
      const history = json.history || [];
      const latestNote = history.find((h) => h.field === "status_note" && h.newValue);
      setReason(latestNote?.newValue ?? null);
      setChangedAt(latestNote ? new Date(latestNote.changedAt).toLocaleString("es-CO") : null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) void load();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 gap-1"
          title="Ver motivo"
        >
          <MessageSquareX className="h-4 w-4" />
          <span className="text-xs font-medium hidden sm:inline">Motivo</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[425px] border-red-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            Motivo de rechazo
          </DialogTitle>
          <DialogDescription>
            {changedAt ? `Registrado: ${changedAt}` : "Detalles proporcionados por el administrador."}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 p-4 bg-red-50 rounded-md border border-red-100 text-sm text-red-800 whitespace-pre-wrap">
          {loading ? "Cargando..." : reason || "No hay motivo registrado."}
        </div>
      </DialogContent>
    </Dialog>
  );
}

