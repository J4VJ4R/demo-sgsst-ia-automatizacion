"use client";

import { useState } from "react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import {
  deleteAccidentalidadEmpresa,
  getAccidentalidadHistory,
  updateAccidentalidadEmpresa,
} from "@/app/actions/accidentalidad-actions";
import { MoreVertical, Trash2, Pencil, History } from "lucide-react";

export type AccidentalidadFile = {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
  version: number;
  sizeBytes: number | null;
};

export function AccidentalidadActions(props: {
  accidentalidadId: string;
  canEdit: boolean;
  canDelete: boolean;
  actividad: string;
  dueDate: string;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRows, setHistoryRows] = useState<any[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editActividad, setEditActividad] = useState(props.actividad);
  const [editDueDate, setEditDueDate] = useState(props.dueDate.slice(0, 10));

  const openHistory = async () => {
    setHistoryOpen(true);
    try {
      const res = await getAccidentalidadHistory(props.accidentalidadId);
      if (!res.success) {
        toast.error(res.error || "No se pudo cargar el historial.");
        setHistoryRows([]);
        return;
      }
      setHistoryRows(res.history as any[]);
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar historial.");
      setHistoryRows([]);
    }
  };

  const deleteRow = async () => {
    const res = await deleteAccidentalidadEmpresa(props.accidentalidadId);
    if (!res.success) toast.error(res.error || "No se pudo eliminar.");
    else toast.success("Actividad eliminada.");
  };

  const saveEdit = async () => {
    const fd = new FormData();
    fd.append("actividad", editActividad);
    fd.append("dueDate", editDueDate);
    const res = await updateAccidentalidadEmpresa(props.accidentalidadId, fd);
    if (!res.success) {
      toast.error(res.error || "No se pudo guardar.");
      return;
    }
    toast.success("Cambios guardados.");
    setEditOpen(false);
  };

  return (
    <div className="flex items-center justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-slate-600 hover:text-[#D4AF37]"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => setEditOpen(true)} disabled={!props.canEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={openHistory}>
            <History className="h-4 w-4 mr-2" />
            Ver historial
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={deleteRow} disabled={!props.canDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar actividad
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Historial</DialogTitle>
            <DialogDescription>Cambios registrados para esta actividad.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[360px] overflow-auto rounded-md border border-slate-200">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="p-2">Fecha</th>
                  <th className="p-2">Campo</th>
                  <th className="p-2">Antes</th>
                  <th className="p-2">Después</th>
                  <th className="p-2">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.length === 0 ? (
                  <tr>
                    <td className="p-3 text-center text-sm text-muted-foreground" colSpan={5}>
                      Sin historial
                    </td>
                  </tr>
                ) : (
                  historyRows.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="p-2 text-xs">
                        {new Date(row.changedAt).toLocaleString()}
                      </td>
                      <td className="p-2 text-xs">{row.field}</td>
                      <td className="p-2 text-xs">{row.oldValue || "-"}</td>
                      <td className="p-2 text-xs">{row.newValue}</td>
                      <td className="p-2 text-xs">
                        {row.changedBy?.name || "Usuario"}{" "}
                        {row.changedBy?.role ? `(${row.changedBy.role})` : ""}
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar actividad</DialogTitle>
            <DialogDescription>Actualiza la actividad y su fecha de vencimiento.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="actividad">Actividad</Label>
              <Input
                id="actividad"
                value={editActividad}
                onChange={(e) => setEditActividad(e.target.value)}
                disabled={!props.canEdit}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dueDate">Fecha de vencimiento</Label>
              <Input
                id="dueDate"
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                disabled={!props.canEdit}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={saveEdit} disabled={!props.canEdit}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
