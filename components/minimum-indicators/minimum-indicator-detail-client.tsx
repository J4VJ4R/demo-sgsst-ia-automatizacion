"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  LabelList,
  Label as RechartsLabel,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDown, ArrowUp, Minus, Download } from "lucide-react";
import { createMinimumIndicatorMeasurement, updateMinimumIndicator } from "@/app/minimum-indicators-actions";
import { evaluateFormula, tokenizeFormula } from "@/lib/minimum-indicators-formula";
import { PERIODICITY_OPTIONS } from "@/lib/periodicity";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type DetailResult = Awaited<ReturnType<typeof import("@/app/minimum-indicators-actions").getMinimumIndicatorDetail>>;
type DetailOk = Extract<DetailResult, { success: true }>;

function formatDateInput(iso: string) {
  if (!iso) return "";
  const datePart = iso.includes("T") ? iso.split("T")[0] : iso;
  return datePart;
}

function trafficLight(target: number, value: number | null) {
  if (value === null) return { label: "Sin datos", className: "bg-slate-50 text-slate-700 border-slate-200" };
  const pct = target === 0 ? 0 : (value / target) * 100;
  if (pct >= 100) return { label: "En meta", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (pct >= 80) return { label: "Cerca", className: "bg-amber-50 text-amber-800 border-amber-200" };
  return { label: "Bajo", className: "bg-red-50 text-red-700 border-red-200" };
}

function trendIcon(current: number | null, prev: number | null) {
  if (current === null || prev === null) return { Icon: Minus, label: "Sin tendencia" };
  const diff = current - prev;
  if (Math.abs(diff) < 0.0001) return { Icon: Minus, label: "Estable" };
  if (diff > 0) return { Icon: ArrowUp, label: "Alza" };
  return { Icon: ArrowDown, label: "Baja" };
}

function detectRatioFormula(formula: string) {
  const normalized = (formula || "").replace(/\s+/g, "");
  const m1 = normalized.match(/^\(?([a-zA-Z_]\w*)\/([a-zA-Z_]\w*)\)?\*100$/);
  if (m1) return { numeratorKey: m1[1], denominatorKey: m1[2] };
  const m2 = normalized.match(/^100\*\(?([a-zA-Z_]\w*)\/([a-zA-Z_]\w*)\)?$/);
  if (m2) return { numeratorKey: m2[1], denominatorKey: m2[2] };
  return null;
}

function formatQuantity(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
  if (Math.abs(value) >= 1000) return value.toFixed(1);
  return value.toFixed(2);
}

function getFriendlyPreviewError(args: { rawError: string; variables: Array<{ key: string; label: string }> }) {
  const raw = (args.rawError || "").trim();
  const missingPrefix = "Variable sin valor:";
  if (raw.startsWith(missingPrefix)) {
    const key = raw.slice(missingPrefix.length).trim();
    const label = args.variables.find((v) => v.key === key)?.label;
    return label ? `Falta completar: ${label}` : "Falta completar uno de los campos.";
  }
  if (raw.toLowerCase().includes("división por cero") || raw.toLowerCase().includes("division por cero")) {
    return "No se puede calcular porque uno de los valores está en 0 y se usa como divisor.";
  }
  if (raw.toLowerCase().includes("fórmula inválida") || raw.toLowerCase().includes("formula invalida")) {
    return "No se puede calcular. Revisa la fórmula del indicador.";
  }
  return "No se puede calcular. Completa todos los campos con números.";
}

export function MinimumIndicatorDetailClient(props: { projectId: string; initial: DetailOk }) {
  const initial = props.initial;
  const [saving, setSaving] = useState(false);
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const indicator = initial.indicator;

  const measurements = useMemo(() => [...indicator.measurements].sort((a, b) => (a.periodEnd < b.periodEnd ? -1 : 1)), [indicator.measurements]);
  const latest = measurements.length ? measurements[measurements.length - 1] : null;
  const prev = measurements.length >= 2 ? measurements[measurements.length - 2] : null;
  const ratio = useMemo(() => detectRatioFormula(indicator.formula), [indicator.formula]);
  const latestInputsJson = latest?.inputsJson || "";
  const prevInputsJson = prev?.inputsJson || "";
  const latestInputs = useMemo(() => {
    if (!latestInputsJson) return {};
    try {
      const parsed = JSON.parse(latestInputsJson);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
    } catch {
      return {};
    }
  }, [latestInputsJson]);
  const prevInputs = useMemo(() => {
    if (!prevInputsJson) return {};
    try {
      const parsed = JSON.parse(prevInputsJson);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
    } catch {
      return {};
    }
  }, [prevInputsJson]);

  const latestValue = latest ? latest.computedValue : null;
  const light = trafficLight(indicator.targetPercent, latestValue);
  const trend = trendIcon(latest ? latest.computedValue : null, prev ? prev.computedValue : null);
  const TrendIcon = trend.Icon;

  const initialPeriodStart = latest ? formatDateInput(latest.periodStart) : "";
  const initialPeriodEnd = latest ? formatDateInput(latest.periodEnd) : "";

  const [periodStart, setPeriodStart] = useState(initialPeriodStart);
  const [periodEnd, setPeriodEnd] = useState(initialPeriodEnd);
  const [resultAnalysis, setResultAnalysis] = useState("");

  const variables = useMemo(() => indicator.variables || [], [indicator.variables]);
  const ratioSummary = useMemo(() => {
    if (!ratio || !latest) return null;
    const numerator = Number(latestInputs[ratio.numeratorKey]);
    const denominator = Number(latestInputs[ratio.denominatorKey]);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
    const numeratorLabel = variables.find((v) => v.key === ratio.numeratorKey)?.label || ratio.numeratorKey;
    const denominatorLabel = variables.find((v) => v.key === ratio.denominatorKey)?.label || ratio.denominatorKey;
    const metaAllowed = (denominator * indicator.targetPercent) / 100;
    const metaAllowedOk = Number.isFinite(metaAllowed) ? metaAllowed : null;
    const deltaNumerator = prev
      ? (() => {
          const prevNumerator = Number(prevInputs[ratio.numeratorKey]);
          return Number.isFinite(prevNumerator) ? numerator - prevNumerator : null;
        })()
      : null;
    return {
      numerator,
      denominator,
      numeratorLabel,
      denominatorLabel,
      metaAllowed: metaAllowedOk,
      deltaNumerator,
    };
  }, [indicator.targetPercent, latest, latestInputs, prev, prevInputs, ratio, variables]);

  const [inputs, setInputs] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    for (const v of variables) base[v.key] = "";
    return base;
  });

  const computedPreview = useMemo(() => {
    const numericVars: Record<string, number> = {};
    for (const v of variables) {
      const raw = inputs[v.key];
      const num = raw === "" ? NaN : Number(raw);
      if (!Number.isFinite(num)) continue;
      numericVars[v.key] = num;
    }
    const evalRes = evaluateFormula(indicator.formula, numericVars);
    if (!evalRes.ok) return { ok: false as const, error: evalRes.error };
    const value = evalRes.value;
    const pct = indicator.targetPercent === 0 ? 0 : (value / indicator.targetPercent) * 100;
    return { ok: true as const, value, pct };
  }, [indicator.formula, indicator.targetPercent, inputs, variables]);

  const canSaveMeasurement = useMemo(() => {
    return !!periodStart && !!periodEnd && computedPreview.ok && !saving;
  }, [computedPreview.ok, periodEnd, periodStart, saving]);

  const previewMessage = useMemo(() => {
    if (computedPreview.ok) return null;
    return getFriendlyPreviewError({ rawError: computedPreview.error, variables });
  }, [computedPreview, variables]);

  const pieData = useMemo(() => {
    if (!latest) return [];
    if (ratioSummary) {
      const total = ratioSummary.denominator;
      if (!Number.isFinite(total) || total <= 0) return [];
      const part = Math.max(0, Math.min(total, ratioSummary.numerator));
      const rest = Math.max(0, total - part);
      return [
        { name: ratioSummary.numeratorLabel, value: part },
        { name: "Resto del total", value: rest },
      ];
    }
    const actual = latest.computedValue;
    const target = indicator.targetPercent;
    const pct = target === 0 ? 0 : Math.min(100, Math.max(0, (actual / target) * 100));
    return [
      { name: "Cumplimiento", value: pct },
      { name: "Pendiente", value: Math.max(0, 100 - pct) },
    ];
  }, [indicator.targetPercent, latest, ratioSummary]);

  const complianceNowPct = useMemo(() => {
    if (!latest) return null;
    if (!Number.isFinite(latest.compliancePct)) return null;
    return Math.max(0, latest.compliancePct);
  }, [latest]);

  const complianceLabelPct = useMemo(() => {
    if (complianceNowPct === null) return "—";
    if (complianceNowPct >= 1000) return `${Math.round(complianceNowPct)}%`;
    return `${complianceNowPct.toFixed(1)}%`;
  }, [complianceNowPct]);

  const deltaPct = useMemo(() => {
    if (!latest || !prev) return null;
    if (!Number.isFinite(latest.compliancePct) || !Number.isFinite(prev.compliancePct)) return null;
    return latest.compliancePct - prev.compliancePct;
  }, [latest, prev]);

  const deltaLabel = useMemo(() => {
    if (deltaPct === null) return "—";
    const abs = Math.abs(deltaPct);
    const value = abs >= 1000 ? Math.round(abs).toString() : abs.toFixed(1);
    if (deltaPct > 0) return `+${value} pts vs periodo anterior`;
    if (deltaPct < 0) return `-${value} pts vs periodo anterior`;
    return "0.0 pts vs periodo anterior";
  }, [deltaPct]);

  const exportExcel = () => {
    const rows = measurements.map((m) => ({
      periodStart: formatDateInput(m.periodStart),
      periodEnd: formatDateInput(m.periodEnd),
      computedValue: m.computedValue,
      compliancePct: m.compliancePct,
      inputsJson: m.inputsJson,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mediciones");
    const fileName = `indicador_${indicator.id}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Indicador: ${indicator.name}`, 14, 16);
    doc.setFontSize(10);
    doc.text(`Meta: ${indicator.targetPercent}%`, 14, 24);
    doc.text(`Periodicidad: ${indicator.periodicity}`, 14, 30);
    doc.text(`Fórmula: ${indicator.formula}`, 14, 36, { maxWidth: 180 });

    const body = measurements
      .slice()
      .sort((a, b) => (a.periodEnd > b.periodEnd ? -1 : 1))
      .map((m) => [
        formatDateInput(m.periodStart),
        formatDateInput(m.periodEnd),
        m.computedValue.toFixed(4),
        `${m.compliancePct.toFixed(2)}%`,
      ]);

    autoTable(doc, {
      startY: 44,
      head: [["Inicio", "Fin", "Valor", "Cumplimiento"]],
      body,
      styles: { fontSize: 9 },
    });
    doc.save(`indicador_${indicator.id}.pdf`);
  };

  const saveMeasurement = async () => {
    if (!props.initial.canManage) {
      toast.error("Sin permisos");
      return;
    }
    if (!periodStart || !periodEnd) {
      toast.error("Ingrese el periodo.");
      return;
    }
    const payload: Record<string, number> = {};
    for (const v of variables) {
      const raw = inputs[v.key];
      const num = Number(raw);
      if (!Number.isFinite(num)) {
        toast.error(`Valor inválido para ${v.label}`);
        return;
      }
      payload[v.key] = num;
    }
    const fd = new FormData();
    fd.append("projectId", props.projectId);
    fd.append("indicatorId", indicator.id);
    fd.append("periodStart", new Date(periodStart).toISOString());
    fd.append("periodEnd", new Date(periodEnd).toISOString());
    fd.append("inputsJson", JSON.stringify(payload));
    fd.append("resultAnalysis", resultAnalysis.trim());
    setSaving(true);
    try {
      const res = await createMinimumIndicatorMeasurement(fd);
      if (!res.success) {
        toast.error(res.error || "No se pudo guardar la medición.");
        return;
      }
      toast.success("Medición guardada");
      window.location.reload();
    } finally {
      setSaving(false);
    }
  };

  const [editName, setEditName] = useState(indicator.name);
  const [editDescription, setEditDescription] = useState(indicator.description || "");
  const [editType, setEditType] = useState(indicator.type || "");
  const [editUnit, setEditUnit] = useState(indicator.unit);
  const [editPeriodicity, setEditPeriodicity] = useState(indicator.periodicity);
  const [editTarget, setEditTarget] = useState(String(indicator.targetPercent));
  const [editFormula, setEditFormula] = useState(indicator.formula);

  const formulaOk = useMemo(() => tokenizeFormula(editFormula), [editFormula]);

  const saveConfig = async () => {
    if (!props.initial.canManage) return;
    if (!formulaOk.ok) {
      toast.error(formulaOk.error);
      return;
    }
    const fd = new FormData();
    fd.append("projectId", props.projectId);
    fd.append("indicatorId", indicator.id);
    fd.append("name", editName);
    fd.append("description", editDescription);
    fd.append("type", editType);
    fd.append("unit", editUnit);
    fd.append("periodicity", editPeriodicity);
    fd.append("targetPercent", editTarget);
    fd.append("formula", editFormula);
    fd.append("variablesJson", JSON.stringify(indicator.variables));
    setSaving(true);
    try {
      const res = await updateMinimumIndicator(fd);
      if (!res.success) {
        toast.error(res.error || "No se pudo actualizar el indicador.");
        return;
      }
      toast.success("Configuración actualizada");
      window.location.reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-w-0 space-y-6">
      <Card className="min-w-0 overflow-x-hidden">
        <CardHeader className="px-3 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="break-words text-base sm:text-lg">{indicator.name}</CardTitle>
              {indicator.description ? (
                <div className="mt-1 break-words text-sm text-slate-600">{indicator.description}</div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline" className={light.className}>
                  {light.label}
                </Badge>
                {indicator.type ? (
                  <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                    {indicator.type}
                  </Badge>
                ) : null}
                <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                  Meta: {indicator.targetPercent}%
                </Badge>
                {latestValue !== null ? (
                  <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                    Actual: {latestValue.toFixed(2)} {indicator.unit}
                  </Badge>
                ) : null}
                <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 inline-flex items-center gap-2">
                  <TrendIcon className="h-4 w-4" />
                  {trend.label}
                </Badge>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-[260px]">
              <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={exportPdf}>
                <Download className="mr-2 h-4 w-4" />
                Exportar PDF
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={exportExcel}>
                <Download className="mr-2 h-4 w-4" />
                Exportar Excel
              </Button>
              {props.initial.canManage ? (
                <Button
                  type="button"
                  className="h-11 rounded-xl bg-[#D4AF37] text-black hover:bg-[#B59530]"
                  onClick={() => setIsEditingConfig((p) => !p)}
                >
                  {isEditingConfig ? "Cerrar configuración" : "Configurar"}
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
      </Card>

      {isEditingConfig ? (
        <Card className="min-w-0 overflow-x-hidden">
          <CardHeader className="px-3 sm:px-6">
            <CardTitle className="text-base">Configuración</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Nombre</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Descripción</Label>
                <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Input value={editType} onChange={(e) => setEditType(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Unidad</Label>
                <Input value={editUnit} onChange={(e) => setEditUnit(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Periodicidad</Label>
                <Select value={editPeriodicity} onValueChange={setEditPeriodicity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona la periodicidad" />
                  </SelectTrigger>
                  <SelectContent>
                    {editPeriodicity && !(PERIODICITY_OPTIONS as readonly string[]).includes(editPeriodicity) ? (
                      <SelectItem value={editPeriodicity}>{editPeriodicity}</SelectItem>
                    ) : null}
                    {PERIODICITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Meta (%)</Label>
                <Input value={editTarget} onChange={(e) => setEditTarget(e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Fórmula</Label>
                <Input value={editFormula} onChange={(e) => setEditFormula(e.target.value)} />
                {!formulaOk.ok ? (
                  <div className="text-sm text-red-600">{formulaOk.error}</div>
                ) : (
                  <div className="text-xs text-slate-500">Variables: {formulaOk.variables.join(", ") || "—"}</div>
                )}
              </div>
            </div>
            <Button
              type="button"
              className="w-full sm:w-auto bg-[#D4AF37] text-black hover:bg-[#B59530]"
              disabled={saving}
              onClick={saveConfig}
            >
              Guardar configuración
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="min-w-0 overflow-x-hidden">
          <CardHeader className="px-3 sm:px-6">
            <CardTitle className="text-base">Actual vs Meta</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    {
                      name: "Indicador",
                      actual: ratioSummary ? ratioSummary.numerator : latestValue || 0,
                      meta: ratioSummary && ratioSummary.metaAllowed !== null ? ratioSummary.metaAllowed : indicator.targetPercent,
                    },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: unknown, name: unknown) => {
                      const num = typeof value === "number" ? value : Number(value);
                      const label = name === "actual" ? "Actual" : name === "meta" ? "Meta" : String(name || "");
                      if (!Number.isFinite(num)) return [String(value), label];
                      return [ratioSummary ? formatQuantity(num) : `${num.toFixed(2)}`, label];
                    }}
                  />
                  <Legend />
                  <Bar dataKey="actual" fill="#D4AF37" name="Actual">
                    <LabelList
                      dataKey="actual"
                      position="top"
                      formatter={(v: unknown) => {
                        const num = typeof v === "number" ? v : Number(v);
                        if (!Number.isFinite(num)) return "";
                        return ratioSummary ? formatQuantity(num) : num.toFixed(1);
                      }}
                    />
                  </Bar>
                  <Bar dataKey="meta" fill="#94a3b8" name="Meta">
                    <LabelList
                      dataKey="meta"
                      position="top"
                      formatter={(v: unknown) => {
                        const num = typeof v === "number" ? v : Number(v);
                        if (!Number.isFinite(num)) return "";
                        return ratioSummary ? formatQuantity(num) : num.toFixed(1);
                      }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
              {latestValue === null ? (
                <div>Sin datos aún. Carga una medición para ver el valor actual y el porcentaje de avance.</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {ratioSummary ? (
                    <>
                      <div>
                        {ratioSummary.numeratorLabel}: <span className="font-semibold text-slate-900">{formatQuantity(ratioSummary.numerator)}</span>
                      </div>
                      <div>
                        {ratioSummary.denominatorLabel}: <span className="font-semibold text-slate-900">{formatQuantity(ratioSummary.denominator)}</span>
                      </div>
                      {ratioSummary.metaAllowed !== null ? (
                        <div>
                          Meta: máximo <span className="font-semibold text-slate-900">{formatQuantity(ratioSummary.metaAllowed)}</span> {ratioSummary.numeratorLabel.toLowerCase()}
                        </div>
                      ) : null}
                      <div className="text-slate-600">
                        Resumen: <span className="font-medium text-slate-900">{formatQuantity(ratioSummary.numerator)} de {formatQuantity(ratioSummary.denominator)}</span> en el período seleccionado.
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        Valor actual: <span className="font-semibold text-slate-900">{latestValue.toFixed(2)}</span> {indicator.unit}
                      </div>
                      <div>
                        Meta: <span className="font-semibold text-slate-900">{indicator.targetPercent.toFixed(2)}</span> {indicator.unit}
                      </div>
                      <div className="text-slate-600">
                        Resumen: <span className="font-medium text-slate-900">{latestValue.toFixed(2)} {indicator.unit}</span> en el período seleccionado.
                      </div>
                    </>
                  )}
                  <div className="text-slate-600 whitespace-pre-wrap break-words">
                    Análisis de resultado: <span className="font-medium text-slate-900">{latest?.resultAnalysis?.trim() ? latest.resultAnalysis : "—"}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-x-hidden">
          <CardHeader className="px-3 sm:px-6">
            <CardTitle className="text-base">Cumplimiento</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  {ratioSummary ? (
                    <Tooltip
                      formatter={(value: unknown, name: unknown) => {
                        const num = typeof value === "number" ? value : Number(value);
                        const label = String(name || "");
                        if (!Number.isFinite(num)) return [String(value), label];
                        return [formatQuantity(num), label];
                      }}
                    />
                  ) : (
                    <Tooltip
                      formatter={(value: unknown, name: unknown) => {
                        const num = typeof value === "number" ? value : Number(value);
                        const label = String(name || "");
                        if (!Number.isFinite(num)) return [String(value), label];
                        return [`${num.toFixed(1)}%`, label];
                      }}
                    />
                  )}
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86} stroke="#ffffff">
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={idx === 0 ? "#D4AF37" : "#e2e8f0"} />
                    ))}
                    <RechartsLabel
                      position="center"
                      content={() => {
                        const text = ratioSummary
                          ? `${formatQuantity(ratioSummary.numerator)}/${formatQuantity(ratioSummary.denominator)}`
                          : complianceNowPct === null
                          ? "—"
                          : complianceLabelPct;
                        return (
                          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill="#0f172a">
                            <tspan fontSize="18" fontWeight="700">
                              {text}
                            </tspan>
                            <tspan x="50%" dy="18" fontSize="11" fill="#64748b">
                              {ratioSummary ? "Resultado" : "Cumplimiento"}
                            </tspan>
                          </text>
                        );
                      }}
                    />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            {latest ? (
              <div className="mt-2 text-sm text-slate-600">
                Periodo: {formatDateInput(latest.periodStart)} → {formatDateInput(latest.periodEnd)}
              </div>
            ) : null}
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
              {!latest ? (
                <div>Sin datos aún. Carga una medición para calcular el cumplimiento.</div>
              ) : (
                <div className="flex flex-col gap-1">
                  {ratioSummary ? (
                    <>
                      <div>
                        Resultado: <span className="font-semibold text-slate-900">{formatQuantity(ratioSummary.numerator)} de {formatQuantity(ratioSummary.denominator)}</span>
                      </div>
                      {ratioSummary.metaAllowed !== null ? (
                        <div className="text-slate-600">
                          Meta: máximo <span className="font-semibold text-slate-900">{formatQuantity(ratioSummary.metaAllowed)}</span> {ratioSummary.numeratorLabel.toLowerCase()}
                        </div>
                      ) : null}
                      {ratioSummary.deltaNumerator !== null ? (
                        <div className="text-slate-600">
                          Cambio vs periodo anterior:{" "}
                          <span className="font-medium text-slate-900">
                            {(ratioSummary.deltaNumerator > 0 ? "+" : "") + formatQuantity(ratioSummary.deltaNumerator)} {ratioSummary.numeratorLabel.toLowerCase()}
                          </span>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <div>
                        Cumples el <span className="font-semibold text-slate-900">{complianceLabelPct}</span> de la meta.
                      </div>
                      <div className="text-slate-600">{deltaLabel}</div>
                      <div className="text-slate-600">
                        Resumen: <span className="font-medium text-slate-900">{latest.computedValue.toFixed(2)} {indicator.unit}</span> en el período seleccionado.
                      </div>
                    </>
                  )}
                  <div className="text-slate-600 whitespace-pre-wrap break-words">
                    Análisis de resultado: <span className="font-medium text-slate-900">{latest.resultAnalysis?.trim() ? latest.resultAnalysis : "—"}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0 overflow-x-hidden">
        <CardHeader className="px-3 sm:px-6">
          <CardTitle className="text-base">Cargar datos por periodo</CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6 space-y-4">
          {!props.initial.canManage ? (
            <div className="text-sm text-muted-foreground">Solo consultores o administradores pueden cargar datos.</div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Periodo inicio</Label>
                  <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="h-11 sm:h-9" />
                </div>
                <div className="space-y-2">
                  <Label>Periodo fin</Label>
                  <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="h-11 sm:h-9" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {variables.map((v) => (
                  <div key={v.key} className="space-y-2">
                    <Label>{v.label}</Label>
                    <Input
                      inputMode="decimal"
                      value={inputs[v.key] || ""}
                      onChange={(e) => setInputs((prev) => ({ ...prev, [v.key]: e.target.value }))}
                      className="h-11 sm:h-9"
                      placeholder="Ingrese un número"
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Análisis de resultado</Label>
                <Textarea
                  value={resultAnalysis}
                  onChange={(e) => setResultAnalysis(e.target.value)}
                  placeholder="Escribe aquí el análisis del resultado…"
                  className="min-h-[96px]"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Previsualización</div>
                {!computedPreview.ok ? (
                  <div className="mt-1 text-sm text-red-600">{previewMessage}</div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {variables.map((v) => (
                      <Badge key={v.key} variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                        {v.label}: {inputs[v.key] || "—"}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <Button
                type="button"
                className="h-11 w-full rounded-2xl bg-[#D4AF37] text-black hover:bg-[#B59530] sm:w-auto"
                disabled={!canSaveMeasurement}
                onClick={saveMeasurement}
              >
                Guardar medición
              </Button>
              {!canSaveMeasurement ? (
                <div className="text-xs text-slate-500">
                  Para guardar: selecciona el periodo y completa todos los campos con números.
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-x-hidden">
        <CardHeader className="px-3 sm:px-6">
          <CardTitle className="text-base">Historial</CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="w-full overflow-x-auto">
            <table className="min-w-[760px] w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="p-2">Inicio</th>
                  <th className="p-2">Fin</th>
                  <th className="p-2">Valor</th>
                  <th className="p-2">Cumplimiento</th>
                </tr>
              </thead>
              <tbody>
                {measurements
                  .slice()
                  .sort((a, b) => (a.periodEnd > b.periodEnd ? -1 : 1))
                  .map((m) => (
                    <tr key={m.id} className="border-t">
                      <td className="p-2">{formatDateInput(m.periodStart)}</td>
                      <td className="p-2">{formatDateInput(m.periodEnd)}</td>
                      <td className="p-2">{m.computedValue.toFixed(4)}</td>
                      <td className="p-2">{m.compliancePct.toFixed(2)}%</td>
                    </tr>
                  ))}
                {measurements.length === 0 ? (
                  <tr>
                    <td className="p-4 text-center text-muted-foreground" colSpan={4}>
                      Sin mediciones aún.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
