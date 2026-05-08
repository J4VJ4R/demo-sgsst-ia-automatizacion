"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { createMinimumIndicator } from "@/app/minimum-indicators-actions";
import { sanitizeVariableKey, tokenizeFormula } from "@/lib/minimum-indicators-formula";
import { PERIODICITY_OPTIONS } from "@/lib/periodicity";

type VariableRow = { key: string; label: string };

export function MinimumIndicatorCreateDialog(props: { projectId: string; onCreated?: () => Promise<void> | void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("");
  const [unit, setUnit] = useState("%");
  const [periodicity, setPeriodicity] = useState<string>("Mensual");
  const [targetPercent, setTargetPercent] = useState("100");
  const [formula, setFormula] = useState("");

  const [newVarLabel, setNewVarLabel] = useState("");
  const [variables, setVariables] = useState<VariableRow[]>([]);

  const formulaValidation = useMemo(() => tokenizeFormula(formula), [formula]);
  const newVarKey = useMemo(() => sanitizeVariableKey(newVarLabel), [newVarLabel]);
  const canSubmit = useMemo(() => {
    if (!name.trim()) return false;
    if (!unit.trim()) return false;
    if (!periodicity.trim()) return false;
    const meta = Number(targetPercent);
    if (!Number.isFinite(meta) || meta < 0 || meta > 1000) return false;
    if (!formulaValidation.ok) return false;
    return true;
  }, [formulaValidation.ok, name, periodicity, targetPercent, unit]);

  const addVariable = () => {
    const label = newVarLabel.trim();
    if (!label) return;
    const key = newVarKey;
    if (!key) {
      toast.error("Nombre de variable inválido.");
      return;
    }
    if (variables.some((v) => v.key === key)) {
      toast.error("La variable ya existe.");
      return;
    }
    setVariables((prev) => [...prev, { key, label }]);
    setNewVarLabel("");
  };

  const insertText = (value: string) => {
    setFormula((prev) => (prev ? `${prev}${value}` : value));
  };

  const reset = () => {
    setName("");
    setDescription("");
    setType("");
    setUnit("%");
    setPeriodicity("Mensual");
    setTargetPercent("100");
    setFormula("");
    setNewVarLabel("");
    setVariables([]);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="h-11 rounded-2xl bg-[#D4AF37] px-4 text-base text-black hover:bg-[#B59530] sm:h-9 sm:rounded-full sm:text-sm">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo indicador
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[920px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear indicador mínimo</DialogTitle>
          <DialogDescription>Defina la meta en porcentaje y la fórmula de cálculo.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label>Nombre del indicador *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción" />
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="Ej. Seguridad, Salud, Operativo" />
          </div>

          <div className="space-y-2">
            <Label>Unidad de medida *</Label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="%" />
          </div>

          <div className="space-y-2">
            <Label>Periodicidad *</Label>
            <Select value={periodicity} onValueChange={setPeriodicity}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccione periodicidad" />
              </SelectTrigger>
              <SelectContent>
                {PERIODICITY_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Meta establecida (en %) *</Label>
            <Input inputMode="decimal" value={targetPercent} onChange={(e) => setTargetPercent(e.target.value)} placeholder="100" />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Variables</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={newVarLabel}
                onChange={(e) => setNewVarLabel(e.target.value)}
                placeholder='Ej. "Días de accidentes"'
              />
              <Button type="button" variant="outline" onClick={addVariable} className="h-11 sm:h-9" disabled={!newVarKey}>
                Agregar
              </Button>
            </div>
            {newVarLabel.trim() ? (
              <div className="text-xs text-slate-500">
                Se guardará como: <span className="font-semibold text-slate-700">{newVarKey || "—"}</span>
              </div>
            ) : null}
            {variables.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {variables.map((v) => (
                  <div key={v.key} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm">
                    <button
                      type="button"
                      className="font-semibold text-slate-900 hover:text-[#B59530]"
                      onClick={() => insertText(v.key)}
                      title="Insertar en fórmula"
                    >
                      {v.label}
                    </button>
                    <span className="text-xs text-slate-500">{v.key}</span>
                    <button
                      type="button"
                      className="rounded-full p-1 hover:bg-slate-100"
                      onClick={() => setVariables((prev) => prev.filter((x) => x.key !== v.key))}
                    >
                      <X className="h-4 w-4 text-slate-600" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Escribe nombres normales (ej. “Días de accidentes”) y el sistema los convertirá automáticamente.</div>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Fórmula *</Label>
            <Input
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="Ej: (dias_accidente / dias_trabajados) * 100"
            />
            <div className="flex flex-wrap gap-2">
              {[" + ", " - ", " * ", " / ", "(", ")", " * 100"].map((op) => (
                <Button key={op} type="button" variant="outline" size="sm" onClick={() => insertText(op)}>
                  {op.trim()}
                </Button>
              ))}
            </div>
            {!formulaValidation.ok ? (
              <div className="text-sm text-red-600">{formulaValidation.error}</div>
            ) : (
              <div className="text-xs text-slate-500">Variables detectadas: {formulaValidation.variables.join(", ") || "—"}</div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button
            type="button"
            className="w-full bg-[#D4AF37] text-black hover:bg-[#B59530] sm:w-auto"
            disabled={!canSubmit || saving}
            onClick={async () => {
              setSaving(true);
              try {
                const fd = new FormData();
                fd.append("projectId", props.projectId);
                fd.append("name", name);
                fd.append("description", description);
                fd.append("type", type);
                fd.append("unit", unit);
                fd.append("periodicity", periodicity);
                fd.append("targetPercent", targetPercent);
                fd.append("formula", formula);
                fd.append("variablesJson", JSON.stringify(variables));
                const res = await createMinimumIndicator(fd);
                if (!res.success) {
                  toast.error(res.error || "No se pudo crear el indicador.");
                  return;
                }
                toast.success("Indicador creado");
                setOpen(false);
                reset();
                if (props.onCreated) await props.onCreated();
              } catch (err) {
                const message = err instanceof Error ? err.message : "No se pudo crear el indicador.";
                toast.error(message);
              } finally {
                setSaving(false);
              }
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
