"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  InteractionItem
} from "chart.js";
import { Pie, Bar, getElementAtEvent } from "react-chartjs-2";
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  ChartDataLabels
);

interface CompanyChartProps {
  type: "pie" | "bar";
  mode?: "status" | "priority"; // Added mode prop
  companyId: string; // Added companyId for navigation
  data: {
    // Status
    pending: number;
    inReview: number;
    approved: number;
    rejected?: number; // Make rejected optional as well to match usage
    // Priority (optional to avoid breaking existing usage if any, but expected from grid)
    high?: number;
    medium?: number;
    low?: number;
  };
  title?: string;
}

export function CompanyChart({ type, mode = "status", companyId, data, title }: CompanyChartProps) {
  const router = useRouter();
  const chartRef = useRef<any>(null);

  const chartData = useMemo(() => {
    if (mode === "priority") {
        return {
            labels: ["Vencido", "Por vencer", "Cumplido"],
            datasets: [
              {
                label: "# de Actividades",
                // Map logical values to chart order
                // high -> Vencido
                // medium -> Por vencer
                // low -> Cumplido
                data: [data.high || 0, data.medium || 0, data.low || 0],
                backgroundColor: [
                  "#ef4444", // Vencido - Red
                  "#f59e0b", // Por vencer - Amber/Orange
                  "#22c55e", // Cumplido - Green
                ],
                borderColor: [
                  "#ef4444",
                  "#f59e0b",
                  "#22c55e",
                ],
                borderWidth: 1,
              },
            ],
          };
    }

    // Default to status mode
    return {
      labels: ["Pendientes", "En Revisión", "Rechazadas", "Aprobadas"],
      datasets: [
        {
          label: "# de Actividades",
          data: [data.pending, data.inReview, data.rejected || 0, data.approved],
          backgroundColor: [
            "#f59e0b", // Pendientes - Amber/Orange
            "#0ea5e9", // En revisión - Sky Blue
            "#ef4444", // Rechazadas - Red
            "#22c55e", // Aprobadas - Green
          ],
          borderColor: [
            "#f59e0b",
            "#0ea5e9",
            "#ef4444",
            "#22c55e",
          ],
          borderWidth: 1,
        },
      ],
    };
  }, [data, mode]);

  const handleChartClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const chart = chartRef.current;
    if (!chart) return;

    const elements = getElementAtEvent(chart, event);
    if (elements.length > 0) {
      const index = elements[0].index;
      let filterType = "";
      let filterValue = "";

      if (mode === "priority") {
        filterType = "priority";
        // labels: ["Vencido", "Por vencer", "Cumplido"]
        if (index === 0) filterValue = "Vencido";
        else if (index === 1) filterValue = "Por vencer";
        else if (index === 2) filterValue = "Cumplido";
      } else {
        filterType = "status";
        // labels: ["Pendientes", "En Revisión", "Rechazadas", "Aprobadas"]
        if (index === 0) filterValue = "PENDING";
        else if (index === 1) filterValue = "IN_REVIEW";
        else if (index === 2) filterValue = "REJECTED";
        else if (index === 3) filterValue = "APPROVED";
      }

      if (filterType && filterValue) {
        const params = new URLSearchParams();
        params.set(filterType, filterValue);
        params.set("companyId", companyId);
        router.push(`/activities?${params.toString()}`);
      }
    }
  };

  const handleHover = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const chart = chartRef.current;
    if (!chart) return;
    
    const elements = getElementAtEvent(chart, event);
    if (elements.length > 0) {
      event.currentTarget.style.cursor = 'pointer';
    } else {
      event.currentTarget.style.cursor = 'default';
    }
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false, // Important for responsive grid
    layout: {
      padding: {
        bottom: 20 // Add padding to prevent legend overlap
      }
    },
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          boxWidth: 12,
          padding: 15,
          font: {
            size: 12
          },
          // Custom generator to append values to legend labels
          generateLabels: (chart: any) => {
            const data = chart.data;
            if (data.labels.length && data.datasets.length) {
              return data.labels.map((label: string, i: number) => {
                const meta = chart.getDatasetMeta(0);
                const style = meta.controller.getStyle(i);
                const value = data.datasets[0].data[i];
                
                return {
                  text: `${label}: ${value}`, // Add value to label
                  fillStyle: style.backgroundColor,
                  strokeStyle: style.borderColor,
                  lineWidth: style.borderWidth,
                  hidden: isNaN(data.datasets[0].data[i]) || meta.data[i].hidden,
                  index: i
                };
              });
            }
            return [];
          }
        }
      },
      title: {
        display: !!title,
        text: title,
        font: {
            size: 14,
            weight: "bold"
        }
      },
      tooltip: {
        callbacks: {
            label: function(context: any) {
                const label = context.label || '';
                const value = context.parsed;
                const total = context.dataset.data.reduce((acc: number, curr: number) => acc + curr, 0);
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                
                // Show label (category) instead of generic text
                // Previously it might have been showing just value or default
                // This logic seems fine: "Pendientes: 5 (20.0%)"
                return `${label}: ${value} (${percentage})`;
            }
        }
      },
      datalabels: {
        display: true,
        color: '#fff',
        font: {
          weight: 'bold' as const,
          size: 14 // Increased from 11 to 14 to match top charts
        },
        formatter: (value: number, ctx: any) => {
          if (value === 0) return ''; // Hide if 0
          if (type === 'bar') return value; // Just value for bars usually looks cleaner, or customize if needed
          
          const total = ctx.dataset.data.reduce((acc: number, curr: number) => acc + curr, 0);
          const percentage = total > 0 ? ((value / total) * 100).toFixed(0) + '%' : '0%';
          
          // Show only percentage
          return percentage;
        },
        textAlign: 'center' as const
      }
    },
    // Hide scales for Pie charts
    scales: type === "bar" ? {
        y: {
            beginAtZero: true,
            ticks: {
                stepSize: 1
            }
        }
    } : {
        x: { display: false },
        y: { display: false }
    }
  };

  return (
    <div className="w-full h-full min-h-[250px] p-2">
      {type === "pie" ? (
        <Pie ref={chartRef} data={chartData} options={options as any} onClick={handleChartClick} onMouseMove={handleHover} />
      ) : (
        <Bar ref={chartRef} data={chartData} options={options as any} onClick={handleChartClick} onMouseMove={handleHover} />
      )}
    </div>
  );
}
