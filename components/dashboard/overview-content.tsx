'use client'

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
  Label as RechartsLabel,
} from "recharts";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Download, Filter, Zap, Activity as ActivityIcon, Sun, Moon, Loader2 } from "lucide-react";
import {
  getFilteredActivities,
  getAvailableConsultants,
  getAvailableProjects,
  type ActivitySummary,
  type ProjectSummary,
} from "@/lib/dashboard-logic";
import { translatePriority } from "@/lib/utils";
import { PredictiveInsights } from "@/components/dashboard/PredictiveInsights";

const OverviewChart = dynamic(() => import("@/components/dashboard/overview-chart").then(mod => mod.OverviewChart), {
  loading: () => <div className="flex h-[350px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>,
  ssr: false
});

const OverviewBarChart = dynamic(() => import("@/components/dashboard/overview-bar-chart").then(mod => mod.OverviewBarChart), {
  loading: () => <div className="flex h-[260px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>,
  ssr: false
});

const CompanyMetricsGrid = dynamic(() => import("./company-metrics-grid").then(mod => mod.CompanyMetricsGrid), {
  loading: () => <div className="flex h-[300px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>,
  ssr: false
});

type DashboardIndicatorItem = {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  description: string | null;
  unit: string;
  targetPercent: number;
  formula: string;
  variables: Array<{ key: string; label: string }>;
  latestMeasurement:
    | null
    | {
        id: string;
        periodStart: string;
        periodEnd: string;
        inputsJson: string;
        computedValue: number;
        compliancePct: number;
        resultAnalysis: string | null;
        createdAt: string;
      };
};

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

interface OverviewContentProps {
  kpiData: {
    totalProjects: number;
    pendingActivities: number;
    inReviewActivities: number;
    approvedActivities: number;
    rejectedActivities: number;
  };
  activities: ActivitySummary[];
  projects: ProjectSummary[];
  initialCompanyId?: string;
  userRole?: string;
  dashboardIndicators?: DashboardIndicatorItem[];
}

type ChartMode = "estado" | "prioridad";
type ChartType = "torta" | "barras";

