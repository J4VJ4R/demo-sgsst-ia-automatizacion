"use client";

import { type FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";

export function AccidentalidadActivityCreateDialog(props: {
  projectId: string;
  canCreate: boolean;
  onCreated: (payload: {
    accident: {
      id: string;
      name: string;
      fechaAccidente: string;
      nombreColaborador: string;
      identificacion: string;
      area: string;
    };
    rows: {
      id: string;
      actividad: string;
      status: string;
      priority: string;
      dueDate: string;
      createdAt: string;
      assignedTo: string | null;
      archivos: any[];
    }[];
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [fechaAccidente, setFechaAccidente] = useState("");
  const [nombreColaborador, setNombreColaborador] = useState("");
  const [identificacion, setIdentificacion] = useState("");
  const [area, setArea] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const validationError = useMemo(() => {
    const nombre = nombreColaborador.trim();
    const ident = identificacion.trim();
    const areaValue = area.trim();
    if (!fechaAccidente.trim()) return "La fecha del accidente es requerida.";
    if (!nombre) return "El nombre del colaborador es requerido.";
    if (!ident) return "La identificación es requerida.";
    if (!areaValue) return "El área es requerida.";
    if (nombre.length > 80) return "El nombre del colaborador debe tener máximo 80 caracteres.";
    if (ident.length > 30) return "La identificación debe tener máximo 30 caracteres.";
    if (areaValue.length > 60) return "El área debe tener máximo 60 caracteres.";
    return "";
  }, [fechaAccidente, nombreColaborador, identificacion, area]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setFechaAccidente("");
      setNombreColaborador("");
      setIdentificacion("");
      setArea("");
      setSaving(false);
      setError("");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const computed = validationError;
    if (computed) {
      setError(computed);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/actividades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: props.projectId,
          fechaAccidente: fechaAccidente.trim(),
          nombreColaborador: nombreColaborador.trim(),
          identificacion: identificacion.trim(),
          area: area.trim(),
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload?.error || "No se pudo crear la actividad.");
        return;
      }

      props.onCreated(payload);
      toast.success("Accidente creado correctamente");
      setOpen(false);
    } catch (err) {
      console.error(err);
      setError("Error al crear el accidente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          className="w-full bg-[#D4AF37] text-black hover:bg-[#B59530] gap-2 sm:w-auto"
          disabled={!props.canCreate}
        >
          <Plus className="h-4 w-4" />
          Agregar accidente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px] border-[#D4AF37]/30 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#D4AF37]">Agregar accidente</DialogTitle>
          <DialogDescription>
            Registra un accidente para esta empresa.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="acc-fecha" className="text-sm font-medium text-slate-700">
              Fecha del accidente *
            </Label>
            <Input
              id="acc-fecha"
              type="date"
              value={fechaAccidente}
              onChange={(e) => setFechaAccidente(e.target.value)}
              autoFocus
              required
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="acc-nombre" className="text-sm font-medium text-slate-700">
              Nombre del colaborador *
            </Label>
            <Input
              id="acc-nombre"
              placeholder="Nombre del colaborador"
              value={nombreColaborador}
              maxLength={80}
              onChange={(e) => setNombreColaborador(e.target.value)}
              required
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="acc-ident" className="text-sm font-medium text-slate-700">
              Identificación *
            </Label>
            <Input
              id="acc-ident"
              placeholder="Número de identificación"
              value={identificacion}
              maxLength={30}
              onChange={(e) => setIdentificacion(e.target.value)}
              required
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="acc-area" className="text-sm font-medium text-slate-700">
              Área *
            </Label>
            <Input
              id="acc-area"
              placeholder='Ej: "Transporte"'
              value={area}
              maxLength={60}
              onChange={(e) => setArea(e.target.value)}
              required
              disabled={saving}
            />
          </div>

          {(error || validationError) && (
            <p className="text-xs text-red-600">{error || validationError}</p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-zinc-700 bg-white text-slate-900 hover:bg-zinc-100"
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || !!validationError}
              className="bg-[#D4AF37] text-black hover:bg-[#B59530]"
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando...
                </span>
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
