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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createProjectActivity } from "@/app/actions";
import { calculatePriority } from "@/lib/priority-logic";
import { PERIODICITY_OPTIONS } from "@/lib/periodicity";

interface ProjectActivityCreateDialogProps {
  projectId: string;
  consultantUsers?: { id: string; name: string; roleLabel?: string }[];
  userRole?: string;
  currentUserId?: string;
}

export function ProjectActivityCreateDialog({
  projectId,
  consultantUsers = [],
  userRole,
  currentUserId,
}: ProjectActivityCreateDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("Media");
  const [periodicity, setPeriodicity] = useState<string>("Mensual");
  const [isPending, startTransition] = useTransition();
  const [dueDate, setDueDate] = useState<string>("");
  const [error, setError] = useState<string>("");

  const router = useRouter();
  
  const isConsultant = userRole === "CONSULTANT";
  const isAdmin = userRole === "ADMIN_PMD";
  const [assignedTo, setAssignedTo] = useState<string>("unassigned");

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
  };

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
            setPriority(result.priority);
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
    if (!periodicity) {
      toast.error("La periodicidad es obligatoria.");
      return;
    }
    const trimmedDue = dueDate.trim();
    if (trimmedDue) {
      const [y, m, d] = trimmedDue.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      
      const result = calculatePriority(dateObj);
      if (!result.isValid) {
        setError(result.error || "Fecha de vencimiento inválida.");
        toast.error(result.error || "Fecha de vencimiento inválida.");
        return;
      }
    }
    setError("");

    startTransition(async () => {
      const formData = new FormData();
      formData.append("projectId", projectId);
      formData.append("title", trimmedTitle);
      formData.append("periodicity", periodicity);
      // Priority is now automatically calculated or default, handled by backend or default logic
      formData.append("priority", priority); 
      if (trimmedDue) {
          formData.append("dueDate", trimmedDue);
      }
      if ((isAdmin || isConsultant) && assignedTo !== "unassigned") {
        formData.append("assignedToId", assignedTo);
      } else if (isConsultant && currentUserId) {
        formData.append("assignedToId", currentUserId);
      }

      const result = await createProjectActivity(formData);

      if (result?.success) {
        toast.success("Actividad creada correctamente.");
        setTitle("");
        setDueDate("");
        setPriority("Media");
        setAssignedTo("unassigned");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result?.error || "No se pudo crear la actividad.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          className="w-full bg-[#D4AF37] text-black hover:bg-[#B59530] gap-2 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Agregar Actividad
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] border-[#D4AF37]/30 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#D4AF37]">
            Nueva actividad del proyecto
          </DialogTitle>
          <DialogDescription>
            Crea una nueva actividad para este proyecto.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Nombre de la actividad *
            </label>
            <Input
              placeholder="Nombre de la actividad"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Fecha de vencimiento
            </label>
            <Input
              type="date"
              placeholder="dd/mm/aaaa"
              value={dueDate}
              onChange={handleDateChange}
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900 shadow-sm focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
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

          {((isAdmin || isConsultant) && consultantUsers.length > 0) ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Asignar a</label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900 shadow-sm focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Sin asignar</SelectItem>
                  {consultantUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.roleLabel ? `${u.name} (${u.roleLabel})` : u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-[#D4AF37] text-black hover:bg-[#B59530]"
              disabled={isPending || !!error}
            >
              {isPending ? "Guardando..." : "Guardar actividad"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