export function OverviewContent({ kpiData, activities, projects, initialCompanyId = "all", userRole, dashboardIndicators = [] }: OverviewContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(initialCompanyId);
  const [chartMode, setChartMode] = useState<ChartMode>("estado");
  const [chartType, setChartType] = useState<ChartType>("torta");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const isDark = theme === "dark";
  const [selectedConsultantId, setSelectedConsultantId] = useState<string>("all");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedRisk, setSelectedRisk] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<"idle" | "connected" | "simulated">("simulated");
  const touchStartX = useRef<number | null>(null);
  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(max-width: 1023px)").matches;
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileChartsOpen, setMobileChartsOpen] = useState(false);
  const [mobileCompanyOpen, setMobileCompanyOpen] = useState(false);
  const [mobileIndicatorsOpen, setMobileIndicatorsOpen] = useState(false);
  const swipeStartY = useRef<number | null>(null);
  const isClientRole = userRole === "CLIENT" || userRole === "CLIENT_VIEWER";

  const formatDateInput = (iso: string) => {
    if (!iso) return "";
    const datePart = iso.includes("T") ? iso.split("T")[0] : iso;
    return datePart;
  };

  const trafficLight = (target: number, value: number | null) => {
    if (value === null) return { label: "Sin datos", className: "bg-slate-50 text-slate-700 border-slate-200" };
    const pct = target === 0 ? 0 : (value / target) * 100;
    if (pct >= 100) return { label: "En meta", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    if (pct >= 80) return { label: "Cerca", className: "bg-amber-50 text-amber-800 border-amber-200" };
    return { label: "Bajo", className: "bg-red-50 text-red-700 border-red-200" };
  };

  const visibleIndicators = useMemo(() => {
    if (!isClientRole) return [];
    if (selectedCompanyId !== "all") {
      return dashboardIndicators.filter((i) => i.projectId === selectedCompanyId);
    }
    return dashboardIndicators;
  }, [dashboardIndicators, isClientRole, selectedCompanyId]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (!isClientRole && selectedConsultantId !== "all") count += 1;
    if (selectedCompanyId !== "all") count += 1;
    if (!isClientRole) {
      if (selectedDepartment !== "all") count += 1;
      if (selectedRisk !== "all") count += 1;
    }
    if (dateFrom) count += 1;
    if (dateTo) count += 1;
    return count;
  }, [dateFrom, dateTo, isClientRole, selectedCompanyId, selectedConsultantId, selectedDepartment, selectedRisk]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(max-width: 1023px)");
    const apply = () => setIsCompact(media.matches);
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const handleCompanyChange = (value: string) => {
    setSelectedCompanyId(value);

    if (isClientRole) {
      setSelectedConsultantId("all");
      return;
    }
    
    if (value === "all") {
      setSelectedConsultantId("all");
    } else {
      // Auto-select consultant if there is only one associated with this company (Project Owner)
      const availableConsultants = getAvailableConsultants(activities, projects, value);
      if (availableConsultants.length === 1) {
        setSelectedConsultantId(availableConsultants[0].id);
      } else {
        setSelectedConsultantId("all");
      }
    }
  };

  const handleConsultantChange = (value: string) => {
    setSelectedConsultantId(value);
    
    if (value !== "all") {
       const validProjects = getAvailableProjects(activities, projects, value);
       
       // If the consultant only has one project, auto-select it
       if (validProjects.length === 1) {
         setSelectedCompanyId(validProjects[0].id);
       } 
       // If multiple projects, check if current selected company is valid
       else if (selectedCompanyId !== "all") {
         const isValid = validProjects.some(p => p.id === selectedCompanyId);
         if (!isValid) {
           setSelectedCompanyId("all");
         }
       }
    }
  };

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!wsUrl) {
      return;
    }
    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket(wsUrl);
      socket.onopen = () => setRealtimeStatus("connected");
      socket.onclose = () => setRealtimeStatus("simulated");
    } catch {
    }
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!notificationsEnabled) return;
    const critical = activities.filter((a) => {
      const priority = translatePriority(a.priority);
      return priority === "Vencido" && (a.status === "PENDING" || a.status === "IN_REVIEW");
    }).length;
    if (critical === 0) return;
    toast.error(`Hay ${critical} actividades críticas en espera.`);
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification("Alertas críticas SST", {
          body: `Hay ${critical} actividades críticas pendientes.`,
        });
      } else if (Notification.permission === "default") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            new Notification("Alertas críticas SST", {
              body: `Hay ${critical} actividades críticas pendientes.`,
            });
          }
        });
      }
    }
  }, [activities, notificationsEnabled]);

  const filteredActivities = useMemo(() => {
    return getFilteredActivities(activities, {
      companyId: selectedCompanyId,
      consultantId: selectedConsultantId,
      department: selectedDepartment,
      risk: selectedRisk,
      dateFrom,
      dateTo,
    });
  }, [activities, selectedCompanyId, selectedConsultantId, selectedDepartment, selectedRisk, dateFrom, dateTo]);

  const statusCounts = useMemo(() => {
    let pending = 0;
    let inReview = 0;
    let approved = 0;
    let rejected = 0;
    filteredActivities.forEach((activity) => {
      if (activity.status === "PENDING") pending += 1;
      else if (activity.status === "IN_REVIEW") inReview += 1;
      else if (activity.status === "APPROVED") approved += 1;
      else if (activity.status === "REJECTED") rejected += 1;
    });
    return {
      pending,
      inReview,
      approved,
      rejected,
    };
  }, [filteredActivities]);

  const priorityCounts = useMemo(() => {
    let high = 0;
    let medium = 0;
    let low = 0;
    filteredActivities.forEach((activity) => {
      const label = translatePriority(activity.priority);
      if (label === "Vencido") high += 1;
      else if (label === "Por vencer") medium += 1;
      else low += 1;
    });
    return { high, medium, low };
  }, [filteredActivities]);

  const consultants = useMemo(() => {
    return getAvailableConsultants(activities, projects, selectedCompanyId);
  }, [activities, projects, selectedCompanyId]);

  // Filter companies for "Métricas por Empresa" section
  const filteredProjects = useMemo(() => {
    // If a specific company is selected in the dropdown, return only that one
    if (selectedCompanyId && selectedCompanyId !== "all") {
      const project = projects.find(p => p.id === selectedCompanyId);
      return project ? [project] : [];
    }
    
    // Otherwise, return all projects available to the user
    // The 'projects' prop already comes filtered by user role from the server page
    return projects;
  }, [projects, selectedCompanyId]);

  // Data for "Métricas por Empresa" section
  const companyMetrics = useMemo(() => {
    return filteredProjects.map(project => {
      const projectActivities = activities.filter(a => a.projectId === project.id);
      
      // Apply filters to project activities
      // Ensures metrics reflect the current filter selection
      const projectFilteredActivities = projectActivities.filter(activity => {
        // Date range filter
        if (dateFrom && dateTo) {
          const activityDate = new Date(activity.dueDate || activity.updatedAt);
          const from = new Date(dateFrom);
          const to = new Date(dateTo);
          // Adjust to to end of day
          to.setHours(23, 59, 59, 999);
          
          if (activityDate < from || activityDate > to) return false;
        }

        // Consultant filter
        if (selectedConsultantId && selectedConsultantId !== "all") {
          const consultantId = activity.assignedToId || activity.consultantId;
          if (consultantId !== selectedConsultantId) return false;
        }

        // Department filter
        if (selectedDepartment && selectedDepartment !== "all") {
           // This assumes activities inherit project department, or we filter projects first
           // But here we are filtering activities. 
           // If department is a property of Project, we should check project.department
           if (project.department !== selectedDepartment) return false;
        }

        // Risk filter (Priority)
        if (selectedRisk && selectedRisk !== "all") {
          const priority = translatePriority(activity.priority);
          // Map risk levels to priority
          // "Alto" -> "Vencido" (High)
          // "Medio" -> "Por vencer" (Medium)
          // "Bajo" -> "Cumplido" (Low)
          let targetPriority = "";
          if (selectedRisk === "Alto") targetPriority = "Vencido";
          else if (selectedRisk === "Medio") targetPriority = "Por vencer";
          else if (selectedRisk === "Bajo") targetPriority = "Cumplido";
          
          if (priority !== targetPriority) return false;
        }

        return true;
      });

      let pending = 0;
      let inReview = 0;
      let approved = 0;
      let rejected = 0;
      let high = 0;
      let medium = 0;
      let low = 0;

      projectFilteredActivities.forEach(activity => {
        if (activity.status === "PENDING") pending++;
        else if (activity.status === "IN_REVIEW") inReview++;
        else if (activity.status === "APPROVED") approved++;
        else if (activity.status === "REJECTED") rejected++;

        const priority = translatePriority(activity.priority);
        if (priority === "Vencido") high++;
        else if (priority === "Por vencer") medium++;
        else low++;
      });

      const total = pending + inReview + approved + rejected;

      // Only return if there is activity data or we want to show empty companies too
      // Let's show companies if they match the project filters, even if 0 activities match the activity filters
      // BUT if we are filtering by consultant/risk/date, maybe we only want companies with matching activities?
      // For now, return metrics structure
      return {
        id: project.id,
        name: project.name,
        totalActivities: total,
        pendingActivities: pending,
        inReviewActivities: inReview,
        approvedActivities: approved,
        rejectedActivities: rejected,
        highPriority: high,
        mediumPriority: medium,
        lowPriority: low,
        completionRate: total > 0 ? (approved / total) * 100 : 0
      };
    }).filter(metric => {
      // Optional: Filter out companies with 0 matching activities if filters are applied
      // if (selectedConsultantId || selectedRisk || (dateFrom && dateTo)) {
      //   return metric.totalActivities > 0;
      // }
      return true;
    });
  }, [filteredProjects, activities, dateFrom, dateTo, selectedConsultantId, selectedDepartment, selectedRisk]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    activities.forEach((activity) => {
      if (activity.department) set.add(activity.department);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [activities]);

  const risks = useMemo(() => {
    const set = new Set<string>();
    activities.forEach((activity) => {
      if (activity.riskLevel) set.add(activity.riskLevel);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [activities]);

  const statusChartData = useMemo(
    () => [
      { name: "Pendientes", value: statusCounts.pending },
      { name: "En revisión", value: statusCounts.inReview },
      { name: "Aprobadas", value: statusCounts.approved },
      { name: "Rechazadas", value: statusCounts.rejected },
    ],
    [statusCounts]
  );

  const priorityChartData = useMemo(
    () => [
      { name: "Vencido", value: priorityCounts.high },
      { name: "Por vencer", value: priorityCounts.medium },
      { name: "Cumplido", value: priorityCounts.low },
    ],
    [priorityCounts]
  );

  const consultantChartData = useMemo(() => {
      const map = new Map<
        string,
        {
          name: string;
          pending: number;
          inReview: number;
          approved: number;
          rejected: number;
          high: number; // Vencido
          medium: number; // Por vencer
          low: number; // Cumplido
        }
      >();
      filteredActivities.forEach((activity) => {
        const key =
          (activity.assignedToId && activity.assignedToRole === "CONSULTANT"
            ? activity.assignedToId
            : activity.consultantId) || "sin-consultor";
        const name =
          (activity.assignedToId && activity.assignedToRole === "CONSULTANT"
            ? activity.assignedToName
            : activity.consultantName) || "Sin consultor asignado";
        
        let existing = map.get(key);
        if (!existing) {
          existing = {
            name,
            pending: 0,
            inReview: 0,
            approved: 0,
            rejected: 0,
            high: 0,
            medium: 0,
            low: 0,
          };
          map.set(key, existing);
        }

        if (activity.status === "PENDING") existing.pending += 1;
        else if (activity.status === "IN_REVIEW") existing.inReview += 1;
        else if (activity.status === "APPROVED") existing.approved += 1;
        else if (activity.status === "REJECTED") existing.rejected += 1;
        
        const priority = translatePriority(activity.priority);
        if (priority === "Vencido") existing.high += 1;
        else if (priority === "Por vencer") existing.medium += 1;
        else existing.low += 1;
      });
    const data = Array.from(map.values());
    data.sort((a, b) => {
      const aScore = a.pending + a.inReview + a.high * 2;
      const bScore = b.pending + b.inReview + b.high * 2;
      return bScore - aScore;
    });
    return data.slice(0, 8);
  }, [filteredActivities]);

  const mainChartData =
    chartMode === "estado" ? statusChartData : priorityChartData;

  const axisTickColor = isDark ? "#e5e7eb" : "#4b5563";
  const gridColor = isDark ? "#27272a" : "#e5e7eb";
  const tooltipStyle = {
    backgroundColor: isDark ? "#020617" : "#ffffff",
    borderColor: isDark ? "#3f3f46" : "#e5e7eb",
    color: isDark ? "#e5e7eb" : "#111827",
    fontSize: 12,
  };

  const handleExportExcel = () => {
    const headers = isClientRole
      ? ["Empresa", "Estado", "Prioridad", "Nivel de riesgo", "Departamento", "Municipio", "Última actualización"]
      : ["Empresa", "Consultor", "Estado", "Prioridad", "Nivel de riesgo", "Departamento", "Municipio", "Última actualización"];
    const rows = filteredActivities.map((activity) =>
      isClientRole
        ? [
            activity.projectName,
            activity.status,
            translatePriority(activity.priority),
            activity.riskLevel || "",
            activity.department || "",
            activity.municipality || "",
            activity.updatedAt,
          ]
        : [
            activity.projectName,
            activity.consultantName || activity.assignedToName || "",
            activity.status,
            translatePriority(activity.priority),
            activity.riskLevel || "",
            activity.department || "",
            activity.municipality || "",
            activity.updatedAt,
          ]
    );
    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => {
            const text = String(value ?? "");
            if (text.includes(";") || text.includes("\"") || text.includes("\n")) {
              return `"${text.replace(/"/g, '""')}"`;
            }
            return text;
          })
          .join(";")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", isClientRole ? "panel-sst-empresa.csv" : "panel-sst-consultores.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Exportación Excel/CSV generada.");
  };

  const handleExportPdf = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const consultantHeader = isClientRole ? "" : "<th>Consultor</th>";
    const rows = filteredActivities
      .map(
        (activity) =>
          `<tr>
            <td>${activity.projectName}</td>
            ${isClientRole ? "" : `<td>${activity.consultantName || activity.assignedToName || ""}</td>`}
            <td>${activity.status}</td>
            <td>${translatePriority(activity.priority)}</td>
            <td>${activity.riskLevel || ""}</td>
            <td>${activity.department || ""}</td>
            <td>${activity.municipality || ""}</td>
            <td>${activity.updatedAt}</td>
          </tr>`
      )
      .join("");
    win.document.write(`
      <html>
        <head>
          <title>Reporte Panel SST</title>
          <style>
            body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 24px; }
            h1 { font-size: 20px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #e5e7eb; padding: 4px 8px; text-align: left; }
            th { background: #111827; color: #f9fafb; }
          </style>
        </head>
        <body>
          <h1>Reporte Panel de Control SST</h1>
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                ${consultantHeader}
                <th>Estado</th>
                <th>Prioridad</th>
                <th>Riesgo</th>
                <th>Departamento</th>
                <th>Municipio</th>
                <th>Última actualización</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0].clientX;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current == null) return;
    const deltaX = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(deltaX) < 40) return;
    if (deltaX > 0) {
      setChartType((prev) => (prev === "torta" ? "barras" : "torta"));
    } else {
      setChartMode((prev) => (prev === "estado" ? "prioridad" : "estado"));
    }
  };

  const kpiCritical = priorityCounts.high;
  const kpiTotalFiltered = filteredActivities.length;

  const buildActivitiesUrl = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", status);
    if (selectedCompanyId && selectedCompanyId !== "all") {
      params.set("companyId", selectedCompanyId);
    } else {
      params.delete("companyId");
    }
    params.delete("priority");
    return `/activities?${params.toString()}`;
  };

  const mobileFiltersBadges = [
    selectedCompanyId !== "all"
      ? `Empresa: ${
          projects.find((p) => p.id === selectedCompanyId)?.name || "Seleccionada"
        }`
      : null,
    !isClientRole && selectedConsultantId !== "all"
      ? `Consultor: ${
          consultants.find((c) => c.id === selectedConsultantId)?.name || "Seleccionado"
        }`
      : null,
    !isClientRole && selectedDepartment !== "all" ? `Departamento: ${selectedDepartment}` : null,
    !isClientRole && selectedRisk !== "all" ? `Riesgo: ${selectedRisk}` : null,
    dateFrom && dateTo ? `Fechas: ${dateFrom} a ${dateTo}` : null,
  ].filter(Boolean) as string[];

  const handleMobileSheetPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    swipeStartY.current = e.clientY;
  };
  const handleMobileSheetPointerMove = (e: React.PointerEvent) => {
    if (swipeStartY.current === null) return;
    const dy = e.clientY - swipeStartY.current;
    if (dy > 70) {
      swipeStartY.current = null;
      setFiltersOpen(false);
    }
  };
  const handleMobileSheetPointerUp = () => {
    swipeStartY.current = null;
  };

  if (isCompact) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-lg font-bold text-slate-950">
              Resumen rápido
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-2xl border-accent/60 bg-white px-4 text-base text-slate-900 shadow-sm hover:border-accent"
            onClick={() => setFiltersOpen(true)}
          >
            <Filter className="mr-2 h-4 w-4 text-accent" />
            Filtros
            {mobileFiltersBadges.length > 0 && (
              <span className="ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-2 text-sm font-semibold text-accent-foreground">
                {mobileFiltersBadges.length}
              </span>
            )}
          </Button>
        </div>

        {mobileFiltersBadges.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {mobileFiltersBadges.slice(0, 3).map((b) => (
              <span
                key={b}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700"
              >
                {b}
              </span>
            ))}
            {mobileFiltersBadges.length > 3 && (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700">
                +{mobileFiltersBadges.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm"
            onClick={() => router.push("/projects")}
          >
            <div className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
              Empresas
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="text-3xl font-bold text-slate-900">
                {kpiData.totalProjects}
              </div>
              <span className="text-sm text-slate-500">activas</span>
            </div>
          </button>

          <button
            type="button"
            className="rounded-2xl border border-accent/40 bg-white p-4 text-left shadow-sm"
            onClick={() => router.push(buildActivitiesUrl("PENDING"))}
          >
            <div className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
              Pendientes
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="text-3xl font-bold text-accent-foreground">
                {kpiData.pendingActivities}
              </div>
              <span className="text-sm text-slate-500">en cola</span>
            </div>
          </button>

          <button
            type="button"
            className="rounded-2xl border border-sky-200 bg-white p-4 text-left shadow-sm"
            onClick={() => router.push(buildActivitiesUrl("IN_REVIEW"))}
          >
            <div className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
              En revisión
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="text-3xl font-bold text-sky-600">
                {kpiData.inReviewActivities}
              </div>
              <span className="text-sm text-slate-500">en análisis</span>
            </div>
          </button>

          <button
            type="button"
            className="rounded-2xl border border-emerald-200 bg-white p-4 text-left shadow-sm"
            onClick={() => router.push(buildActivitiesUrl("APPROVED"))}
          >
            <div className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
              Aprobadas
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="text-3xl font-bold text-emerald-600">
                {kpiData.approvedActivities}
              </div>
              <span className="text-sm text-slate-500">cerradas</span>
            </div>
          </button>
        </div>

        <button
          type="button"
          className="w-full rounded-2xl border border-red-200 bg-white p-4 text-left shadow-sm"
          onClick={() => router.push(buildActivitiesUrl("REJECTED"))}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
              Rechazadas
            </div>
            <span className="inline-flex h-2 w-2 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <div className="text-3xl font-bold text-red-600">
              {kpiData.rejectedActivities}
            </div>
            <span className="text-sm text-slate-500">total de rechazos</span>
          </div>
          <div className="mt-2 text-sm text-slate-600">
            Toque para ver y responder devoluciones.
          </div>
        </button>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-950">
              Indicadores tácticos
            </div>
            <span className="text-xs text-slate-500">
              Filtradas: {kpiTotalFiltered}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="text-xs tracking-[0.18em] text-slate-500 uppercase">
                Críticas
              </div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {kpiCritical}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="text-xs tracking-[0.18em] text-slate-500 uppercase">
                En revisión
              </div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {statusCounts.inReview}
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <Button
              type="button"
              className="h-11 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
              onClick={handleExportExcel}
            >
              Exportar Excel/CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl text-base"
              onClick={handleExportPdf}
            >
              Exportar PDF
            </Button>
          </div>
        </div>

        <PredictiveInsights activities={filteredActivities} selectedCompanyId={selectedCompanyId} />

        <div className="space-y-3">
          <button
            type="button"
            className="flex h-11 w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 shadow-sm"
            aria-expanded={mobileChartsOpen}
            onClick={() => setMobileChartsOpen((v) => !v)}
          >
            <span>Gráficas</span>
            <span className="text-sm text-slate-500">
              {mobileChartsOpen ? "Cerrar" : "Abrir"}
            </span>
          </button>

          <div
            className={[
              "grid overflow-hidden transition-all",
              mobileChartsOpen
                ? "grid-rows-[1fr] opacity-100 duration-[360ms]"
                : "grid-rows-[0fr] opacity-0 duration-[300ms]",
            ].join(" ")}
          >
            <div className="overflow-hidden">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={chartMode === "estado" ? "default" : "outline"}
                    className={
                      chartMode === "estado"
                        ? "h-11 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground hover:bg-primary/90"
                        : "h-11 rounded-xl px-4 text-base font-semibold"
                    }
                    onClick={() => setChartMode("estado")}
                  >
                    Estados
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={chartMode === "prioridad" ? "default" : "outline"}
                    className={
                      chartMode === "prioridad"
                        ? "h-11 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground hover:bg-primary/90"
                        : "h-11 rounded-xl px-4 text-base font-semibold"
                    }
                    onClick={() => setChartMode("prioridad")}
                  >
                    Prioridad
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={chartType === "torta" ? "default" : "outline"}
                    className={
                      chartType === "torta"
                        ? "h-11 rounded-xl bg-slate-900 px-4 text-base font-semibold text-white hover:bg-slate-800"
                        : "h-11 rounded-xl px-4 text-base font-semibold"
                    }
                    onClick={() => setChartType("torta")}
                  >
                    Torta
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={chartType === "barras" ? "default" : "outline"}
                    className={
                      chartType === "barras"
                        ? "h-11 rounded-xl bg-slate-900 px-4 text-base font-semibold text-white hover:bg-slate-800"
                        : "h-11 rounded-xl px-4 text-base font-semibold"
                    }
                    onClick={() => setChartType("barras")}
                  >
                    Barras
                  </Button>
                </div>

                <div className="mt-4">
                  <div className="h-[300px]">
                    {chartType === "torta" ? (
                      <OverviewChart data={mainChartData} dark={false} selectedCompanyId={selectedCompanyId} />
                    ) : (
                      <OverviewBarChart
                        data={consultantChartData}
                        chartMode={chartMode}
                        isDark={false}
                        selectedCompanyId={selectedCompanyId}
                        statusCounts={statusCounts}
                        priorityCounts={priorityCounts}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="flex h-11 w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 shadow-sm"
            aria-expanded={mobileCompanyOpen}
            onClick={() => setMobileCompanyOpen((v) => !v)}
          >
            <span>Métricas por empresa</span>
            <span className="text-sm text-slate-500">
              {mobileCompanyOpen ? "Cerrar" : "Abrir"}
            </span>
          </button>
          <div
            className={[
              "grid overflow-hidden transition-all",
              mobileCompanyOpen
                ? "grid-rows-[1fr] opacity-100 duration-[360ms]"
                : "grid-rows-[0fr] opacity-0 duration-[300ms]",
            ].join(" ")}
          >
            <div className="overflow-hidden">
              <CompanyMetricsGrid userRole={userRole || "CLIENT_VIEWER"} />
            </div>
          </div>

          {isClientRole ? (
            <>
              <button
                type="button"
                className="flex h-11 w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 shadow-sm"
                aria-expanded={mobileIndicatorsOpen}
                onClick={() => setMobileIndicatorsOpen((v) => !v)}
              >
                <span>Indicadores</span>
                <span className="text-sm text-slate-500">
                  {mobileIndicatorsOpen ? "Cerrar" : "Abrir"}
                </span>
              </button>
              <div
                className={[
                  "grid overflow-hidden transition-all",
                  mobileIndicatorsOpen
                    ? "grid-rows-[1fr] opacity-100 duration-[360ms]"
                    : "grid-rows-[0fr] opacity-0 duration-[300ms]",
                ].join(" ")}
              >
                <div className="overflow-hidden">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    {visibleIndicators.length === 0 ? (
                      <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-muted-foreground">
                        No hay indicadores creados para la empresa seleccionada.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {visibleIndicators.map((indicator) => {
                          const latest = indicator.latestMeasurement;
                          const latestValue = latest ? latest.computedValue : null;
                          const light = trafficLight(indicator.targetPercent, latestValue);
                          const ratio = detectRatioFormula(indicator.formula);
                          let numerator: number | null = null;
                          let denominator: number | null = null;
                          let numeratorLabel = ratio ? ratio.numeratorKey : "";
                          let denominatorLabel = ratio ? ratio.denominatorKey : "";
                          if (ratio && latest?.inputsJson) {
                            try {
                              const parsed = JSON.parse(latest.inputsJson);
                              const obj = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
                              const num = Number(obj[ratio.numeratorKey]);
                              const den = Number(obj[ratio.denominatorKey]);
                              numerator = Number.isFinite(num) ? num : null;
                              denominator = Number.isFinite(den) ? den : null;
                              numeratorLabel = indicator.variables.find((v) => v.key === ratio.numeratorKey)?.label || numeratorLabel;
                              denominatorLabel = indicator.variables.find((v) => v.key === ratio.denominatorKey)?.label || denominatorLabel;
                            } catch {
                              numerator = null;
                              denominator = null;
                            }
                          }

                          const pct =
                            latestValue === null || indicator.targetPercent === 0
                              ? 0
                              : Math.min(100, Math.max(0, (latestValue / indicator.targetPercent) * 100));

                          const pieData = (() => {
                            if (!latest) return [];
                            if (ratio && numerator !== null && denominator !== null && denominator > 0) {
                              const part = Math.max(0, Math.min(denominator, numerator));
                              const rest = Math.max(0, denominator - part);
                              return [
                                { name: numeratorLabel, value: part },
                                { name: "Resto del total", value: rest },
                              ];
                            }
                            if (latestValue === null) return [];
                            return [
                              { name: "Cumplimiento", value: pct },
                              { name: "Pendiente", value: Math.max(0, 100 - pct) },
                            ];
                          })();

                          const complianceNowPct = latest ? (Number.isFinite(latest.compliancePct) ? Math.max(0, latest.compliancePct) : null) : null;
                          const complianceLabelPct = complianceNowPct === null ? "—" : complianceNowPct >= 1000 ? `${Math.round(complianceNowPct)}%` : `${complianceNowPct.toFixed(1)}%`;
                          const metaAllowed =
                            ratio && numerator !== null && denominator !== null && Number.isFinite(denominator)
                              ? (denominator * indicator.targetPercent) / 100
                              : null;
                          const barData = [
                            {
                              name: "Indicador",
                              actual: ratio && numerator !== null ? numerator : latestValue || 0,
                              meta: ratio && metaAllowed !== null ? metaAllowed : indicator.targetPercent,
                            },
                          ];

                          return (
                            <Card key={indicator.id} className="rounded-2xl border-slate-200 bg-white shadow-sm">
                              <CardContent className="p-4 space-y-4">
                                <div className="space-y-2">
                                  <div className="break-words text-base font-semibold text-slate-950">
                                    {indicator.name}
                                  </div>
                                  {indicator.description ? (
                                    <div className="break-words text-sm text-slate-600">
                                      {indicator.description}
                                    </div>
                                  ) : null}
                                  <div className="flex flex-wrap gap-2">
                                    <div className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${light.className}`}>
                                      {light.label}
                                    </div>
                                    <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                                      {ratio && metaAllowed !== null
                                        ? `Meta: máx ${formatQuantity(metaAllowed)} ${numeratorLabel.toLowerCase()}`
                                        : `Meta: ${indicator.targetPercent}%`}
                                    </div>
                                    {selectedCompanyId === "all" ? (
                                      <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                                        Empresa: {indicator.projectName}
                                      </div>
                                    ) : null}
                                  </div>
                                </div>

                                <Button
                                  type="button"
                                  className="h-11 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                                  onClick={() => router.push(`/projects/${indicator.projectId}/minimum-indicators/${indicator.id}`)}
                                >
                                  Ver detalle
                                </Button>

                                <div className="space-y-4">
                                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                                    <div className="mb-2 text-sm font-semibold text-slate-950">Actual vs Meta</div>
                                    <div className="h-56">
                                      <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={barData}>
                                          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#27272a" : "#e5e7eb"} />
                                          <XAxis dataKey="name" tick={{ fill: isDark ? "#e5e7eb" : "#4b5563", fontSize: 10 }} />
                                          <YAxis tick={{ fill: isDark ? "#e5e7eb" : "#4b5563", fontSize: 10 }} />
                                          <Tooltip
                                            contentStyle={{
                                              backgroundColor: isDark ? "#020617" : "#ffffff",
                                              borderColor: isDark ? "#3f3f46" : "#e5e7eb",
                                              color: isDark ? "#e5e7eb" : "#111827",
                                              fontSize: 12,
                                            }}
                                            formatter={(value: unknown, name: unknown) => {
                                              const num = typeof value === "number" ? value : Number(value);
                                              const label = name === "actual" ? "Actual" : name === "meta" ? "Meta" : String(name || "");
                                              if (!Number.isFinite(num)) return [String(value), label];
                                              return [ratio ? formatQuantity(num) : num.toFixed(2), label];
                                            }}
                                          />
                                          <Legend />
                                          <Bar dataKey="actual" fill="var(--chart-2)" name="Actual">
                                            <LabelList
                                              dataKey="actual"
                                              position="top"
                                              formatter={(v: unknown) => {
                                                const num = typeof v === "number" ? v : Number(v);
                                                if (!Number.isFinite(num)) return "";
                                                return ratio ? formatQuantity(num) : num.toFixed(1);
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
                                                return ratio ? formatQuantity(num) : num.toFixed(1);
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
                                          {ratio && numerator !== null && denominator !== null ? (
                                            <>
                                              <div>
                                                {numeratorLabel}: <span className="font-semibold text-slate-900">{formatQuantity(numerator)}</span>
                                              </div>
                                              <div>
                                                {denominatorLabel}: <span className="font-semibold text-slate-900">{formatQuantity(denominator)}</span>
                                              </div>
                                              {metaAllowed !== null ? (
                                                <div>
                                                  Meta: máximo <span className="font-semibold text-slate-900">{formatQuantity(metaAllowed)}</span>{" "}
                                                  {numeratorLabel.toLowerCase()}
                                                </div>
                                              ) : null}
                                              <div className="text-slate-600">
                                                Resumen: <span className="font-medium text-slate-900">{formatQuantity(numerator)} de {formatQuantity(denominator)}</span>{" "}
                                                en el período seleccionado.
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
                                          {latest?.resultAnalysis?.trim() ? (
                                            <div className="text-slate-600 whitespace-pre-wrap break-words">
                                              Análisis de resultado: <span className="font-medium text-slate-900">{latest.resultAnalysis}</span>
                                            </div>
                                          ) : null}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                                    <div className="mb-2 text-sm font-semibold text-slate-950">{ratio ? "Resultado" : "Cumplimiento"}</div>
                                    <div className="h-56">
                                      <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                          <Tooltip
                                            contentStyle={{
                                              backgroundColor: isDark ? "#020617" : "#ffffff",
                                              borderColor: isDark ? "#3f3f46" : "#e5e7eb",
                                              color: isDark ? "#e5e7eb" : "#111827",
                                              fontSize: 12,
                                            }}
                                            formatter={(value: unknown, name: unknown) => {
                                              const num = typeof value === "number" ? value : Number(value);
                                              const label = String(name || "");
                                              if (!Number.isFinite(num)) return [String(value), label];
                                              return ratio ? [formatQuantity(num), label] : [`${num.toFixed(1)}%`, label];
                                            }}
                                          />
                                          <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86} stroke="#ffffff">
                                            {pieData.map((_, idx) => (
                                              <Cell key={idx} fill={idx === 0 ? "var(--chart-2)" : "#e2e8f0"} />
                                            ))}
                                            <RechartsLabel
                                              position="center"
                                              content={() => {
                                                const text =
                                                  ratio && numerator !== null && denominator !== null
                                                    ? `${formatQuantity(numerator)}/${formatQuantity(denominator)}`
                                                    : complianceNowPct === null
                                                    ? "—"
                                                    : complianceLabelPct;
                                                return (
                                                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill={isDark ? "#e5e7eb" : "#0f172a"}>
                                                    <tspan fontSize="18" fontWeight="700">
                                                      {text}
                                                    </tspan>
                                                    <tspan x="50%" dy="18" fontSize="11" fill={isDark ? "#a1a1aa" : "#64748b"}>
                                                      {ratio ? "Resultado" : "Cumplimiento"}
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
                                          {ratio && numerator !== null && denominator !== null ? (
                                            <>
                                              <div>
                                                Resultado: <span className="font-semibold text-slate-900">{formatQuantity(numerator)} de {formatQuantity(denominator)}</span>
                                              </div>
                                              {metaAllowed !== null ? (
                                                <div className="text-slate-600">
                                                  Meta: máximo <span className="font-semibold text-slate-900">{formatQuantity(metaAllowed)}</span>{" "}
                                                  {numeratorLabel.toLowerCase()}
                                                </div>
                                              ) : null}
                                            </>
                                          ) : (
                                            <>
                                              <div>
                                                Cumples el <span className="font-semibold text-slate-900">{complianceLabelPct}</span> de la meta.
                                              </div>
                                              <div className="text-slate-600">
                                                Resumen: <span className="font-medium text-slate-900">{latest.computedValue.toFixed(2)} {indicator.unit}</span> en el período seleccionado.
                                              </div>
                                            </>
                                          )}
                                          {latest?.resultAnalysis?.trim() ? (
                                            <div className="text-slate-600 whitespace-pre-wrap break-words">
                                              Análisis de resultado: <span className="font-medium text-slate-900">{latest.resultAnalysis}</span>
                                            </div>
                                          ) : null}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetContent
            side="bottom"
            className="h-[85vh] rounded-t-3xl border-t border-accent/25 p-0 data-[state=open]:duration-[380ms] data-[state=closed]:duration-[320ms]"
            onPointerDown={handleMobileSheetPointerDown}
            onPointerMove={handleMobileSheetPointerMove}
            onPointerUp={handleMobileSheetPointerUp}
          >
            <SheetHeader className="border-b border-slate-200">
              <SheetTitle className="text-base font-semibold text-slate-950">
                Filtros del dashboard
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-900">
                    Empresa
                  </div>
                  <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
                    <SelectTrigger className="h-11 rounded-xl border-accent/40 bg-white text-base">
                      <SelectValue placeholder="Seleccionar empresa" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="all">Todas las empresas</SelectItem>
                      {filteredProjects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!isClientRole ? (
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-slate-900">
                      Consultor
                    </div>
                    <Select value={selectedConsultantId} onValueChange={handleConsultantChange}>
                      <SelectTrigger className="h-11 rounded-xl border-accent/40 bg-white text-base">
                        <SelectValue placeholder="Consultor" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="all">Todos los consultores</SelectItem>
                        {consultants.map((consultant) => (
                          <SelectItem key={consultant.id} value={consultant.id}>
                            {consultant.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {!isClientRole && (
                  <>
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-slate-900">
                        Departamento
                      </div>
                      <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                        <SelectTrigger className="h-11 rounded-xl border-accent/40 bg-white text-base">
                          <SelectValue placeholder="Departamento" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          <SelectItem value="all">Todos los departamentos</SelectItem>
                          {departments.map((department) => (
                            <SelectItem key={department} value={department}>
                              {department}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-slate-900">
                        Nivel de riesgo
                      </div>
                      <Select value={selectedRisk} onValueChange={setSelectedRisk}>
                        <SelectTrigger className="h-11 rounded-xl border-accent/40 bg-white text-base">
                          <SelectValue placeholder="Nivel de riesgo" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          <SelectItem value="all">Todos los riesgos</SelectItem>
                          {risks.map((risk) => (
                            <SelectItem key={risk} value={risk}>
                              {risk}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <div className="text-sm font-semibold text-slate-900">
                    Rango de fechas
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(event) => setDateFrom(event.target.value)}
                      className="h-11 rounded-xl border-slate-200 bg-white text-base"
                    />
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(event) => setDateTo(event.target.value)}
                      className="h-11 rounded-xl border-slate-200 bg-white text-base"
                    />
                  </div>
                </div>
              </div>
            </div>

            <SheetFooter className="border-t border-slate-200 bg-white">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 flex-1 rounded-xl text-base"
                  onClick={() => {
                    setSelectedCompanyId("all");
                    setSelectedConsultantId("all");
                    setSelectedDepartment("all");
                    setSelectedRisk("all");
                    setDateFrom("");
                    setDateTo("");
                  }}
                >
                  Limpiar
                </Button>
                <Button
                  type="button"
                  className="h-11 flex-1 rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
                  onClick={() => setFiltersOpen(false)}
                >
                  Aplicar
                </Button>
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className={isDark ? "bg-zinc-950 border-zinc-800 shadow-[0_0_24px_rgba(0,0,0,0.6)]" : "bg-white border-slate-200 shadow-sm"}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={isDark ? "text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase" : "text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase"}>
              Total Empresas
            </CardTitle>
            <ActivityIcon className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className={isDark ? "text-3xl font-bold text-zinc-50" : "text-3xl font-bold text-slate-900"}>
                {kpiData.totalProjects}
              </div>
              <span className={isDark ? "text-xs text-zinc-500" : "text-xs text-slate-500"}>activas</span>
            </div>
          </CardContent>
        </Card>
        <Card className={isDark ? "bg-zinc-950 border-accent/40 shadow-[0_0_24px_rgba(29,78,216,0.28)]" : "bg-white border-yellow-200 shadow-sm"}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={isDark ? "text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase" : "text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase"}>
              Actividades Pendientes
            </CardTitle>
            <span className="h-2 w-2 rounded-full bg-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.9)]" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className={isDark ? "text-3xl font-bold text-yellow-300" : "text-3xl font-bold text-yellow-600"}>
                {kpiData.pendingActivities}
              </div>
              <span className={isDark ? "text-xs text-zinc-500" : "text-xs text-slate-500"}>en cola</span>
            </div>
          </CardContent>
        </Card>
        <Card className={isDark ? "bg-zinc-950 border-blue-500/40" : "bg-white border-sky-200 shadow-sm"}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={isDark ? "text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase" : "text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase"}>
              En Revisión
            </CardTitle>
            <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.9)]" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className={isDark ? "text-3xl font-bold text-sky-300" : "text-3xl font-bold text-sky-600"}>
                {kpiData.inReviewActivities}
              </div>
              <span className={isDark ? "text-xs text-zinc-500" : "text-xs text-slate-500"}>en análisis</span>
            </div>
          </CardContent>
        </Card>
        <Card className={isDark ? "bg-zinc-950 border-emerald-500/40" : "bg-white border-emerald-200 shadow-sm"}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={isDark ? "text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase" : "text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase"}>
              Aprobadas
            </CardTitle>
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className={isDark ? "text-3xl font-bold text-emerald-300" : "text-3xl font-bold text-emerald-600"}>
                {kpiData.approvedActivities}
              </div>
              <span className={isDark ? "text-xs text-zinc-500" : "text-xs text-slate-500"}>cerradas</span>
            </div>
          </CardContent>
        </Card>
        <Card className={isDark ? "bg-zinc-950 border-red-500/40" : "bg-white border-red-200 shadow-sm"}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={isDark ? "text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase" : "text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase"}>
              Rechazadas
            </CardTitle>
            <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className={isDark ? "text-3xl font-bold text-red-300" : "text-3xl font-bold text-red-600"}>
                {kpiData.rejectedActivities}
              </div>
              <span className={isDark ? "text-xs text-zinc-500" : "text-xs text-slate-500"}>devoluciones</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[7fr_3fr] xl:grid-cols-[7fr_3fr]">
        <Card className={isDark ? "border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950" : "border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-50"}>
          <CardHeader className={isDark ? "flex flex-col gap-3 border-b border-zinc-800 pb-4" : "flex flex-col gap-3 border-b border-slate-200 pb-4"}>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className={isDark ? "text-sm font-semibold tracking-[0.18em] text-zinc-400 uppercase" : "text-sm font-semibold tracking-[0.18em] text-slate-500 uppercase"}>
                  {isClientRole ? "Panel de Empresa" : "Panel de Consultores"}
                </CardTitle>
                <div className={isDark ? "text-xs text-zinc-500" : "text-xs text-slate-500"}>
                  {isClientRole
                    ? "Vista táctica de carga y prioridad por empresa."
                    : "Vista táctica de carga y prioridad por consultor."}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className={isDark ? "inline-flex rounded-full border border-zinc-700 bg-zinc-900 px-1 py-1 text-xs" : "inline-flex rounded-full border border-slate-300 bg-slate-100 px-1 py-1 text-xs"}>
                  <Button
                    type="button"
                    size="sm"
                    variant={chartMode === "estado" ? "default" : "ghost"}
                    className={
                      chartMode === "estado"
                        ? "px-3 py-1 text-xs font-medium bg-accent text-accent-foreground"
                        : isDark
                        ? "px-3 py-1 text-xs font-medium text-zinc-300"
                        : "px-3 py-1 text-xs font-medium text-slate-600"
                    }
                    onClick={() => setChartMode("estado")}
                  >
                    Estados
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={chartMode === "prioridad" ? "default" : "ghost"}
                    className={
                      chartMode === "prioridad"
                        ? "px-3 py-1 text-xs font-medium bg-accent text-accent-foreground"
                        : isDark
                        ? "px-3 py-1 text-xs font-medium text-zinc-300"
                        : "px-3 py-1 text-xs font-medium text-slate-600"
                    }
                    onClick={() => setChartMode("prioridad")}
                  >
                    Prioridad
                  </Button>
                </div>
                <div className={isDark ? "inline-flex rounded-full border border-zinc-700 bg-zinc-900 px-1 py-1 text-xs" : "inline-flex rounded-full border border-slate-300 bg-slate-100 px-1 py-1 text-xs"}>
                  <Button
                    type="button"
                    size="sm"
                    variant={chartType === "torta" ? "default" : "ghost"}
                    className={
                      chartType === "torta"
                        ? isDark
                          ? "px-3 py-1 text-xs font-medium bg-zinc-100 text-zinc-900"
                          : "px-3 py-1 text-xs font-medium bg-white text-slate-900"
                        : isDark
                        ? "px-3 py-1 text-xs font-medium text-zinc-300"
                        : "px-3 py-1 text-xs font-medium text-slate-600"
                    }
                    onClick={() => setChartType("torta")}
                  >
                    Torta
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={chartType === "barras" ? "default" : "ghost"}
                    className={
                      chartType === "barras"
                        ? isDark
                          ? "px-3 py-1 text-xs font-medium bg-zinc-100 text-zinc-900"
                          : "px-3 py-1 text-xs font-medium bg-white text-slate-900"
                        : isDark
                        ? "px-3 py-1 text-xs font-medium text-zinc-300"
                        : "px-3 py-1 text-xs font-medium text-slate-600"
                    }
                    onClick={() => setChartType("barras")}
                  >
                    Barras
                  </Button>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={isDark ? "inline-flex items-center gap-2 border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800" : "inline-flex items-center gap-2 border-slate-300 bg-white text-slate-900 hover:bg-slate-100"}
                  onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
                >
                  {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  {isDark ? "Modo oscuro" : "Modo claro"}
                </Button>
              </div>
            </div>

            <div className="mb-2 flex items-center justify-end md:hidden">
              <Button
                type="button"
                variant="outline"
                className={isDark ? "border-zinc-700 bg-zinc-900 text-zinc-100" : "border-slate-300 bg-white text-slate-900"}
                onClick={() => setFiltersOpen(true)}
              >
                <Filter className="mr-2 h-4 w-4 text-accent" />
                Filtros
                {activeFiltersCount > 0 ? (
                  <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-foreground">
                    {activeFiltersCount}
                  </span>
                ) : null}
              </Button>
            </div>

            <div className="hidden flex-wrap items-start gap-2 md:flex">
              {!isClientRole ? (
                <div className={isDark ? "flex items-center gap-2 text-xs basis-full sm:basis-auto" : "flex items-center gap-2 text-xs text-slate-600 basis-full sm:basis-auto"}>
                  <Filter className="h-4 w-4 text-accent" />
                  <Select
                    value={selectedConsultantId}
                    onValueChange={handleConsultantChange}
                  >
                    <SelectTrigger className={isDark ? "h-8 border-zinc-700 bg-zinc-900 text-xs text-zinc-200" : "h-8 border-slate-300 bg-white text-xs text-slate-900"}>
                      <SelectValue placeholder="Consultor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los consultores</SelectItem>
                      {consultants.map((consultant) => (
                        <SelectItem key={consultant.id} value={consultant.id}>
                          {consultant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {!isClientRole && (
                <>
                  <div className={isDark ? "flex items-center gap-2 text-xs basis-full sm:basis-auto" : "flex items-center gap-2 text-xs text-slate-600 basis-full sm:basis-auto"}>
                    <Filter className="h-4 w-4 text-accent" />
                    <Select
                      value={selectedDepartment}
                      onValueChange={setSelectedDepartment}
                    >
                      <SelectTrigger className={isDark ? "h-8 border-zinc-700 bg-zinc-900 text-xs text-zinc-200" : "h-8 border-slate-300 bg-white text-xs text-slate-900"}>
                        <SelectValue placeholder="Departamento" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los departamentos</SelectItem>
                        {departments.map((department) => (
                          <SelectItem key={department} value={department}>
                            {department}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className={isDark ? "flex items-center gap-2 text-xs basis-full sm:basis-auto" : "flex items-center gap-2 text-xs text-slate-600 basis-full sm:basis-auto"}>
                    <Filter className="h-4 w-4 text-accent" />
                    <Select value={selectedRisk} onValueChange={setSelectedRisk}>
                      <SelectTrigger className={isDark ? "h-8 border-zinc-700 bg-zinc-900 text-xs text-zinc-200" : "h-8 border-slate-300 bg-white text-xs text-slate-900"}>
                        <SelectValue placeholder="Nivel de riesgo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los riesgos</SelectItem>
                        {risks.map((risk) => (
                          <SelectItem key={risk} value={risk}>
                            {risk}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div className={isDark ? "flex items-center gap-2 text-xs basis-full sm:basis-auto" : "flex items-center gap-2 text-xs text-slate-600 basis-full sm:basis-auto"}>
                <Filter className="h-4 w-4 text-accent" />
                <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
                  <SelectTrigger className={isDark ? "h-8 border-zinc-700 bg-zinc-900 text-xs text-zinc-200" : "h-8 border-slate-300 bg-white text-xs text-slate-900"}>
                    <SelectValue placeholder="Seleccionar empresa" />
                  </SelectTrigger>
                  <SelectContent className={isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white"}>
                    <SelectItem value="all">Todas las empresas</SelectItem>
                    {filteredProjects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={isDark ? "flex items-start gap-2 text-xs basis-full lg:basis-2/5" : "flex items-start gap-2 text-xs text-slate-600 basis-full lg:basis-2/5"}>
                <Filter className="h-4 w-4 text-accent" />
                <div className="flex w-full flex-col gap-1 min-w-0">
                  <div className={isDark ? "text-[10px] uppercase tracking-[0.18em] text-zinc-500" : "text-[10px] uppercase tracking-[0.18em] text-slate-500"}>
                    Rango de fechas
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(event) => setDateFrom(event.target.value)}
                      className={(isDark ? "h-8 border-zinc-700 bg-zinc-900 text-xs text-zinc-200" : "h-8 border-slate-300 bg-white text-xs text-slate-900") + " w-[150px]"}
                    />
                    <span className={isDark ? "text-zinc-500" : "text-slate-500"}>a</span>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(event) => setDateTo(event.target.value)}
                      className={(isDark ? "h-8 border-zinc-700 bg-zinc-900 text-xs text-zinc-200" : "h-8 border-slate-300 bg-white text-xs text-slate-900") + " w-[150px]"}
                    />
                  </div>
                </div>
              </div>
            </div>

            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetContent side="bottom" className={isDark ? "border-zinc-800 bg-zinc-950 text-zinc-100" : "border-slate-200 bg-white text-slate-900"}>
                <SheetHeader>
                  <SheetTitle>Filtros</SheetTitle>
                </SheetHeader>
                <div className="mt-4 grid gap-3">
                  {!isClientRole ? (
                    <div className={isDark ? "flex items-center gap-2 text-sm" : "flex items-center gap-2 text-sm text-slate-600"}>
                      <Filter className="h-4 w-4 text-accent" />
                      <Select value={selectedConsultantId} onValueChange={handleConsultantChange}>
                        <SelectTrigger className={isDark ? "h-10 border-zinc-700 bg-zinc-900" : "h-10 border-slate-300 bg-white"}>
                          <SelectValue placeholder="Consultor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos los consultores</SelectItem>
                          {consultants.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  {!isClientRole && (
                    <>
                      <div className={isDark ? "flex items-center gap-2 text-sm" : "flex items-center gap-2 text-sm text-slate-600"}>
                        <Filter className="h-4 w-4 text-accent" />
                        <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                          <SelectTrigger className={isDark ? "h-10 border-zinc-700 bg-zinc-900" : "h-10 border-slate-300 bg-white"}>
                            <SelectValue placeholder="Departamento" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos los departamentos</SelectItem>
                            {departments.map((d) => (
                              <SelectItem key={d} value={d}>
                                {d}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className={isDark ? "flex items-center gap-2 text-sm" : "flex items-center gap-2 text-sm text-slate-600"}>
                        <Filter className="h-4 w-4 text-accent" />
                        <Select value={selectedRisk} onValueChange={setSelectedRisk}>
                          <SelectTrigger className={isDark ? "h-10 border-zinc-700 bg-zinc-900" : "h-10 border-slate-300 bg-white"}>
                            <SelectValue placeholder="Nivel de riesgo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos los riesgos</SelectItem>
                            {risks.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  <div className={isDark ? "flex items-center gap-2 text-sm" : "flex items-center gap-2 text-sm text-slate-600"}>
                    <Filter className="h-4 w-4 text-accent" />
                    <Select value={selectedCompanyId} onValueChange={handleCompanyChange}>
                      <SelectTrigger className={isDark ? "h-10 border-zinc-700 bg-zinc-900" : "h-10 border-slate-300 bg-white"}>
                        <SelectValue placeholder="Seleccionar empresa" />
                      </SelectTrigger>
                      <SelectContent className={isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white"}>
                        <SelectItem value="all">Todas las empresas</SelectItem>
                        {filteredProjects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className={isDark ? "flex items-start gap-2 text-sm" : "flex items-start gap-2 text-sm text-slate-600"}>
                    <Filter className="h-4 w-4 text-accent" />
                    <div className="flex w-full flex-col gap-1">
                      <div className={isDark ? "text-[10px] uppercase tracking-[0.18em] text-zinc-500" : "text-[10px] uppercase tracking-[0.18em] text-slate-500"}>
                        Rango de fechas
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className={isDark ? "h-10 border-zinc-700 bg-zinc-900" : "h-10 border-slate-300 bg-white"}
                        />
                        <span className={isDark ? "text-zinc-500" : "text-slate-500"}>a</span>
                        <Input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className={isDark ? "h-10 border-zinc-700 bg-zinc-900" : "h-10 border-slate-300 bg-white"}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <SheetFooter className="mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelectedConsultantId("all");
                      setSelectedDepartment("all");
                      setSelectedRisk("all");
                      setSelectedCompanyId("all");
                      setDateFrom("");
                      setDateTo("");
                    }}
                  >
                    Limpiar filtros
                  </Button>
                  <Button type="button" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setFiltersOpen(false)}>
                    Aplicar
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </CardHeader>
          <CardContent
            className="pt-6"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
              {/* Tactical Indicators Section (Left) */}
              <div className={isDark ? "flex flex-col gap-3 text-xs text-zinc-300" : "flex flex-col gap-3 text-xs text-slate-700"}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-accent" />
                    <span className="font-semibold tracking-wide">
                      Indicadores tácticos
                    </span>
                  </div>
                  <span
                    className={
                      realtimeStatus === "connected"
                        ? isDark
                          ? "inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400"
                          : "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"
                        : isDark
                          ? "inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-400"
                          : "inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600"
                    }
                  >
                    <span className={isDark ? "h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" : "h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"} />
                    {realtimeStatus === "connected"
                      ? "Tiempo real WebSocket"
                      : "Actualización automática"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-2 xl:grid-cols-2">
                  <div className={isDark ? "rounded-xl border border-zinc-700 bg-zinc-900/70 px-3 py-2" : "rounded-xl border border-slate-200 bg-white px-3 py-2"}>
                    <div className={isDark ? "text-[10px] uppercase tracking-[0.18em] text-zinc-500" : "text-[10px] uppercase tracking-[0.18em] text-slate-500"}>
                      Actividades filtradas
                    </div>
                    <div className={isDark ? "mt-1 text-lg font-semibold text-zinc-50" : "mt-1 text-lg font-semibold text-slate-900"}>
                      {kpiTotalFiltered}
                    </div>
                  </div>
                  <div className={isDark ? "rounded-xl border border-yellow-500/40 bg-yellow-500/5 px-3 py-2" : "rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2"}>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-yellow-400">
                      Prioridad Media
                    </div>
                    <div className={isDark ? "mt-1 text-lg font-semibold text-yellow-300" : "mt-1 text-lg font-semibold text-yellow-600"}>
                      {kpiCritical}
                    </div>
                  </div>
                  <div className={isDark ? "rounded-xl border border-sky-500/40 bg-sky-500/5 px-3 py-2" : "rounded-xl border border-sky-200 bg-sky-50 px-3 py-2"}>
                    <div className={isDark ? "text-[10px] uppercase tracking-[0.18em] text-sky-300" : "text-[10px] uppercase tracking-[0.18em] text-sky-600"}>
                      Revisión
                    </div>
                    <div className={isDark ? "mt-1 text-lg font-semibold text-sky-200" : "mt-1 text-lg font-semibold text-sky-700"}>
                      {statusCounts.inReview}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="inline-flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={handleExportExcel}
                  >
                    <Download className="h-4 w-4" />
                    Exportar Excel/CSV
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={isDark ? "inline-flex items-center gap-2 border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800" : "inline-flex items-center gap-2 border-slate-300 bg-white text-slate-900 hover:bg-slate-100"}
                    onClick={handleExportPdf}
                  >
                    <Download className="h-4 w-4" />
                    Exportar PDF
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={notificationsEnabled ? "default" : "outline"}
                    className={
                      notificationsEnabled
                        ? "bg-red-500 text-white hover:bg-red-600"
                        : isDark ? "border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800" : "border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
                    }
                    onClick={() =>
                      setNotificationsEnabled((prev) => !prev)
                    }
                  >
                    Alertas críticas
                  </Button>
                </div>
              </div>

              {/* Charts Section (Right) */}
              <div className="h-[300px] mb-8">
                {chartType === "torta" ? (
                  <OverviewChart data={mainChartData} dark={isDark} selectedCompanyId={selectedCompanyId} />
                ) : (
                  <OverviewBarChart
                    data={consultantChartData}
                    chartMode={chartMode}
                    isDark={isDark}
                    selectedCompanyId={selectedCompanyId}
                    statusCounts={statusCounts}
                    priorityCounts={priorityCounts}
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <PredictiveInsights activities={filteredActivities} selectedCompanyId={selectedCompanyId} />

        <Card className={isDark ? "border-zinc-800 bg-zinc-950" : "border-slate-200 bg-white"}>
          <CardHeader className={isDark ? "border-b border-zinc-800 pb-4" : "border-b border-slate-200 pb-4"}>
            <CardTitle className={isDark ? "text-sm font-semibold tracking-[0.18em] text-zinc-400 uppercase" : "text-sm font-semibold tracking-[0.18em] text-slate-500 uppercase"}>
              Resumen de Estados
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {statusChartData.reduce((acc, curr) => acc + curr.value, 0) > 0 ? (
              <div className="h-[320px]">
                <OverviewChart data={statusChartData} dark={isDark} />
              </div>
            ) : (
              <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
                No hay datos disponibles para la empresa seleccionada.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CompanyMetricsGrid userRole={userRole || "CLIENT_VIEWER"} />
      {isClientRole ? (
        <Card className={isDark ? "mt-6 border-zinc-800 bg-zinc-950" : "mt-6 border-slate-200 bg-white"}>
          <CardHeader className={isDark ? "border-b border-zinc-800 pb-4" : "border-b border-slate-200 pb-4"}>
            <CardTitle className={isDark ? "text-sm font-semibold tracking-[0.18em] text-zinc-400 uppercase" : "text-sm font-semibold tracking-[0.18em] text-slate-500 uppercase"}>
              Indicadores
            </CardTitle>
            <div className={isDark ? "text-xs text-zinc-500" : "text-xs text-slate-500"}>
              Gráficas de los indicadores creados para tus empresas.
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {visibleIndicators.length === 0 ? (
              <div className={isDark ? "flex items-center justify-center rounded-2xl border border-dashed border-zinc-800 p-10 text-sm text-zinc-400" : "flex items-center justify-center rounded-2xl border border-dashed border-slate-200 p-10 text-sm text-muted-foreground"}>
                No hay indicadores creados para la empresa seleccionada.
              </div>
            ) : (
              <div className="space-y-4">
                {visibleIndicators.map((indicator) => {
                  const latest = indicator.latestMeasurement;
                  const latestValue = latest ? latest.computedValue : null;
                  const light = trafficLight(indicator.targetPercent, latestValue);
                  const ratio = detectRatioFormula(indicator.formula);
                  let numerator: number | null = null;
                  let denominator: number | null = null;
                  let numeratorLabel = ratio ? ratio.numeratorKey : "";
                  let denominatorLabel = ratio ? ratio.denominatorKey : "";
                  if (ratio && latest?.inputsJson) {
                    try {
                      const parsed = JSON.parse(latest.inputsJson);
                      const obj = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
                      const num = Number(obj[ratio.numeratorKey]);
                      const den = Number(obj[ratio.denominatorKey]);
                      numerator = Number.isFinite(num) ? num : null;
                      denominator = Number.isFinite(den) ? den : null;
                      numeratorLabel = indicator.variables.find((v) => v.key === ratio.numeratorKey)?.label || numeratorLabel;
                      denominatorLabel = indicator.variables.find((v) => v.key === ratio.denominatorKey)?.label || denominatorLabel;
                    } catch {
                      numerator = null;
                      denominator = null;
                    }
                  }

                  const pct =
                    latestValue === null || indicator.targetPercent === 0
                      ? 0
                      : Math.min(100, Math.max(0, (latestValue / indicator.targetPercent) * 100));

                  const pieData = (() => {
                    if (!latest) return [];
                    if (ratio && numerator !== null && denominator !== null && denominator > 0) {
                      const part = Math.max(0, Math.min(denominator, numerator));
                      const rest = Math.max(0, denominator - part);
                      return [
                        { name: numeratorLabel, value: part },
                        { name: "Resto del total", value: rest },
                      ];
                    }
                    if (latestValue === null) return [];
                    return [
                      { name: "Cumplimiento", value: pct },
                      { name: "Pendiente", value: Math.max(0, 100 - pct) },
                    ];
                  })();

                  const complianceNowPct = latest ? (Number.isFinite(latest.compliancePct) ? Math.max(0, latest.compliancePct) : null) : null;
                  const complianceLabelPct = complianceNowPct === null ? "—" : complianceNowPct >= 1000 ? `${Math.round(complianceNowPct)}%` : `${complianceNowPct.toFixed(1)}%`;
                  const metaAllowed =
                    ratio && numerator !== null && denominator !== null && Number.isFinite(denominator)
                      ? (denominator * indicator.targetPercent) / 100
                      : null;

                  const barData = [
                    {
                      name: "Indicador",
                      actual: ratio && numerator !== null ? numerator : latestValue || 0,
                      meta: ratio && metaAllowed !== null ? metaAllowed : indicator.targetPercent,
                    },
                  ];
                  const centerFill = isDark ? "#e5e7eb" : "#0f172a";
                  const centerSecondaryFill = isDark ? "#a1a1aa" : "#64748b";

                  return (
                    <Card key={indicator.id} className={isDark ? "rounded-2xl border-zinc-800 bg-zinc-950" : "rounded-2xl border-slate-200 bg-white"}>
                      <CardHeader className="px-3 sm:px-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className={isDark ? "break-words text-base font-semibold text-zinc-50" : "break-words text-base font-semibold text-slate-950"}>
                              {indicator.name}
                            </div>
                            {indicator.description ? (
                              <div className={isDark ? "mt-1 break-words text-sm text-zinc-400" : "mt-1 break-words text-sm text-slate-600"}>
                                {indicator.description}
                              </div>
                            ) : null}
                            <div className="mt-2 flex flex-wrap gap-2">
                              <div className={`inline-flex items-center rounded-full border px-2 py-1 text-xs ${light.className}`}>
                                {light.label}
                              </div>
                              <div className={isDark ? "inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300" : "inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"}>
                                {ratio && metaAllowed !== null
                                  ? `Meta: máx ${formatQuantity(metaAllowed)} ${numeratorLabel.toLowerCase()}`
                                  : `Meta: ${indicator.targetPercent}%`}
                              </div>
                              {selectedCompanyId === "all" ? (
                                <div className={isDark ? "inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300" : "inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"}>
                                  Empresa: {indicator.projectName}
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <div className="w-full sm:w-auto">
                            <Button
                              type="button"
                              className="h-11 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
                              onClick={() => router.push(`/projects/${indicator.projectId}/minimum-indicators/${indicator.id}`)}
                            >
                              Ver detalle
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="px-3 sm:px-6">
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                          <Card className={isDark ? "min-w-0 overflow-x-hidden border-zinc-800 bg-zinc-950" : "min-w-0 overflow-x-hidden"}>
                            <CardHeader className="px-3 sm:px-6">
                              <CardTitle className="text-base">Actual vs Meta</CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 sm:px-6">
                              <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={barData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#27272a" : "#e5e7eb"} />
                                    <XAxis dataKey="name" tick={{ fill: isDark ? "#e5e7eb" : "#4b5563", fontSize: 10 }} />
                                    <YAxis tick={{ fill: isDark ? "#e5e7eb" : "#4b5563", fontSize: 10 }} />
                                    <Tooltip
                                      contentStyle={{
                                        backgroundColor: isDark ? "#020617" : "#ffffff",
                                        borderColor: isDark ? "#3f3f46" : "#e5e7eb",
                                        color: isDark ? "#e5e7eb" : "#111827",
                                        fontSize: 12,
                                      }}
                                      formatter={(value: unknown, name: unknown) => {
                                        const num = typeof value === "number" ? value : Number(value);
                                        const label = name === "actual" ? "Actual" : name === "meta" ? "Meta" : String(name || "");
                                        if (!Number.isFinite(num)) return [String(value), label];
                                        return [ratio ? formatQuantity(num) : num.toFixed(2), label];
                                      }}
                                    />
                                    <Legend />
                                    <Bar dataKey="actual" fill="var(--chart-2)" name="Actual">
                                      <LabelList
                                        dataKey="actual"
                                        position="top"
                                        formatter={(v: unknown) => {
                                          const num = typeof v === "number" ? v : Number(v);
                                          if (!Number.isFinite(num)) return "";
                                          return ratio ? formatQuantity(num) : num.toFixed(1);
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
                                          return ratio ? formatQuantity(num) : num.toFixed(1);
                                        }}
                                      />
                                    </Bar>
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                              <div className={isDark ? "mt-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200" : "mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700"}>
                                {latestValue === null ? (
                                  <div>Sin datos aún. Carga una medición para ver el valor actual y el porcentaje de avance.</div>
                                ) : (
                                  <div className="flex flex-col gap-1">
                                    {ratio && numerator !== null && denominator !== null ? (
                                      <>
                                        <div>
                                          {numeratorLabel}: <span className={isDark ? "font-semibold text-zinc-50" : "font-semibold text-slate-900"}>{formatQuantity(numerator)}</span>
                                        </div>
                                        <div>
                                          {denominatorLabel}: <span className={isDark ? "font-semibold text-zinc-50" : "font-semibold text-slate-900"}>{formatQuantity(denominator)}</span>
                                        </div>
                                        {metaAllowed !== null ? (
                                          <div>
                                            Meta: máximo{" "}
                                            <span className={isDark ? "font-semibold text-zinc-50" : "font-semibold text-slate-900"}>
                                              {formatQuantity(metaAllowed)}
                                            </span>{" "}
                                            {numeratorLabel.toLowerCase()}
                                          </div>
                                        ) : null}
                                        <div className={isDark ? "text-zinc-400" : "text-slate-600"}>
                                          Resumen:{" "}
                                          <span className={isDark ? "font-medium text-zinc-50" : "font-medium text-slate-900"}>
                                            {formatQuantity(numerator)} de {formatQuantity(denominator)}
                                          </span>{" "}
                                          en el período seleccionado.
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <div>
                                          Valor actual:{" "}
                                          <span className={isDark ? "font-semibold text-zinc-50" : "font-semibold text-slate-900"}>
                                            {latestValue.toFixed(2)}
                                          </span>{" "}
                                          {indicator.unit}
                                        </div>
                                        <div>
                                          Meta:{" "}
                                          <span className={isDark ? "font-semibold text-zinc-50" : "font-semibold text-slate-900"}>
                                            {indicator.targetPercent.toFixed(2)}
                                          </span>{" "}
                                          {indicator.unit}
                                        </div>
                                        <div className={isDark ? "text-zinc-400" : "text-slate-600"}>
                                          Resumen:{" "}
                                          <span className={isDark ? "font-medium text-zinc-50" : "font-medium text-slate-900"}>
                                            {latestValue.toFixed(2)} {indicator.unit}
                                          </span>{" "}
                                          en el período seleccionado.
                                        </div>
                                      </>
                                    )}
                                    {latest?.resultAnalysis?.trim() ? (
                                      <div className={isDark ? "text-zinc-400 whitespace-pre-wrap break-words" : "text-slate-600 whitespace-pre-wrap break-words"}>
                                        Análisis de resultado:{" "}
                                        <span className={isDark ? "font-medium text-zinc-50" : "font-medium text-slate-900"}>{latest.resultAnalysis}</span>
                                      </div>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>

                          <Card className={isDark ? "min-w-0 overflow-x-hidden border-zinc-800 bg-zinc-950" : "min-w-0 overflow-x-hidden"}>
                            <CardHeader className="px-3 sm:px-6">
                              <CardTitle className="text-base">{ratio ? "Resultado" : "Cumplimiento"}</CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 sm:px-6">
                              <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                  <PieChart>
                                    <Tooltip
                                      contentStyle={{
                                        backgroundColor: isDark ? "#020617" : "#ffffff",
                                        borderColor: isDark ? "#3f3f46" : "#e5e7eb",
                                        color: isDark ? "#e5e7eb" : "#111827",
                                        fontSize: 12,
                                      }}
                                      formatter={(value: unknown, name: unknown) => {
                                        const num = typeof value === "number" ? value : Number(value);
                                        const label = String(name || "");
                                        if (!Number.isFinite(num)) return [String(value), label];
                                        return ratio ? [formatQuantity(num), label] : [`${num.toFixed(1)}%`, label];
                                      }}
                                    />
                                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={86} stroke="#ffffff">
                                      {pieData.map((_, idx) => (
                                        <Cell key={idx} fill={idx === 0 ? "var(--chart-2)" : "#e2e8f0"} />
                                      ))}
                                      <RechartsLabel
                                        position="center"
                                        content={() => {
                                          const text =
                                            ratio && numerator !== null && denominator !== null
                                              ? `${formatQuantity(numerator)}/${formatQuantity(denominator)}`
                                              : complianceNowPct === null
                                              ? "—"
                                              : complianceLabelPct;
                                          return (
                                            <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill={centerFill}>
                                              <tspan fontSize="18" fontWeight="700">
                                                {text}
                                              </tspan>
                                              <tspan x="50%" dy="18" fontSize="11" fill={centerSecondaryFill}>
                                                {ratio ? "Resultado" : "Cumplimiento"}
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
                                <div className={isDark ? "mt-2 text-sm text-zinc-400" : "mt-2 text-sm text-slate-600"}>
                                  Periodo: {formatDateInput(latest.periodStart)} → {formatDateInput(latest.periodEnd)}
                                </div>
                              ) : null}
                              <div className={isDark ? "mt-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200" : "mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-700"}>
                                {!latest ? (
                                  <div>Sin datos aún. Carga una medición para calcular el cumplimiento.</div>
                                ) : (
                                  <div className="flex flex-col gap-1">
                                    {ratio && numerator !== null && denominator !== null ? (
                                      <>
                                        <div>
                                          Resultado:{" "}
                                          <span className={isDark ? "font-semibold text-zinc-50" : "font-semibold text-slate-900"}>
                                            {formatQuantity(numerator)} de {formatQuantity(denominator)}
                                          </span>
                                        </div>
                                        {metaAllowed !== null ? (
                                          <div className={isDark ? "text-zinc-400" : "text-slate-600"}>
                                            Meta: máximo{" "}
                                            <span className={isDark ? "font-semibold text-zinc-50" : "font-semibold text-slate-900"}>
                                              {formatQuantity(metaAllowed)}
                                            </span>{" "}
                                            {numeratorLabel.toLowerCase()}
                                          </div>
                                        ) : null}
                                      </>
                                    ) : (
                                      <>
                                        <div>
                                          Cumples el{" "}
                                          <span className={isDark ? "font-semibold text-zinc-50" : "font-semibold text-slate-900"}>
                                            {complianceLabelPct}
                                          </span>{" "}
                                          de la meta.
                                        </div>
                                        <div className={isDark ? "text-zinc-400" : "text-slate-600"}>
                                          Resumen:{" "}
                                          <span className={isDark ? "font-medium text-zinc-50" : "font-medium text-slate-900"}>
                                            {latest.computedValue.toFixed(2)} {indicator.unit}
                                          </span>{" "}
                                          en el período seleccionado.
                                        </div>
                                      </>
                                    )}
                                    {latest?.resultAnalysis?.trim() ? (
                                      <div className={isDark ? "text-zinc-400 whitespace-pre-wrap break-words" : "text-slate-600 whitespace-pre-wrap break-words"}>
                                        Análisis de resultado:{" "}
                                        <span className={isDark ? "font-medium text-zinc-50" : "font-medium text-slate-900"}>{latest.resultAnalysis}</span>
                                      </div>
                                    ) : null}
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
