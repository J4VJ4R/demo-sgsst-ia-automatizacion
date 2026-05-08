"use client"

import { useRouter, useSearchParams } from "next/navigation";
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { calculatePercentage } from "@/lib/utils"

interface OverviewChartProps {
  data: {
    name: string;
    value: number;
  }[];
  dark?: boolean;
  selectedCompanyId?: string;
}

// Paleta de colores para estado
const STATUS_COLORS = {
  Pendientes: "#f59e0b",   // Ámbar
  "En revisión": "#3b82f6", // Azul
  Aprobadas: "#22c55e",    // Verde
  Rechazadas: "#ef4444",   // Rojo (Añadido)
};

// Paleta de colores para prioridad
const PRIORITY_COLORS = {
  Vencido: "#ef4444",      // Rojo
  "Por vencer": "#f59e0b", // Ámbar
  Cumplido: "#22c55e",     // Verde
};

const getColor = (name: string) => {
  if (name === "Pendientes") return STATUS_COLORS.Pendientes;
  if (name === "En revisión") return STATUS_COLORS["En revisión"];
  if (name === "Aprobadas") return STATUS_COLORS.Aprobadas;
  if (name === "Rechazadas") return STATUS_COLORS.Rechazadas;
  if (name === "Vencido") return PRIORITY_COLORS.Vencido;
  if (name === "Por vencer") return PRIORITY_COLORS["Por vencer"];
  if (name === "Cumplido") return PRIORITY_COLORS.Cumplido;
  return "#94a3b8"; // Default slate-400
};

export function OverviewChart({ data, dark = false, selectedCompanyId }: OverviewChartProps) {
  const total = data.reduce((acc, curr) => acc + curr.value, 0);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePieClick = (entry: any) => {
    // Determine filter type based on entry name
    const name = entry.name;
    let filterType = "";
    let filterValue = "";

    // Map entry names to filter values
    if (name === "Pendientes") { filterType = "status"; filterValue = "PENDING"; }
    else if (name === "En revisión") { filterType = "status"; filterValue = "IN_REVIEW"; }
    else if (name === "Aprobadas") { filterType = "status"; filterValue = "APPROVED"; }
    else if (name === "Rechazadas") { filterType = "status"; filterValue = "REJECTED"; }
    else if (name === "Vencido") { filterType = "priority"; filterValue = "Vencido"; }
    else if (name === "Por vencer") { filterType = "priority"; filterValue = "Por vencer"; }
    else if (name === "Cumplido") { filterType = "priority"; filterValue = "Cumplido"; }

    if (!filterType) return;

    // Get current filters
    const currentParams = new URLSearchParams(searchParams.toString());
    
    // Set the new filter
    currentParams.set(filterType, filterValue);

    if (selectedCompanyId && selectedCompanyId !== "all") {
      currentParams.set("companyId", selectedCompanyId);
    }

    router.push(`/activities?${currentParams.toString()}`);
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={98}
              paddingAngle={5}
              dataKey="value"
              onClick={handlePieClick}
              className="cursor-pointer outline-none"
              label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                if (midAngle === undefined) return null;
                if (percent === undefined) return null;
                const RADIAN = Math.PI / 180;
                const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                const y = cy + radius * Math.sin(-midAngle * RADIAN);
                
                if (percent < 0.02) return null;

                return (
                  <text 
                    x={x} 
                    y={y} 
                    fill="white" 
                    textAnchor="middle" 
                    dominantBaseline="central"
                    className="text-xs font-bold"
                  >
                    {`${(percent * 100).toFixed(0)}%`}
                  </text>
                );
              }}
              labelLine={false}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getColor(entry.name)} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: dark ? "#020617" : "#ffffff",
                borderColor: dark ? "#3f3f46" : "#e5e7eb",
                color: dark ? "#e5e7eb" : "#111827",
                fontSize: 12,
              }}
              itemStyle={{ color: dark ? "#e5e7eb" : "#111827" }}
              formatter={(value: any, name: any, props: any) => {
                const entryName = props.payload.name;
                return [`${Number(value)} (${calculatePercentage(Number(value), total)}%)`, entryName];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
        {data.map((entry) => (
          <button
            key={entry.name}
            type="button"
            className={dark ? "flex items-center gap-2 text-zinc-300" : "flex items-center gap-2 text-slate-700"}
            onClick={() => handlePieClick(entry)}
          >
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: getColor(entry.name) }} />
            <span>{`${entry.name}: ${entry.value}`}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
