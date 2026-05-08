"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MinimumIndicatorCreateDialog } from "@/components/minimum-indicators/minimum-indicator-create-dialog";
import { listMinimumIndicators, type MinimumIndicatorListItem } from "@/app/minimum-indicators-actions";
import { Search, ArrowRight } from "lucide-react";
import { CustomLoader } from "@/components/ui/custom-loader";
import { toast } from "sonner";

function getTrafficLight(targetPercent: number, currentValue: number | null) {
  if (currentValue === null) return { label: "Sin datos", className: "bg-slate-50 text-slate-700 border-slate-200" };
  const ratio = targetPercent === 0 ? 0 : (currentValue / targetPercent) * 100;
  if (ratio >= 100) return { label: "En meta", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (ratio >= 80) return { label: "Cerca", className: "bg-amber-50 text-amber-800 border-amber-200" };
  return { label: "Bajo", className: "bg-red-50 text-red-700 border-red-200" };
}

export function MinimumIndicatorsManager(props: {
  projectId: string;
  initialIndicators: MinimumIndicatorListItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MinimumIndicatorListItem[]>(props.initialIndicators);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listMinimumIndicators({
      projectId: props.projectId,
      type: typeFilter || null,
      periodStart: periodStart || null,
      periodEnd: periodEnd || null,
    });
    if (!res.success) {
      toast.error(res.error || "No se pudo cargar los indicadores.");
      setItems([]);
      setLoading(false);
      return;
    }
    setItems(res.indicators);
    setLoading(false);
  }, [periodEnd, periodStart, props.projectId, typeFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => {
      const hay = `${i.name} ${i.description || ""} ${i.type || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  const types = useMemo(() => {
    const set = new Set<string>();
    for (const i of items) if (i.type) set.add(i.type);
    return Array.from(set).sort();
  }, [items]);

  return (
    <Card className="min-w-0 overflow-x-hidden gap-2 py-3">
      <CustomLoader isLoading={isPending} />
      <CardHeader className="px-3 gap-3">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base sm:text-lg">Indicadores mínimos</CardTitle>
            <p className="text-sm leading-[1.5] text-slate-600">
              Crea indicadores con fórmulas, carga datos por periodo y visualiza el cumplimiento por empresa.
            </p>
          </div>
          {props.canManage ? (
            <div className="w-full sm:w-auto">
              <MinimumIndicatorCreateDialog projectId={props.projectId} onCreated={load} />
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="min-w-0 overflow-x-hidden px-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nombre o tipo..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 pl-9 sm:h-9"
            />
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Input
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              placeholder={types.length ? `Tipo (ej: ${types[0]})` : "Tipo"}
              className="h-11 sm:h-9"
            />
            <Input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="h-11 sm:h-9"
            />
            <Input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="h-11 sm:h-9"
            />
            <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={load}>
              Aplicar
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {filtered.map((i) => {
            const current = i.latestMeasurement ? i.latestMeasurement.computedValue : null;
            const light = getTrafficLight(i.targetPercent, current);
            return (
              <Card key={i.id} className="rounded-2xl border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="break-words text-base font-semibold text-slate-950">{i.name}</div>
                      {i.description ? (
                        <div className="mt-1 break-words text-sm text-slate-600">{i.description}</div>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline" className={light.className}>
                          {light.label}
                        </Badge>
                        {i.type ? (
                          <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                            {i.type}
                          </Badge>
                        ) : null}
                        <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                          Periodicidad: {i.periodicity}
                        </Badge>
                        <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                          Meta: {i.targetPercent}%
                        </Badge>
                        {current !== null ? (
                          <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                            Actual: {current.toFixed(2)} {i.unit}
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:w-[220px]">
                      <Button
                        type="button"
                        className="h-11 rounded-xl bg-[#D4AF37] text-black hover:bg-[#B59530]"
                        onClick={() =>
                          startTransition(() => {
                            router.push(`/projects/${props.projectId}/minimum-indicators/${i.id}`);
                          })
                        }
                      >
                        Ver detalle
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                      <Button type="button" variant="outline" className="h-11 rounded-xl" asChild>
                        <Link href={`/projects/${props.projectId}/minimum-indicators/${i.id}`}>
                          Cargar datos
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {!loading && filtered.length === 0 ? (
            <Card className="rounded-2xl border-slate-200">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No hay indicadores para los filtros actuales.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
