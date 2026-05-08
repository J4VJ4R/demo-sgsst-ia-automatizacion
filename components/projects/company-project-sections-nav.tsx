"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CustomLoader } from "@/components/ui/custom-loader";
import { FileText, LayoutGrid, Users, BarChart3, Car, Plus, Calendar } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { ProjectSectionKey } from "@/app/project-sections-actions";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { createCustomProjectSection, setCustomProjectSectionEnabled, type CustomProjectSectionListItem } from "@/app/custom-sections-actions";
import { Input } from "@/components/ui/input";

export function CompanyProjectSectionsNav(props: {
  projectId: string;
  view?: string;
  sections: Record<ProjectSectionKey, boolean>;
  customSections: CustomProjectSectionListItem[];
  canManage: boolean;
  userRole: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [overrides, setOverrides] = useState<Partial<Record<ProjectSectionKey, boolean>>>({});
  const [overridesCustom, setOverridesCustom] = useState<Record<string, boolean>>({});
  const [isToggling, setIsToggling] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencySectionKey, setEmergencySectionKey] = useState<ProjectSectionKey | null>(null);
  const [emergencyPreviousEnabled, setEmergencyPreviousEnabled] = useState<boolean | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const opIdRef = useRef(0);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [adding, setAdding] = useState(false);

  const go = (nextView: string) => {
    startTransition(() => {
      router.push(`/projects/${props.projectId}?view=${nextView}`);
    });
  };

  const activeView = props.view;
  const items = useMemo(
    () =>
      [
        { key: "requirements" as const, view: "requirements", label: "Requisitos", Icon: FileText },
        { key: "accidentalidad" as const, view: "accidentalidad", label: "Sección Accidentalidad", Icon: FileText },
        { key: "collaborators" as const, view: "collaborators", label: "Colaboradores", Icon: Users },
        { key: "sgsst-design" as const, view: "sgsst-design", label: "Sección Diseño SG-SST", Icon: LayoutGrid },
        {
          key: "inspection-maintenance" as const,
          view: "inspection-maintenance",
          label: "Programa de inspecciones y mantenimiento",
          Icon: FileText,
        },
        {
          key: "vehicles-inspection" as const,
          view: "vehicles-inspection",
          label: "Listado de Vehículos",
          Icon: Car,
        },
        {
          key: "drivers-inspection" as const,
          view: "drivers-inspection",
          label: "Listado de conductores",
          Icon: Users,
        },
        {
          key: "minimum-indicators" as const,
          view: "minimum-indicators",
          label: "Indicadores mínimos",
          Icon: BarChart3,
        },
      ] as const,
    []
  );
  const customViewPrefix = "custom-section-";
  const showAgenda = props.userRole === "CONSULTANT";

  return (
    <>
      <CustomLoader isLoading={isPending || isToggling} />

      <Dialog open={emergencyOpen} onOpenChange={setEmergencyOpen}>
        <DialogContent className="sm:max-w-[520px] z-[10000]">
          <DialogHeader>
            <DialogTitle>Operación en curso</DialogTitle>
          </DialogHeader>
          <DialogDescription className="text-sm text-slate-600">
            La operación está tardando más de lo normal. Puedes cancelar la operación o forzar el cierre de la espera.
          </DialogDescription>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                abortRef.current?.abort();
                if (emergencySectionKey && typeof emergencyPreviousEnabled === "boolean") {
                  setOverrides((prev) => ({ ...prev, [emergencySectionKey]: emergencyPreviousEnabled }));
                }
                setIsToggling(false);
                setEmergencyOpen(false);
                setEmergencySectionKey(null);
                setEmergencyPreviousEnabled(null);
                toast.info("Operación cancelada");
              }}
            >
              Cancelar operación
            </Button>
            <Button
              type="button"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                abortRef.current?.abort();
                if (emergencySectionKey && typeof emergencyPreviousEnabled === "boolean") {
                  setOverrides((prev) => ({ ...prev, [emergencySectionKey]: emergencyPreviousEnabled }));
                }
                setIsToggling(false);
                setEmergencyOpen(false);
                setEmergencySectionKey(null);
                setEmergencyPreviousEnabled(null);
                toast.info("Cierre forzado aplicado");
                router.refresh();
              }}
            >
              Forzar cierre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TooltipProvider>
        {items.map(({ key, view, label, Icon }) => {
          const enabled = overrides[key] ?? props.sections[key];
          const isActive = (!activeView && view === "requirements") || activeView === view;
          const disabledNav = isPending || isToggling || !enabled;
          return (
            <div key={key} className="grid gap-2">
              <div className="grid min-w-0 grid-cols-[1fr_auto] items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} className="min-w-0">
                      <Button
                        type="button"
                        variant={isActive ? "default" : "ghost"}
                        disabled={disabledNav}
                        className={`flex-1 min-w-0 justify-start gap-2 ${
                          isActive
                            ? "bg-[#D4AF37] text-black hover:bg-[#B59530]"
                            : "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                        } ${!enabled ? "opacity-60" : ""} shrink w-full text-left`}
                        onClick={() => go(view)}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start" className="max-w-[240px]">
                    {label}
                  </TooltipContent>
                </Tooltip>
                <Switch
                  checked={enabled}
                  disabled={!props.canManage || isToggling}
                  onCheckedChange={async (next) => {
                    if (!props.canManage) return;
                    const previous = enabled;
                    const opId = ++opIdRef.current;

                    abortRef.current?.abort();
                    const controller = new AbortController();
                    abortRef.current = controller;

                    setOverrides((prev) => ({ ...prev, [key]: next }));
                    setIsToggling(true);
                    setEmergencyOpen(false);
                    setEmergencySectionKey(null);
                    setEmergencyPreviousEnabled(null);

                    const timer = window.setTimeout(() => {
                      if (opIdRef.current !== opId) return;
                      setEmergencySectionKey(key);
                      setEmergencyPreviousEnabled(previous);
                      setEmergencyOpen(true);
                    }, 3000);

                    try {
                      const res = await fetch(`/api/projects/${props.projectId}/sections`, {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ sectionKey: key, enabled: next }),
                        signal: controller.signal,
                      });
                      const json = await res.json().catch(() => ({}));
                      if (!res.ok || !json?.success) {
                        throw new Error(json?.error || "No se pudo actualizar el estado.");
                      }
                      toast.success(next ? "Sección activada" : "Sección desactivada");
                      router.refresh();
                    } catch (error) {
                      if (controller.signal.aborted) {
                        setOverrides((prev) => ({ ...prev, [key]: previous }));
                        return;
                      }
                      const message = error instanceof Error ? error.message : "No se pudo actualizar el estado.";
                      toast.error(message);
                      setOverrides((prev) => ({ ...prev, [key]: previous }));
                    } finally {
                      window.clearTimeout(timer);
                      if (opIdRef.current === opId) {
                        setIsToggling(false);
                        setEmergencyOpen(false);
                        setEmergencySectionKey(null);
                        setEmergencyPreviousEnabled(null);
                      }
                    }
                  }}
                />
              </div>

              {key === "minimum-indicators" && showAgenda ? (
                <div className="grid min-w-0 grid-cols-[1fr_auto] items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className="min-w-0">
                        <Button
                          type="button"
                          variant={activeView === "agenda" ? "default" : "ghost"}
                          disabled={isPending || isToggling}
                          className={`flex-1 min-w-0 justify-start gap-2 ${
                            activeView === "agenda"
                              ? "bg-[#D4AF37] text-black hover:bg-[#B59530]"
                              : "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                          } shrink w-full text-left`}
                          onClick={() => go("agenda")}
                        >
                          <Calendar className="h-4 w-4 shrink-0" />
                          <span className="min-w-0 flex-1 truncate text-left">Agenda</span>
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="start" className="max-w-[240px]">
                      Agenda
                    </TooltipContent>
                  </Tooltip>
                  <div />
                </div>
              ) : null}
            </div>
          );
        })}

        {props.customSections.map((s) => {
          const enabled = overridesCustom[s.id] ?? s.enabled;
          const view = `${customViewPrefix}${s.id}`;
          const isActive = activeView === view;
          const disabledNav = isPending || isToggling || !enabled;
          return (
            <div key={s.id} className="grid min-w-0 grid-cols-[1fr_auto] items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="min-w-0">
                    <Button
                      type="button"
                      variant={isActive ? "default" : "ghost"}
                      disabled={disabledNav}
                      className={`flex-1 min-w-0 justify-start gap-2 ${
                        isActive
                          ? "bg-[#D4AF37] text-black hover:bg-[#B59530]"
                          : "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                      } ${!enabled ? "opacity-60" : ""} shrink w-full text-left`}
                      onClick={() => go(view)}
                    >
                      <LayoutGrid className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-left">{s.name}</span>
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" align="start" className="max-w-[240px]">
                  {s.name}
                </TooltipContent>
              </Tooltip>
              <Switch
                checked={enabled}
                disabled={!props.canManage || isToggling}
                onCheckedChange={async (next) => {
                  if (!props.canManage) return;
                  const previous = enabled;
                  setOverridesCustom((prev) => ({ ...prev, [s.id]: next }));
                  setIsToggling(true);
                  try {
                    const res = await setCustomProjectSectionEnabled({ projectId: props.projectId, sectionId: s.id, enabled: next });
                    if (!res.success) throw new Error(res.error || "No se pudo actualizar el estado.");
                    toast.success(next ? "Sección activada" : "Sección desactivada");
                    router.refresh();
                  } catch (error) {
                    const message = error instanceof Error ? error.message : "No se pudo actualizar el estado.";
                    toast.error(message);
                    setOverridesCustom((prev) => ({ ...prev, [s.id]: previous }));
                  } finally {
                    setIsToggling(false);
                  }
                }}
              />
            </div>
          );
        })}

        {props.canManage ? (
          <Button
            type="button"
            variant="outline"
            className="w-full justify-center gap-2 border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
            disabled={isPending || isToggling}
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Agregar sección
          </Button>
        ) : null}
      </TooltipProvider>

      <Dialog open={addOpen} onOpenChange={(next) => (adding ? null : setAddOpen(next))}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Agregar sección</DialogTitle>
            <DialogDescription className="text-sm text-slate-600">Crea un módulo nuevo para esta empresa.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <div className="text-sm font-medium text-slate-900">Nombre</div>
            <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Ej: Programa de formación" />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={adding} onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-[#D4AF37] text-black hover:bg-[#B59530]"
              disabled={adding || addName.trim().length === 0}
              onClick={async () => {
                if (!addName.trim()) return;
                try {
                  setAdding(true);
                  const res = await createCustomProjectSection({ projectId: props.projectId, name: addName });
                  if (!res.success) throw new Error(res.error || "No se pudo crear la sección.");
                  setAddOpen(false);
                  setAddName("");
                  toast.success("Sección creada.");
                  go(`${customViewPrefix}${res.sectionId}`);
                  router.refresh();
                } catch (e) {
                  const message = e instanceof Error ? e.message : "No se pudo crear la sección.";
                  toast.error(message);
                } finally {
                  setAdding(false);
                }
              }}
            >
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
