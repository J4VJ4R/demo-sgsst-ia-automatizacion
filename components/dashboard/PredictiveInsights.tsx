"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ActivitySummary } from "@/lib/dashboard-logic";
import { computeAiRiskSummary } from "@/lib/aiRiskEngine";

const TRAINING_FLAG_KEY = "sgsst_ai_model_trained";

export function PredictiveInsights(props: { activities: ActivitySummary[]; selectedCompanyId: string }) {
  const [trained, setTrained] = useState(false);

  useEffect(() => {
    try {
      setTrained(window.localStorage.getItem(TRAINING_FLAG_KEY) === "1");
    } catch {
      setTrained(false);
    }
  }, []);

  const sources = useMemo(() => {
    const list = props.activities
      .filter((a) => {
        if (!a.projectId) return false;
        if (props.selectedCompanyId !== "all" && a.projectId !== props.selectedCompanyId) return false;
        return true;
      })
      .map((a) => ({
        activityId: a.id,
        activityTitle: a.title || "",
        projectId: a.projectId,
        projectName: a.projectName,
        department: a.department,
        municipality: a.municipality,
        latestReplyMessage: a.latestReplyMessage ?? null,
      }));
    return list;
  }, [props.activities, props.selectedCompanyId]);

  const summary = useMemo(() => {
    return computeAiRiskSummary(sources, { trained, onlyElectricalInspections: true });
  }, [sources, trained]);

  const chartData = useMemo(() => {
    return summary.zoneProbabilities
      .slice(0, 6)
      .map((z) => ({
        zone: z.zone.replace("Zona ", ""),
        probability: z.probabilityPct,
      }))
      .reverse();
  }, [summary.zoneProbabilities]);

  const hasData = chartData.length > 0;
  const severity =
    summary.riskAccumulatedPct >= 70 ? "CRÍTICO" : summary.riskAccumulatedPct >= 50 ? "ALTO" : "MODERADO";

  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="text-sm font-semibold tracking-[0.18em] text-slate-500 uppercase">
            Insights Predictivos (IA)
          </CardTitle>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className={trained ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-slate-100 text-slate-700 hover:bg-slate-100"}>
              {trained ? "Modelo entrenado" : "Modelo demo"}
            </Badge>
            <Badge className={summary.riskAccumulatedPct >= 70 ? "bg-red-100 text-red-700 hover:bg-red-100" : summary.riskAccumulatedPct >= 50 ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : "bg-sky-100 text-sky-800 hover:bg-sky-100"}>
              Riesgo acumulado: {summary.riskAccumulatedPct}% · {severity}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="text-sm font-semibold text-slate-900">Probabilidad de Accidente Eléctrico por Zona</div>
          <div className="mt-3 h-[260px] rounded-xl border border-slate-200 bg-white p-3">
            {hasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 18, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="zone" width={80} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [`${v}%`, "Probabilidad"]} />
                  <Bar dataKey="probability" fill="#2563eb" radius={[10, 10, 10, 10]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-600">
                Sin inspecciones eléctricas con hallazgos para estimar probabilidades.
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="text-sm font-semibold text-slate-900">Alertas de IA</div>
          <div className="mt-3 grid gap-3">
            {summary.alerts.length > 0
              ? summary.alerts.slice(0, 2).map((a) => (
                <div key={a.id} className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                  <div className="font-semibold">Estado: Crítico</div>
                  <div className="mt-1">{a.message}</div>
                </div>
              ))
              : null}

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="font-semibold">Patrón detectado</div>
              <div className="mt-1">{summary.insightText}</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">Recomendación</div>
              <div className="mt-1">
                Priorizar verificación de distancias de seguridad, controles LOTO y EPP dieléctrico en las zonas con mayor probabilidad.
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
