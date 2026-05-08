"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoreVertical, Eye, Pencil, Trash2, CheckCircle } from "lucide-react";
import { updateProjectActivity, deleteProjectActivity, updateActivityStatus } from "@/app/actions";
import { toast } from "sonner";
import { calculatePriority } from "@/lib/priority-logic";
import { PERIODICITY_OPTIONS } from "@/lib/periodicity";

interface ProjectActivityActionsProps {
  activityId: string;
  title: string;
  status: string;
  priority: string;
  periodicity?: string | null;
  dueDate?: string | null;
  assignedToId?: string | null;
  documentsCount: number;
  canDelete?: boolean;
  consultantUsers?: { id: string; name: string; roleLabel?: string }[];
  isAdmin?: boolean;
  userRole?: string;
}

export function ProjectActivityActions({
  activityId,
  title,
  status,
  priority,
  periodicity = null,
  dueDate: initialDueDate = null,
  assignedToId: initialAssignedToId = null,
  documentsCount,
  canDelete = true,
  consultantUsers = [],
  isAdmin = false,
  userRole,
}: ProjectActivityActionsProps) {
  const canEdit = isAdmin || userRole === "CONSULTANT";
  const canAssign = isAdmin || userRole === "CONSULTANT";
  const [openView, setOpenView] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(title);
  const [editingPriority, setEditingPriority] = useState(priority);
  const [editingPeriodicity, setEditingPeriodicity] = useState<string>(periodicity || "none");
  const [editingAssignedTo, setEditingAssignedTo] = useState<string>(
    initialAssignedToId || "unassigned"
  );
  const [saving, setSaving] = useState(false);
  const [dueDate, setDueDate] = useState<string>(initialDueDate || "");
  const [dueError, setDueError] = useState<string>("");
  const [deleting, setDeleting] = useState(false);

  const statusLabel =
    status === "APPROVED"
      ? "Aprobada"
      : status === "IN_REVIEW"
      ? "En revisión"
      : status === "REJECTED"
      ? "Rechazada"
      : status === "PENDING"
      ? "Pendiente"
      : status;

  const handleView = () => {
    setOpenView(true);
  };

  const handleEdit = () => {
    setEditingTitle(title);
    setEditingPriority(priority);
    setEditingPeriodicity(periodicity || "none");
    setEditingAssignedTo(initialAssignedToId || "unassigned");
    setDueDate(initialDueDate ? new Date(initialDueDate).toISOString().split('T')[0] : "");
    setOpenEdit(true);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDueDate(val);
    
    if (val) {
        const [y, m, d] = val.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        
        const result = calculatePriority(dateObj);
        
        if (!result.isValid) {
            setDueError(result.error || "Fecha inválida");
        } else {
            setDueError("");
            setEditingPriority(result.priority);
        }
    } else {
        setDueError("");
    }
  };

  const handleApprove = async () => {
    setSaving(true);
    const result = await updateActivityStatus(activityId, "APPROVED");
    setSaving(false);

    if (result.success) {
      toast.success("Actividad aprobada correctamente.");
    } else {
      toast.error(result.error || "Error al aprobar la actividad.");
    }
  };

  const handleSave = async () => {
    const nextTitle = editingTitle.trim();
    if (!nextTitle) {
      toast.error("El nombre de la actividad es requerido.");
      return;
    }

    const trimmedDue = dueDate.trim();
    if (trimmedDue) {
      const [y, m, d] = trimmedDue.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      
      const result = calculatePriority(dateObj);
      if (!result.isValid) {
        setDueError(result.error || "Fecha de vencimiento inválida.");
        toast.error(result.error || "Fecha de vencimiento inválida.");
        return;
      }
    }

    setSaving(true);
    const formData = new FormData();
    formData.append("title", nextTitle);
    formData.append("priority", editingPriority);
    formData.append("periodicity", editingPeriodicity === "none" ? "" : editingPeriodicity);
    if (canAssign) {
      if (editingAssignedTo && editingAssignedTo !== "unassigned") {
        formData.append("assignedToId", editingAssignedTo);
      } else {
        formData.append("assignedToId", "");
      }
    }
    
    if (trimmedDue) {
      formData.append("dueDate", trimmedDue);
    } else {
        formData.append("dueDate", ""); // Clear date
    }

    const result = await updateProjectActivity(activityId, formData);
    setSaving(false);

    if (result?.success) {
      toast.success("Actividad actualizada correctamente.");
      setOpenEdit(false);
    } else {
      toast.error(result?.error || "Error al actualizar la actividad.");
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const result = await deleteProjectActivity(activityId);
    setDeleting(false);

    if (result?.success) {
      toast.success("Actividad eliminada correctamente.");
      setConfirmOpen(false);
    } else {
      toast.error(result?.error || "Error al eliminar la actividad.");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Acciones de actividad"
            className="text-slate-600 hover:text-[#D4AF37]"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={handleView}>
            <Eye className="h-4 w-4 mr-2" />
            Ver datos
          </DropdownMenuItem>
          {canEdit && (
            <DropdownMenuItem onSelect={handleEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
          )}
          {isAdmin && status !== "APPROVED" && (
            <DropdownMenuItem
              onSelect={handleApprove}
              className="text-green-600 focus:text-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Aprobar
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem
              onSelect={() => setConfirmOpen(true)}
              className="text-red-600 focus:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={openView} onOpenChange={setOpenView}>
        <DialogContent className="sm:max-w-[480px] border-[#D4AF37]/30">
          <DialogHeader>
            <DialogTitle className="text-[#D4AF37]">
              Detalle de actividad
            </DialogTitle>
            <DialogDescription>
              Información básica de la actividad seleccionada.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Nombre</span>
              <span className="font-medium text-right">{title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Estado</span>
              <span className="font-medium">{statusLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Prioridad</span>
              <span className="font-medium">{priority}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Periodicidad</span>
              <span className="font-medium">{periodicity || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Archivos</span>
              <span className="font-medium">
                {documentsCount === 0
                  ? "Sin archivos cargados"
                  : `${documentsCount} archivo${documentsCount > 1 ? "s" : ""}`}
              </span>
            </div>
            {initialAssignedToId && (
                 <div className="flex justify-between">
                 <span className="text-sm text-muted-foreground">Asignado a</span>
                 <span className="font-medium">
                    {consultantUsers.find(u => u.id === initialAssignedToId)?.name || "Usuario desconocido"}
                 </span>
               </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpenView(false)}
              className="border-zinc-700 text-slate-900 bg-white hover:bg-zinc-100"
            >
              Cerrar
            </Button>
            {canEdit && (
              <Button
                type="button"
                onClick={() => {
                  setOpenView(false);
                  handleEdit();
                }}
                className="bg-[#D4AF37] text-black hover:bg-[#B59530]"
              >
                Editar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="sm:max-w-[480px] border-[#D4AF37]/30">
          <DialogHeader>
            <DialogTitle className="text-[#D4AF37]">
              Editar actividad
            </DialogTitle>
            <DialogDescription>
              Actualice los detalles de la actividad.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Nombre de la actividad
              </label>
              <Input
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Periodicidad</label>
              <Select value={editingPeriodicity} onValueChange={setEditingPeriodicity}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona la periodicidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin definir</SelectItem>
                  {PERIODICITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Prioridad
                  {dueDate && !dueError && (
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      (Automática)
                    </span>
                  )}
                </label>
                <Select 
                    value={editingPriority} 
                    onValueChange={setEditingPriority}
                    disabled={!!dueDate && !dueError}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Vencido">Vencido</SelectItem>
                <SelectItem value="Por vencer">Por vencer</SelectItem>
                <SelectItem value="Cumplido">Cumplido</SelectItem>
              </SelectContent>
            </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Fecha de vencimiento
              </label>
              <input
                type="date"
                placeholder="dd/mm/aaaa"
                value={dueDate}
                onChange={handleDateChange}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900 shadow-sm focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              />
              {dueError && (
                <span className="text-xs text-red-600">{dueError}</span>
              )}
            </div>

            {canAssign && consultantUsers.length > 0 && (
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Asignar a</label>
                    <Select value={editingAssignedTo} onValueChange={setEditingAssignedTo}>
                        <SelectTrigger>
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
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpenEdit(false)}
              className="border-zinc-700 text-slate-900 bg-white hover:bg-zinc-100"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-[#D4AF37] text-black hover:bg-[#B59530]"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-[480px] border-[#D4AF37]/30">
          <DialogHeader>
            <DialogTitle className="text-[#D4AF37]">
              Confirmar eliminación
            </DialogTitle>
            <DialogDescription>
              Esta acción eliminará la actividad y sus documentos asociados.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-yellow-700">
            Proceda solo si está seguro. Esta acción no se puede deshacer.
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              className="border-zinc-700 text-slate-900 bg-white hover:bg-zinc-100"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="bg-[#D4AF37] text-black hover:bg-[#B59530]"
            >
              {deleting ? "Eliminando..." : "Estoy de acuerdo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
