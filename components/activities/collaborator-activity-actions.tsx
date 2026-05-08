'use client';

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoreVertical, Eye, Pencil, Trash2 } from "lucide-react";
import { updateCollaboratorActivity, deleteCollaboratorActivity } from "@/app/actions";
import { toast } from "sonner";
import { PERIODICITY_OPTIONS } from "@/lib/periodicity";

interface CollaboratorActivityActionsProps {
  activityId: string;
  title: string;
  status: string;
  periodicity?: string | null;
  dueDate?: string | null;
  documentsCount: number;
  canDelete?: boolean;
  isAdmin?: boolean;
}

export function CollaboratorActivityActions({
  activityId,
  title,
  status,
  periodicity = null,
  dueDate: initialDueDate = null,
  documentsCount,
  canDelete = true,
  isAdmin = false,
}: CollaboratorActivityActionsProps) {
  // If not admin, then it is consultant (as per usage context). 
  // Requirement: Remove edit option for consultant.
  // So canEdit is true only if isAdmin.
  const canEdit = isAdmin;
  const [openView, setOpenView] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(title);
  const [editingPeriodicity, setEditingPeriodicity] = useState<string>(periodicity || "none");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const statusLabel =
    status === "APPROVED"
      ? "Aprobada"
      : status === "IN_REVIEW"
      ? "En revisión"
      : status === "PENDING"
      ? "Pendiente"
      : status;

  const handleView = () => {
    setOpenView(true);
  };

  const handleEdit = () => {
    setEditingTitle(title);
    setEditingPeriodicity(periodicity || "none");
    setOpenEdit(true);
  };

  const handleSave = async () => {
    const nextTitle = editingTitle.trim();
    if (!nextTitle) {
      toast.error("El nombre de la actividad es requerido.");
      return;
    }

    setSaving(true);
    const fd = new FormData();
    fd.append("title", nextTitle);
    fd.append("periodicity", editingPeriodicity === "none" ? "" : editingPeriodicity);
    const result = await updateCollaboratorActivity(activityId, fd);
    setSaving(false);

    if (result?.success) {
      toast.success("Actividad actualizada correctamente.");
      setOpenEdit(false);
    } else {
      toast.error(
        result?.error || "Error al actualizar la actividad."
      );
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const result = await deleteCollaboratorActivity(activityId);
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
              <span className="font-medium">{title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Estado</span>
              <span className="font-medium">{statusLabel}</span>
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
              Actualice el nombre y la periodicidad de la actividad.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">
                Nombre de la actividad
              </span>
              <Input
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Periodicidad</span>
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
            </label>
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
              className="bg-[#D4AF37] hover:bg-[#B5952F] text-white"
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
