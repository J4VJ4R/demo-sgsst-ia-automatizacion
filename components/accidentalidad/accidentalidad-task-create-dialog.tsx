"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import { createAccidentalidadTaskForAccident } from "@/app/actions/accidentalidad-actions";

export type AccidentalidadRowDto = {
  id: string;
  actividad: string;
  status: string;
  priority: string;
  dueDate: string;
  createdAt: string;
  assignedTo: string | null;
  archivos: Array<{
    id: string;
    name: string;
    url: string;
    uploadedAt: string;
    version: number;
    sizeBytes: number | null;
  }>;
};

export function AccidentalidadTaskCreateDialog(props: {
  projectId: string;
  accidentId: string;
  accidentName: string;
  canCreate: boolean;
  onCreated: (row: AccidentalidadRowDto) => void;
}) {
  const [open, setOpen] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const validationError = useMemo(() => {
    const t = taskName.trim();
    if (!t) return "El nombre de la actividad es requerido.";
    if (t.length > 120) return "El nombre de la actividad debe tener máximo 120 caracteres.";
    return "";
  }, [taskName]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setTaskName("");
      setSaving(false);
      setError("");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("projectId", props.projectId);
      fd.append("accidentId", props.accidentId);
      fd.append("taskName", taskName.trim());
      const res = await createAccidentalidadTaskForAccident(fd);
      if (!res?.success) {
        setError(res?.error || "No se pudo crear la actividad.");
        return;
      }
      props.onCreated(res.row as AccidentalidadRowDto);
      toast.success("Actividad agregada.");
      setOpen(false);
    } catch (err) {
      console.error(err);
      setError("Error al crear la actividad.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          className="bg-[#D4AF37] text-black hover:bg-[#B59530] gap-2"
          disabled={!props.canCreate}
        >
          <Plus className="h-4 w-4" />
          Agregar actividad
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px] border-[#D4AF37]/30 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#D4AF37]">Agregar actividad</DialogTitle>
          <DialogDescription>
            Se agregará una nueva actividad para {props.accidentName}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="acc-taskName" className="text-sm font-medium text-slate-700">
              Nombre de la actividad *
            </Label>
            <Input
              id="acc-taskName"
              placeholder="Ej: Evidencia adicional"
              value={taskName}
              maxLength={120}
              onChange={(e) => setTaskName(e.target.value)}
              autoFocus
              required
              disabled={saving}
            />
            <div className="text-xs text-muted-foreground">{taskName.trim().length}/120</div>
          </div>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || !!validationError}
              className="bg-[#D4AF37] text-black hover:bg-[#B59530]"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Agregar"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

