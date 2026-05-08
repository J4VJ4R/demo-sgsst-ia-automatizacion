"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { getCompanyMetrics, CompanyMetrics } from "@/app/dashboard-actions";
import { CompanyChart } from "./company-chart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, PieChart, BarChart3, RefreshCw, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { toast } from "sonner";

interface CompanyMetricsGridProps {
  initialMetrics?: CompanyMetrics[];
  userRole: string;
}

export function CompanyMetricsGrid({ initialMetrics }: CompanyMetricsGridProps) {
  const [metrics, setMetrics] = useState<CompanyMetrics[]>(initialMetrics || []);
  const [isLoading, setIsLoading] = useState(!initialMetrics);
  const [chartType, setChartType] = useState<"pie" | "bar">("pie");
  const [chartMode, setChartMode] = useState<"status" | "priority">("status");
  const [dateRange, setDateRange] = useState<"30" | "60" | "90" | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "INACTIVE" | "all">("ACTIVE");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchMetrics = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getCompanyMetrics({
        dateRange,
        status: statusFilter,
      });

      if (result.success && result.metrics) {
        setMetrics(result.metrics);
        // Reset to page 1 if data changes significantly
        setCurrentPage(1);
      } else {
        console.error("Failed to load metrics:", result.error);
        toast.error("Error al cargar métricas", { description: result.error });
      }
    } catch (error) {
      console.error(error);
      toast.error("Error de conexión");
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, statusFilter]);

  // Initial load
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Real-time listener
  useEffect(() => {
    const handleUpdate = () => {
      // Re-fetch data silently when a notification arrives
      // Only show loading if it takes too long? No, better silent update.
      getCompanyMetrics({ dateRange, status: statusFilter }).then((res) => {
        if (res.success && res.metrics) {
            setMetrics(res.metrics);
        }
      });
    };

    window.addEventListener("notification-update", handleUpdate);
    return () => window.removeEventListener("notification-update", handleUpdate);
  }, [dateRange, statusFilter]);

  // Sort metrics by operational relevance: Pending > High Priority > Total > Name
  const sortedMetrics = useMemo(() => {
    return [...metrics].sort((a, b) => {
      // 1. Sort by Pending activities (Descending) - Critical Operational Relevance
      if (b.pending !== a.pending) return b.pending - a.pending;
      // 2. Sort by High Priority (Descending)
      if (b.high !== a.high) return b.high - a.high;
      // 3. Sort by Total Activities (Descending)
      if (b.totalActivities !== a.totalActivities) return b.totalActivities - a.totalActivities;
      // 4. Alphabetical fallback
      return a.name.localeCompare(b.name);
    });
  }, [metrics]);

  // Pagination Logic
  const totalPages = Math.ceil(sortedMetrics.length / itemsPerPage);
  const paginatedMetrics = sortedMetrics.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <Card className="w-full mt-6 shadow-sm border-zinc-200 dark:border-zinc-800">
      <CardHeader className="pb-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <PieChart className="h-5 w-5 text-blue-600" />
              Métricas por Empresa
            </CardTitle>
            <CardDescription>
              Visualización de actividades por estado ({metrics.length} empresas encontradas)
              <span className="block text-xs text-muted-foreground mt-1">
                Ordenado por relevancia operativa (Pendientes &gt; Prioridad Alta)
              </span>
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Mode Toggle */}
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
              <Button
                variant={chartMode === "status" ? "secondary" : "ghost"}
                size="sm"
                className={`h-7 px-2 text-xs ${chartMode === "status" ? "shadow-sm bg-white dark:bg-zinc-700" : "text-zinc-500"}`}
                onClick={() => setChartMode("status")}
              >
                Estados
              </Button>
              <Button
                variant={chartMode === "priority" ? "secondary" : "ghost"}
                size="sm"
                className={`h-7 px-2 text-xs ${chartMode === "priority" ? "shadow-sm bg-white dark:bg-zinc-700" : "text-zinc-500"}`}
                onClick={() => setChartMode("priority")}
              >
                Prioridad
              </Button>
            </div>

            {/* Chart Type Toggle */}
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
              <Button
                variant={chartType === "pie" ? "secondary" : "ghost"}
                size="sm"
                className={`h-7 px-2 ${chartType === "pie" ? "shadow-sm bg-white dark:bg-zinc-700" : "text-zinc-500"}`}
                onClick={() => setChartType("pie")}
              >
                <PieChart className="h-4 w-4 mr-1" /> Torta
              </Button>
              <Button
                variant={chartType === "bar" ? "secondary" : "ghost"}
                size="sm"
                className={`h-7 px-2 ${chartType === "bar" ? "shadow-sm bg-white dark:bg-zinc-700" : "text-zinc-500"}`}
                onClick={() => setChartType("bar")}
              >
                <BarChart3 className="h-4 w-4 mr-1" /> Barras
              </Button>
            </div>

            {/* Date Range Filter */}
            <Select value={dateRange} onValueChange={(v: "30" | "60" | "90" | "all") => setDateRange(v)}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Rango de fecha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Últimos 30 días</SelectItem>
                <SelectItem value="60">Últimos 60 días</SelectItem>
                <SelectItem value="90">Últimos 90 días</SelectItem>
                <SelectItem value="all">Todo el tiempo</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(v: "ACTIVE" | "INACTIVE" | "all") => setStatusFilter(v)}>
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Activas</SelectItem>
                <SelectItem value="INACTIVE">Inactivas</SelectItem>
                <SelectItem value="all">Todas</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="icon" className="h-9 w-9" onClick={fetchMetrics}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading && metrics.length === 0 ? (
          <div className="flex justify-center items-center h-[300px]">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
          </div>
        ) : metrics.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-[200px] text-zinc-500">
            <PieChart className="h-12 w-12 mb-2 opacity-20" />
            <p>No se encontraron empresas con los filtros seleccionados.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 min-h-[300px]">
              {paginatedMetrics.map((metric) => (
                <Card key={metric.id} className="overflow-hidden border border-zinc-100 dark:border-zinc-800 hover:shadow-md transition-shadow flex flex-col h-full">
                  <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                    <Link
                      href={`/projects/${metric.id}`}
                      className="min-w-0 font-semibold text-sm truncate hover:underline"
                      title={`Ir a ${metric.name}`}
                    >
                      {metric.name}
                    </Link>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        metric.status === 'ACTIVE' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                        {metric.status === 'ACTIVE' ? 'ACT' : 'INA'}
                    </span>
                  </div>
                  <div className="p-2 h-[200px]">
                    {metric.totalActivities === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-xs text-zinc-400">
                            <span>Sin actividades registradas</span>
                        </div>
                    ) : (
                        <CompanyChart
                        type={chartType}
                        mode={chartMode}
                        companyId={metric.id}
                        data={{
                            // Status data
                            pending: metric.pending,
                            inReview: metric.inReview,
                            approved: metric.approved,
                            // Priority data
                            high: metric.high,
                            medium: metric.medium,
                            low: metric.low,
                        }}
                        />
                    )}
                  </div>
                  <div className="bg-zinc-50/50 dark:bg-zinc-900/30 p-2 text-xs text-zinc-500 text-center border-t mt-auto">
                    Total: <span className="font-medium text-foreground">{metric.totalActivities}</span> actividades
                  </div>
                </Card>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4 px-2">
                <div className="text-xs text-muted-foreground">
                  Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, sortedMetrics.length)} de {sortedMetrics.length} empresas
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    title="Primera página"
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    title="Página anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400 min-w-[80px] text-center">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    title="Página siguiente"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    title="Última página"
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
