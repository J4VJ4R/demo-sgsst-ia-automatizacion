"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
} from "recharts";

interface OverviewBarChartProps {
  data: any[];
  chartMode: "estado" | "prioridad";
  isDark: boolean;
  selectedCompanyId?: string;
  statusCounts: {
    pending: number;
    inReview: number;
    approved: number;
    rejected: number;
  };
  priorityCounts: {
    high: number;
    medium: number;
    low: number;
  };
}

export function OverviewBarChart({
  data,
  chartMode,
  isDark,
  selectedCompanyId,
  statusCounts,
  priorityCounts,
}: OverviewBarChartProps) {
  const axisTickColor = isDark ? "#e5e7eb" : "#4b5563";
  const gridColor = isDark ? "#27272a" : "#e5e7eb";
  const router = useRouter();
  const searchParams = useSearchParams();
  const tooltipStyle = {
    backgroundColor: isDark ? "#020617" : "#ffffff",
    borderColor: isDark ? "#3f3f46" : "#e5e7eb",
    color: isDark ? "#e5e7eb" : "#111827",
    fontSize: 12,
  };

  const CustomBarLabel = (props: any) => {
    const { x, y, width, height, value, index, textColor } = props;

    if (!value) return null;

    const dataEntry = data[index];
    if (!dataEntry) return null;

    let total = 0;
    if (chartMode === "estado") {
      total =
        (dataEntry.pending || 0) +
        (dataEntry.inReview || 0) +
        (dataEntry.approved || 0) +
        (dataEntry.rejected || 0);
    } else {
      total =
        (dataEntry.high || 0) + (dataEntry.medium || 0) + (dataEntry.low || 0);
    }

    if (total === 0) return null;

    const percent = ((value / total) * 100).toFixed(0);

    return (
      <text
        x={x + width / 2}
        y={y + height / 2}
        fill={textColor}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight="bold"
        style={{ pointerEvents: "none" }}
      >
        {percent}%
      </text>
    );
  };

  const handleNavigation = (name: string) => {
    let filterType = "";
    let filterValue = "";

    if (name === "Pendientes") {
      filterType = "status";
      filterValue = "PENDING";
    } else if (name === "En revisión") {
      filterType = "status";
      filterValue = "IN_REVIEW";
    } else if (name === "Aprobadas") {
      filterType = "status";
      filterValue = "APPROVED";
    } else if (name === "Rechazadas") {
      filterType = "status";
      filterValue = "REJECTED";
    } else if (name === "Vencido") {
      filterType = "priority";
      filterValue = "Vencido";
    } else if (name === "Por vencer") {
      filterType = "priority";
      filterValue = "Por vencer";
    } else if (name === "Cumplido") {
      filterType = "priority";
      filterValue = "Cumplido";
    }

    if (!filterType) return;

    const currentParams = new URLSearchParams(searchParams.toString());
    currentParams.set(filterType, filterValue);

    if (selectedCompanyId && selectedCompanyId !== "all") {
      currentParams.set("companyId", selectedCompanyId);
    }

    router.push(`/activities?${currentParams.toString()}`);
  };

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barCategoryGap="10%" barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="name" tick={{ fill: axisTickColor, fontSize: 10 }} />
        <YAxis tick={{ fill: axisTickColor, fontSize: 10 }} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: any, name: any) => {
            const cleanName =
              typeof name === "string" && name.includes(":")
                ? name.split(":")[0].trim()
                : name;
            return [value, cleanName];
          }}
        />
        <Legend
          formatter={(value) => {
            if (value === "Pendientes")
              return `Pendientes: ${statusCounts.pending}`;
            if (value === "En revisión")
              return `En revisión: ${statusCounts.inReview}`;
            if (value === "Aprobadas")
              return `Aprobadas: ${statusCounts.approved}`;
            if (value === "Rechazadas")
              return `Rechazadas: ${statusCounts.rejected}`;
            if (value === "Vencido") return `Vencido: ${priorityCounts.high}`;
            if (value === "Por vencer")
              return `Por vencer: ${priorityCounts.medium}`;
            if (value === "Cumplido") return `Cumplido: ${priorityCounts.low}`;
            return value;
          }}
        />
        {chartMode === "estado" ? (
          <>
            <Bar
              dataKey="pending"
              fill="#f59e0b"
              name="Pendientes"
              onClick={() => handleNavigation("Pendientes")}
              className="cursor-pointer"
            >
              <LabelList
                dataKey="pending"
                content={<CustomBarLabel textColor="#000000" />}
              />
            </Bar>
            <Bar
              dataKey="inReview"
              fill="#0ea5e9"
              name="En revisión"
              onClick={() => handleNavigation("En revisión")}
              className="cursor-pointer"
            >
              <LabelList
                dataKey="inReview"
                content={<CustomBarLabel textColor="#ffffff" />}
              />
            </Bar>
            <Bar
              dataKey="approved"
              fill="#16a34a"
              name="Aprobadas"
              onClick={() => handleNavigation("Aprobadas")}
              className="cursor-pointer"
            >
              <LabelList
                dataKey="approved"
                content={<CustomBarLabel textColor="#ffffff" />}
              />
            </Bar>
            <Bar
              dataKey="rejected"
              fill="#ef4444"
              name="Rechazadas"
              onClick={() => handleNavigation("Rechazadas")}
              className="cursor-pointer"
            >
              <LabelList
                dataKey="rejected"
                content={<CustomBarLabel textColor="#ffffff" />}
              />
            </Bar>
          </>
        ) : (
          <>
            <Bar
              dataKey="high"
              fill="#dc2626"
              name="Vencido"
              onClick={() => handleNavigation("Vencido")}
              className="cursor-pointer"
            >
              <LabelList
                dataKey="high"
                content={<CustomBarLabel textColor="#ffffff" />}
              />
            </Bar>
            <Bar
              dataKey="medium"
              fill="#f59e0b"
              name="Por vencer"
              onClick={() => handleNavigation("Por vencer")}
              className="cursor-pointer"
            >
              <LabelList
                dataKey="medium"
                content={<CustomBarLabel textColor="#000000" />}
              />
            </Bar>
            <Bar
              dataKey="low"
              fill="#16a34a"
              name="Cumplido"
              onClick={() => handleNavigation("Cumplido")}
              className="cursor-pointer"
            >
              <LabelList
                dataKey="low"
                content={<CustomBarLabel textColor="#ffffff" />}
              />
            </Bar>
          </>
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
