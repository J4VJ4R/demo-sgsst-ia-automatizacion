"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createCollaboratorActivity } from "@/app/actions";
import { calculatePriority } from "@/lib/priority-logic";
import { PERIODICITY_OPTIONS } from "@/lib/periodicity";

interface CollaboratorActivityCreateDialogProps {
  collaboratorId: string;
  projectId: string;
  userRole?: string;
  currentUserId?: string;
  consultantUsers?: { id: string; name: string }[];
}

export function CollaboratorActivityCreateDialog({
  collaboratorId,
  projectId,
  userRole,
  currentUserId,
  consultantUsers = [],
}: CollaboratorActivityCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [isPending, startTransition] = useTransition();
  const [dueDate, setDueDate] = useState<string>("");
  const [periodicity, setPeriodicity] = useState<string>("Mensual");
  const [error, setError] = useState<string>("");
  const router = useRouter();

  const isConsultant = userRole === "CONSULTANT";

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDueDate(val);
    
    if (val) {
        const [y, m, d] = val.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        
        const result = calculatePriority(dateObj);
        
        if (!result.isValid) {
            setError(result.error || "Fecha inválida");
        } else {
            setError("");
        }
    } else {
        setError("");
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("El nombre de la actividad es obligatorio.");
      return;
    }
    const trimmedDue = dueDate.trim();
    if (!trimmedDue) {
      setError("La fecha de vencimiento es obligatoria.");
      toast.error("La fecha de vencimiento es obligatoria.");
      return;
    }
    if (!periodicity) {
      toast.error("La periodicidad es obligatoria.");
      return;
    }
    if (trimmedDue) {
      const [y, m, d] = trimmedDue.split('-').map(Number);
      const parsed = new Date(y, m - 1, d);
      
      const result = calculatePriority(parsed);
      if (!result.isValid) {
        setError(result.error || "Fecha de vencimiento inválida.");
        toast.error(result.error || "Fecha de vencimiento inválida.");
        return;
      }
    }

    setError("");

    startTransition(async () => {
      const formData = new FormData();
      formData.append("collaboratorId", collaboratorId);
      formData.append("projectId", projectId);
      formData.append("title", trimmedTitle);
      formData.append("dueDate", trimmedDue);
      formData.append("periodicity", periodicity);

      const result = await createCollaboratorActivity(formData);

      if (result?.success) {
        toast.success("Actividad creada correctamente.");
        setTitle("");
        setDueDate("");
        setPeriodicity("Mensual");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result?.error || "No se pudo crear la actividad.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          className="w-full bg-[#D4AF37] text-black hover:bg-[#B59530] gap-2 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Agregar Actividad
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] border-[#D4AF37]/30">
        <DialogHeader>
          <DialogTitle className="text-[#D4AF37]">
            Nueva actividad del colaborador
          </DialogTitle>
          <DialogDescription>
            Crea actividades adicionales personalizadas para este colaborador.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder="Nombre de la actividad"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
          />
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              Fecha de vencimiento *
            </label>
            <Input
              type="date"
              placeholder="dd/mm/aaaa"
              value={dueDate}
              onChange={handleDateChange}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900 shadow-sm focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              required
            />
            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Periodicidad *</label>
            <Select value={periodicity} onValueChange={setPeriodicity}>
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
          
          {isConsultant && (
             <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600 border border-slate-100">
                <p>
                    <span className="font-semibold text-slate-800">Asignado a:</span>{" "}
                    {consultantUsers.find(u => u.id === currentUserId)?.name || "Mí (Consultor actual)"}
                </p>
             </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-zinc-700 bg-white text-slate-900 hover:bg-zinc-100"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-[#D4AF37] text-black hover:bg-[#B59530]"
            >
              {isPending ? "Guardando..." : "Guardar actividad"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
