'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
} from "lucide-react";
import { ActivityStatusActions } from "@/components/activities/activity-status-actions";
import { AccidentalidadStatusActions } from "@/components/accidentalidad/accidentalidad-status-actions";
import { DocumentPreview } from "@/components/documents/document-preview";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CustomLoader } from "@/components/ui/custom-loader";
import { getPriorityBadgeClass } from "@/lib/utils";
import { useActivitiesRealtime } from "@/hooks/use-activities-realtime";
import { isCollaboratorPreloadedActivityTitle } from "@/lib/collaborator-preloaded-activities";

interface ActivityListProps {
  activities: ActivityListActivity[];
  userRole: string;
  adminUsers?: { id: string; name: string }[];
  currentUserId?: string;
}

type PreviewDocument = {
  id: string;
  name: string;
  url: string;
  documents?: {
    id: string;
    name: string;
    url: string;
  }[];
  replies?: {
    id: string;
    adminMessage: string | null;
    message: string;
    createdAt: Date | string;
    isRead: boolean;
    document: { id: string; name: string; url: string };
    createdByUser: { name: string | null; role: string };
  }[];
  activity: {
    id?: string;
    status?: string;
    title: string;
    project: {
      name: string;
    };
  };
};

export type ActivityListActivity = {
  kind?: "ACTIVITY" | "ACCIDENTALIDAD";
  id: string;
  title: string;
  status: string;
  updatedAt: Date | string;
  priority: string;
  periodicity?: string | null;
  dueDate?: Date | string | null; // Added dueDate
  rejectionReason?: string | null;
  returnedNote?: string | null;
  returnedAt?: Date | string | null;
  project: {
    id: string;
    name: string;
    nit?: string | null;
  };
  assignedTo?: {
    name: string | null;
  } | null;
  documents?: {
    id: string;
    name: string;
    url: string;
    uploadedAt: Date | string;
  }[];
  replies?: {
    id: string;
    adminMessage: string | null;
    message: string;
    createdAt: Date | string;
    isRead: boolean;
    document: { id: string; name: string; url: string };
    createdByUser: { name: string | null; role: string };
  }[];
};

export function getActivityPriorityInfo(
  priorityRaw: string | null | undefined,
  title: string,
  dueDate?: Date | string | null,
  status?: string
): {
  label: "Vencido" | "Por vencer" | "Cumplido";
  score: number;
  hasDueDate: boolean;
} {
  if (dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    const dueLocal = new Date(due.getFullYear(), due.getMonth(), due.getDate());

    const diffTime = dueLocal.getTime() - today.getTime();
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (days <= 0) {
      return { label: "Vencido", score: 3, hasDueDate: true };
    }
    if (days <= 15) {
      return { label: "Por vencer", score: 2, hasDueDate: true };
    }
    return { label: "Cumplido", score: 1, hasDueDate: true };
  }

  // 2. Fallback logic based on static priority field
  const normalized = (priorityRaw || "").toLowerCase();
  if (normalized.startsWith("vencido") || normalized.startsWith("alta")) {
    return { label: "Vencido", score: 3, hasDueDate: false };
  }
  if (normalized.startsWith("por vencer") || normalized.startsWith("media")) {
    return { label: "Por vencer", score: 2, hasDueDate: false };
  }
  if (normalized.startsWith("cumplido") || normalized.startsWith("baja")) {
    return { label: "Cumplido", score: 1, hasDueDate: false };
  }

  // 3. Last resort fallback based on title keywords (legacy)
  const t = title.toLowerCase();
  if (
    t.includes("emergencia") ||
    t.includes("brigada") ||
    t.includes("simulacro") ||
    t.includes("incidente") ||
    t.includes("accidente")
  ) {
    return { label: "Vencido", score: 3, hasDueDate: false };
  }
  if (
    t.includes("evaluación") ||
    t.includes("programa") ||
    t.includes("plan") ||
    t.includes("inspección")
  ) {
    return { label: "Por vencer", score: 2, hasDueDate: false };
  }
  return { label: "Cumplido", score: 1, hasDueDate: false };
}

export function ActivityList({
  activities: initialActivities,
  userRole,
  adminUsers = [],
  currentUserId = "",
}: ActivityListProps) {
  void adminUsers;
  void currentUserId;
  const isAdmin = userRole === "ADMIN_PMD" || userRole === "GESTOR";
  const isConsultant = userRole === "CONSULTANT";

  const [activities, setActivities] = useState<ActivityListActivity[]>(() =>
    initialActivities.filter((a) => !(a.kind !== "ACCIDENTALIDAD" && isCollaboratorPreloadedActivityTitle(a.title)))
  );
  const router = useRouter();
  
  // Sync state with props when router.refresh() updates initialActivities
  useEffect(() => {
    const t = setTimeout(() => {
      setActivities(initialActivities.filter((a) => !(a.kind !== "ACCIDENTALIDAD" && isCollaboratorPreloadedActivityTitle(a.title))));
    }, 0);
    return () => clearTimeout(t);
  }, [initialActivities]);

  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const searchParamsString = searchParams.toString();
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [realtimeNewIds, setRealtimeNewIds] = useState<Record<string, number>>({});
  const [selectedDoc, setSelectedDoc] = useState<PreviewDocument | null>(null);
  const [isCompactFilters, setIsCompactFilters] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(max-width: 1023px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(max-width: 1023px)");
    const apply = () => setIsCompactFilters(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!highlightId) return;
    const t0 = setTimeout(() => {
      setHighlightedId(highlightId);
      const el = document.querySelector(`[data-activity-id="${highlightId}"]`) as HTMLElement | null;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
    const t = setTimeout(() => setHighlightedId(null), 5000);
    return () => {
      clearTimeout(t0);
      clearTimeout(t);
    };
  }, [highlightId, activities.length]);

  const { state: realtimeState } = useActivitiesRealtime({
    enabled: (isAdmin || isConsultant) && typeof window !== "undefined" && typeof window.EventSource !== "undefined",
    onActivityCreated: (payload) => {
      if (payload.kind === "ACTIVITY" && isCollaboratorPreloadedActivityTitle(payload.title)) return;
      setActivities((prev) => {
        if (prev.some((a) => a.id === payload.id)) return prev;
        const next: ActivityListActivity = {
          kind: payload.kind,
          id: payload.id,
          title: payload.title,
          status: payload.status,
          updatedAt: payload.updatedAt,
          priority: payload.priority,
          dueDate: payload.dueDate || null,
          returnedNote: payload.returnedNote || null,
          returnedAt: payload.returnedAt || null,
          project: payload.project,
          assignedTo: payload.assignedTo ?? null,
          documents: payload.documents,
        };
        return [next, ...prev];
      });
      setRealtimeNewIds((prev) => ({ ...prev, [payload.id]: Date.now() }));
      window.setTimeout(() => {
        setRealtimeNewIds((prev) => {
          const next = { ...prev };
          delete next[payload.id];
          return next;
        });
      }, 6000);
      toast.success("Nueva actividad recibida", { duration: 2500 });
    },
    onActivityUpdated: (payload) => {
      if (payload.kind === "ACTIVITY" && isCollaboratorPreloadedActivityTitle(payload.title)) return;
      setActivities((prev) => {
        const idx = prev.findIndex((a) => a.id === payload.id);
        if (idx === -1) {
          const next: ActivityListActivity = {
            kind: payload.kind,
            id: payload.id,
            title: payload.title,
            status: payload.status,
            updatedAt: payload.updatedAt,
            priority: payload.priority,
            dueDate: payload.dueDate || null,
            returnedNote: payload.returnedNote || null,
            returnedAt: payload.returnedAt || null,
            project: payload.project,
            assignedTo: payload.assignedTo ?? null,
            documents: payload.documents,
          };
          return [next, ...prev];
        }
        const current = prev[idx];
        const updated: ActivityListActivity = {
          ...current,
          kind: payload.kind,
          title: payload.title,
          status: payload.status,
          updatedAt: payload.updatedAt,
          priority: payload.priority,
          dueDate: payload.dueDate || null,
          returnedNote: payload.returnedNote || null,
          returnedAt: payload.returnedAt || null,
          project: payload.project,
          assignedTo: payload.assignedTo ?? null,
          documents: payload.documents,
        };
        const next = prev.slice();
        next[idx] = updated;
        return next;
      });
    },
  });

  useEffect(() => {
    if (!isAdmin) return;
    if (realtimeState === "connected") return;
    const interval = setInterval(() => router.refresh(), 30000);
    return () => clearInterval(interval);
  }, [isAdmin, realtimeState, router]);
  const [statusFilter, setStatusFilter] = useState<string[]>(() => {
    const raw = searchParams.get("status");
    if (raw) {
      // Map legacy/simple values to DB status enums if needed
      // But searchParams from charts send exact ENUM values (PENDING, etc.)
      return raw.split(",").filter(Boolean).slice(0, 1);
    }
    return [];
  });
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>(() => {
    const raw = searchParams.get("companies");
    const companyId = searchParams.get("companyId");
    if (raw) {
      return raw.split(",").filter(Boolean);
    }
    if (companyId) {
      return [companyId];
    }
    return [];
  });
  const [companySearchInput, setCompanySearchInput] = useState(() => {
    return searchParams.get("companyQuery") || "";
  });
  const [debouncedCompanySearch, setDebouncedCompanySearch] =
    useState(companySearchInput);
  const [categoryFilter, setCategoryFilter] = useState<
    ("Vencido" | "Por vencer" | "Cumplido")[]
  >(() => {
    const priority = searchParams.get("priority");
    if (priority) {
      return [priority as "Vencido" | "Por vencer" | "Cumplido"];
    }
    return [];
  });
  const [dateRangeFilter, setDateRangeFilter] = useState<
    "all" | "7d" | "30d" | "90d"
  >(() => {
    const raw = searchParams.get("dateRange");
    if (raw === "7d" || raw === "30d" || raw === "90d") return raw;
    return "all";
  });

  // Sync internal state with URL parameters when they change
  useEffect(() => {
    const params = new URLSearchParams(searchParamsString);
    const statusParam = params.get("status");
    const priorityParam = params.get("priority");
    const companyParam = params.get("companies") || params.get("companyId");
    const queryParam = params.get("companyQuery");
    const dateRangeParam = params.get("dateRange");

    const nextStatus = statusParam ? statusParam.split(",").filter(Boolean).slice(0, 1) : [];
    const nextCategory = priorityParam ? [priorityParam as "Vencido" | "Por vencer" | "Cumplido"] : [];
    const nextCompanies = companyParam ? companyParam.split(",").filter(Boolean) : [];
    const nextQuery = queryParam || "";
    const nextDateRange =
      dateRangeParam === "7d" || dateRangeParam === "30d" || dateRangeParam === "90d" ? dateRangeParam : "all";

    const t = setTimeout(() => {
      setStatusFilter(nextStatus);
      setCategoryFilter(nextCategory);
      setSelectedCompanyIds(nextCompanies);
      setCompanySearchInput(nextQuery);
      setDebouncedCompanySearch(nextQuery);
      setDateRangeFilter(nextDateRange);
    }, 0);
    return () => clearTimeout(t);
  }, [searchParamsString]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedCompanySearch(companySearchInput);
    }, 300);
    return () => clearTimeout(handle);
  }, [companySearchInput]);

  const storageKey = "activitiesFilters:v2";
  const [isPending, startTransition] = useTransition();

  const setActivitiesUrlParams = useCallback(
    (next: {
      statuses?: string[];
      companyIds?: string[];
      companyQuery?: string;
      priority?: "Vencido" | "Por vencer" | "Cumplido" | null;
      dateRange?: "all" | "7d" | "30d" | "90d";
    }) => {
      const params = new URLSearchParams(searchParamsString);

      if (next.statuses) {
        if (next.statuses.length > 0) params.set("status", next.statuses.join(","));
        else params.delete("status");
      }

      if (next.companyIds) {
        params.delete("companyId");
        params.delete("companies");
        if (next.companyIds.length === 1) params.set("companyId", next.companyIds[0]);
        else if (next.companyIds.length > 1) params.set("companies", next.companyIds.join(","));
      }

      if (next.companyQuery !== undefined) {
        if (next.companyQuery.trim().length > 0) params.set("companyQuery", next.companyQuery);
        else params.delete("companyQuery");
      }

      if (next.priority !== undefined) {
        if (next.priority) params.set("priority", next.priority);
        else params.delete("priority");
      }

      if (next.dateRange !== undefined) {
        if (next.dateRange === "all") params.delete("dateRange");
        else params.set("dateRange", next.dateRange);
      }

      const nextQuery = params.toString();
      startTransition(() => {
        router.replace(nextQuery ? `/activities?${nextQuery}` : "/activities");
      });
    },
    [router, searchParamsString, startTransition]
  );

  useEffect(() => {
    const params = new URLSearchParams(searchParamsString);
    const current = params.get("companyQuery") || "";
    if (debouncedCompanySearch === current) return;
    setActivitiesUrlParams({ companyQuery: debouncedCompanySearch });
  }, [debouncedCompanySearch, searchParamsString, setActivitiesUrlParams]);

  useEffect(() => {
    const params = new URLSearchParams(searchParamsString);
    const statusParam = params.get("status") || "";
    const priorityParam = params.get("priority") || "";
    if (statusParam && priorityParam) {
      setActivitiesUrlParams({ priority: null });
    }
  }, [searchParamsString, setActivitiesUrlParams]);

  const setDateRange = (value: "all" | "7d" | "30d" | "90d") => {
    setDateRangeFilter(value);
    setActivitiesUrlParams({ dateRange: value });
  };

  const setCategoryFilterWithUrl = (
    next: ("Vencido" | "Por vencer" | "Cumplido")[]
  ) => {
    const normalized =
      next.length > 0 ? [next[next.length - 1]] : [];
    setCategoryFilter(normalized);
    setStatusFilter([]);
    setActivitiesUrlParams({
      statuses: [],
      priority: normalized[0] ?? null,
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasUrlFilters =
      new URLSearchParams(searchParamsString).get("status") ||
      new URLSearchParams(searchParamsString).get("priority") ||
      new URLSearchParams(searchParamsString).get("companyId") ||
      new URLSearchParams(searchParamsString).get("companies") ||
      new URLSearchParams(searchParamsString).get("companyQuery") ||
      new URLSearchParams(searchParamsString).get("dateRange");

    if (hasUrlFilters) return;

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        statuses?: string[];
        companyIds?: string[];
        companyQuery?: string;
        priority?: "Vencido" | "Por vencer" | "Cumplido" | null;
        dateRange?: "all" | "7d" | "30d" | "90d";
      };

      setActivitiesUrlParams({
        statuses: parsed.statuses,
        companyIds: parsed.companyIds,
        companyQuery: typeof parsed.companyQuery === "string" ? parsed.companyQuery : undefined,
        priority: parsed.priority,
        dateRange: parsed.dateRange,
      });
    } catch {
    }
  }, [searchParamsString, setActivitiesUrlParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = {
      statuses: statusFilter,
      companyIds: selectedCompanyIds,
      companyQuery: companySearchInput,
      priority: categoryFilter.length > 0 ? categoryFilter[0] : null,
      dateRange: dateRangeFilter,
    };

    const hasAny =
      payload.statuses.length > 0 ||
      payload.companyIds.length > 0 ||
      payload.companyQuery.trim().length > 0 ||
      payload.priority !== null ||
      payload.dateRange !== "all";

    try {
      if (!hasAny) window.localStorage.removeItem(storageKey);
      else window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
    }
  }, [
    statusFilter,
    selectedCompanyIds,
    companySearchInput,
    categoryFilter,
    dateRangeFilter,
  ]);


  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(15);

  const adminFilterResult = useMemo(
    () =>
      applyAdminActivityFilters(activities, {
        statuses: statusFilter,
        companyIds: selectedCompanyIds,
        searchTerm: debouncedCompanySearch,
        categories: categoryFilter,
        dateRange: dateRangeFilter,
        popularity: "all",
      }),
    [
      activities,
      statusFilter,
      selectedCompanyIds,
      debouncedCompanySearch,
      categoryFilter,
      dateRangeFilter,
    ]
  );

  const adminFilteredActivities = adminFilterResult.activities;
  const totalPages = Math.ceil(adminFilteredActivities.length / itemsPerPage);
  
  // Reset page when filters change or itemsPerPage changes
  useEffect(() => {
    const t = setTimeout(() => setCurrentPage(1), 0);
    return () => clearTimeout(t);
  }, [statusFilter, selectedCompanyIds, debouncedCompanySearch, categoryFilter, dateRangeFilter, itemsPerPage]);

  const paginatedActivities = useMemo(() => {
    if (itemsPerPage === 0) return adminFilteredActivities; // 0 means all
    const start = (currentPage - 1) * itemsPerPage;
    return adminFilteredActivities.slice(start, start + itemsPerPage);
  }, [adminFilteredActivities, currentPage, itemsPerPage]);

  const adminCompanies = adminFilterResult.companies;
  const adminStatusCounts = adminFilterResult.statusCounts;

  const hasStatusFilter = statusFilter.length === 1;
  const hasCompanyFilter = selectedCompanyIds.length > 0;
  const hasSearchFilter = debouncedCompanySearch.trim().length >= 2;
  const hasCategoryFilter = categoryFilter.length > 0;
  const hasDateFilter = dateRangeFilter !== "all";
  const hasAnyFilter =
    hasStatusFilter ||
    hasCompanyFilter ||
    hasSearchFilter ||
    hasCategoryFilter ||
    hasDateFilter;

  const quickCompanyValue =
    selectedCompanyIds.length === 1 ? selectedCompanyIds[0] : "all";

  const handlePreview = (activity: ActivityListActivity) => {
    if (activity.documents && activity.documents.length > 0) {
      const doc = {
        ...activity.documents[0],
        documents: activity.documents.map((d) => ({ id: d.id, name: d.name, url: d.url })),
        replies: activity.replies || [],
        activity: {
          id: activity.id,
          status: activity.status,
          title: activity.title,
          project: activity.project,
        },
      };
      setSelectedDoc(doc);
    } else {
      toast.info("No hay documentos adjuntos a esta actividad");
    }
  };

  const toggleStatus = (value: string) => {
    const next = statusFilter[0] === value ? [] : [value];
    setStatusFilter(next);
    setCategoryFilter([]);
    setActivitiesUrlParams({
      statuses: next,
      priority: null,
    });
  };

  const clearFilters = () => {
    setStatusFilter([]);
    setSelectedCompanyIds([]);
    setCompanySearchInput("");
    setCategoryFilter([]);
    setDateRangeFilter("all");
    setActivitiesUrlParams({
      statuses: [],
      companyIds: [],
      companyQuery: "",
      priority: null,
      dateRange: "all",
    });
  };

  return (
    <div className="relative">
      <CustomLoader isLoading={isPending} />
      <div
        className={`transition-all duration-300 ${
          selectedDoc ? "w-full lg:w-2/3 pr-0 lg:pr-4" : "w-full"
        }`}
      >
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle>Actividades recientes</CardTitle>
                <div
                  className={`flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${
                    hasAnyFilter
                      ? "border-[#D4AF37]/60 bg-[#D4AF37]/10 text-[#A27F1A]"
                      : "border-zinc-200 text-slate-500"
                  }`}
                >
                  <Filter className="h-3 w-3" />
                  <span>
                    {hasAnyFilter ? "Filtros activos" : "Sin filtros"}
                  </span>
                </div>
                <AdvancedHeaderFilters
                  statusFilter={statusFilter}
                  onToggleStatus={toggleStatus}
                  categoryFilter={categoryFilter}
                  setCategoryFilter={setCategoryFilterWithUrl}
                  dateRangeFilter={dateRangeFilter}
                  setDateRangeFilter={setDateRange}
                  hasAnyFilter={hasAnyFilter}
                  onClearFilters={clearFilters}
                  canClear={hasAnyFilter}
                  isCompact={isCompactFilters}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative flex-1 max-w-md">
                      <Input
                        value={companySearchInput}
                        onChange={(e) => setCompanySearchInput(e.target.value)}
                        placeholder="Buscar empresa por nombre o NIT..."
                        className="h-11 rounded-2xl border-[#D4AF37]/60 bg-white/90 pr-10 text-base shadow-sm hover:border-[#D4AF37] sm:h-10 sm:text-sm lg:h-9 lg:text-xs"
                      />
                      <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                    <div className="w-full sm:w-64">
                      <Select
                        value={quickCompanyValue}
                        onValueChange={(value) => {
                          if (value === "all") {
                            setSelectedCompanyIds([]);
                            setActivitiesUrlParams({ companyIds: [] });
                          } else {
                            setSelectedCompanyIds([value]);
                            setActivitiesUrlParams({ companyIds: [value] });
                          }
                        }}
                      >
                        <SelectTrigger className="mt-1 h-11 w-full rounded-2xl border-[#D4AF37]/60 bg-white/90 text-base shadow-sm hover:border-[#D4AF37] sm:mt-0 sm:h-10 sm:text-sm lg:h-9 lg:text-xs">
                          <SelectValue placeholder="Seleccionar empresa" />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          <SelectItem value="all">Todas las empresas</SelectItem>
                          {adminCompanies.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name}
                              {company.nit ? ` · NIT ${company.nit}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {adminStatusCounts.total} actividades
                  </span>
                  {isAdmin && (
                    <span
                      className={[
                        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px]",
                        realtimeState === "connected"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : realtimeState === "reconnecting"
                            ? "border-yellow-200 bg-yellow-50 text-yellow-800"
                            : "border-slate-200 bg-slate-50 text-slate-600",
                      ].join(" ")}
                      title={
                        realtimeState === "connected"
                          ? "Canal en tiempo real activo"
                          : realtimeState === "reconnecting"
                            ? "Reconectando..."
                            : "Conectando..."
                      }
                    >
                      <span
                        className={[
                          "h-2 w-2 rounded-full",
                          realtimeState === "connected"
                            ? "bg-emerald-500"
                            : realtimeState === "reconnecting"
                              ? "bg-yellow-500"
                              : "bg-slate-400",
                        ].join(" ")}
                      />
                      Tiempo real
                    </span>
                  )}
                </div>
                {isCompactFilters ? (
                  <div className="w-full space-y-3">
                    {paginatedActivities.map((activity) => {
                      const info = getActivityPriorityInfo(
                        activity.priority,
                        activity.title,
                        activity.dueDate,
                        activity.status
                      );
                      return (
                        <div
                          key={activity.id}
                          data-activity-id={activity.id}
                          className={[
                            "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm",
                            highlightedId === activity.id
                              ? "ring-2 ring-[#D4AF37] ring-offset-2 ring-offset-white"
                              : "",
                            realtimeNewIds[activity.id]
                              ? "animate-in fade-in slide-in-from-top-1 bg-emerald-50/50"
                              : "",
                          ].join(" ")}
                        >
                          <div className="min-w-0">
                            <div className="break-words text-base font-semibold leading-snug text-slate-950">
                              {activity.title}
                            </div>
                            <div className="mt-1 break-words text-sm text-slate-600">
                              {activity.project.name}
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {activity.dueDate ? (
                              <span
                                className={`inline-flex min-w-[96px] items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${getPriorityBadgeClass(
                                  info.label
                                )}`}
                              >
                                {info.label}
                              </span>
                            ) : (
                              <span className="inline-flex min-w-[160px] items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                                Sin fecha establecida
                              </span>
                            )}
                            <Badge
                              variant={
                                activity.status === "APPROVED"
                                  ? "default"
                                  : activity.status === "IN_REVIEW"
                                    ? "secondary"
                                    : activity.status === "REJECTED"
                                      ? "destructive"
                                      : "outline"
                              }
                              className={
                                activity.status === "APPROVED"
                                  ? "bg-green-600 hover:bg-green-700"
                                  : activity.status === "IN_REVIEW"
                                    ? "bg-blue-600 text-white hover:bg-blue-700"
                                    : activity.status === "REJECTED"
                                      ? "bg-red-600 text-white hover:bg-red-700"
                                      : "text-primary border-primary"
                              }
                            >
                              {activity.status === "APPROVED"
                                ? "APROBADA"
                                : activity.status === "IN_REVIEW"
                                  ? "EN REVISIÓN"
                                  : activity.status === "REJECTED"
                                    ? "RECHAZADA"
                                    : "PENDIENTE"}
                            </Badge>
                            <span className="text-sm text-slate-600">
                              Asignado: {activity.assignedTo?.name || "Sin asignar"}
                            </span>
                            <span className="text-sm text-slate-600">
                              Periodicidad: {activity.periodicity || "-"}
                            </span>
                          </div>

                          <div className="mt-3">
                            {activity.kind === "ACCIDENTALIDAD" ? (
                              <AccidentalidadStatusActions
                                accidentalidadId={activity.id}
                                status={activity.status}
                                userRole={userRole}
                                title={activity.title}
                                projectName={activity.project?.name}
                                dueDate={activity.dueDate}
                                documents={activity.documents}
                                onPreview={() => handlePreview(activity)}
                              />
                            ) : (
                              <ActivityStatusActions
                                id={activity.id}
                                status={activity.status}
                                userRole={userRole}
                                title={activity.title}
                                projectName={activity.project?.name}
                                dueDate={activity.dueDate}
                                documents={activity.documents}
                                onPreview={() => handlePreview(activity)}
                                rejectionReason={activity.rejectionReason}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {paginatedActivities.length === 0 && (
                      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-base text-slate-600">
                        No hay actividades para los filtros seleccionados.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Actividad</TableHead>
                          <TableHead>Empresa</TableHead>
                          <TableHead>Periodicidad</TableHead>
                          <TableHead>Prioridad</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Asignado a</TableHead>
                          <TableHead>Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="transition-opacity duration-300">
                        {paginatedActivities.map((activity) => (
                          <TableRow
                            key={activity.id}
                            data-activity-id={activity.id}
                            className={
                              [
                                selectedDoc?.activity?.title === activity.title ? "bg-muted/50" : "",
                                highlightedId === activity.id
                                  ? "ring-2 ring-[#D4AF37] ring-offset-2 ring-offset-white"
                                  : "",
                                realtimeNewIds[activity.id]
                                  ? "animate-in fade-in slide-in-from-top-1 bg-emerald-50/60"
                                  : "",
                              ].join(" ")
                            }
                          >
                            <TableCell className="font-medium">{activity.title}</TableCell>
                            <TableCell>{activity.project.name}</TableCell>
                            <TableCell>{activity.periodicity || "-"}</TableCell>
                            <TableCell>
                              {(() => {
                                const info = getActivityPriorityInfo(
                                  activity.priority,
                                  activity.title,
                                  activity.dueDate,
                                  activity.status
                                );
                                return (
                                  activity.dueDate ? (
                                    <span
                                      className={`inline-flex min-w-[96px] items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${getPriorityBadgeClass(
                                        info.label
                                      )}`}
                                    >
                                      {info.label}
                                    </span>
                                  ) : (
                                    <span className="inline-flex min-w-[160px] items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                                      Sin fecha establecida
                                    </span>
                                  )
                                );
                              })()}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  activity.status === "APPROVED"
                                    ? "default"
                                    : activity.status === "IN_REVIEW"
                                      ? "secondary"
                                      : activity.status === "REJECTED"
                                        ? "destructive"
                                        : "outline"
                                }
                                className={
                                  activity.status === "APPROVED"
                                    ? "bg-green-600 hover:bg-green-700"
                                    : activity.status === "IN_REVIEW"
                                      ? "bg-blue-600 text-white hover:bg-blue-700"
                                      : activity.status === "REJECTED"
                                        ? "bg-red-600 text-white hover:bg-red-700"
                                        : "text-primary border-primary"
                                }
                              >
                                {activity.status === "APPROVED"
                                  ? "APROBADA"
                                  : activity.status === "IN_REVIEW"
                                    ? "EN REVISIÓN"
                                    : activity.status === "REJECTED"
                                      ? "RECHAZADA"
                                      : "PENDIENTE"}
                              </Badge>
                            </TableCell>
                            <TableCell>{activity.assignedTo?.name || "Sin Asignar"}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {activity.kind === "ACCIDENTALIDAD" ? (
                                  <AccidentalidadStatusActions
                                    accidentalidadId={activity.id}
                                    status={activity.status}
                                    userRole={userRole}
                                    title={activity.title}
                                    projectName={activity.project?.name}
                                    dueDate={activity.dueDate}
                                    documents={activity.documents}
                                    onPreview={() => handlePreview(activity)}
                                  />
                                ) : (
                                  <ActivityStatusActions
                                    id={activity.id}
                                    status={activity.status}
                                    userRole={userRole}
                                    title={activity.title}
                                    projectName={activity.project?.name}
                                    dueDate={activity.dueDate}
                                    documents={activity.documents}
                                    onPreview={() => handlePreview(activity)}
                                    rejectionReason={activity.rejectionReason}
                                  />
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {paginatedActivities.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={7}
                              className="py-4 text-center text-sm text-muted-foreground"
                            >
                              No hay actividades para los filtros seleccionados.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
                
                {/* Pagination Controls */}
                <div className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">Mostrar:</span>
                    <Select
                      value={itemsPerPage.toString()}
                      onValueChange={(val) => setItemsPerPage(Number(val))}
                    >
                      <SelectTrigger className="h-11 w-[86px] text-base sm:h-10 sm:text-sm lg:h-8 lg:text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15</SelectItem>
                        <SelectItem value="30">30</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600 mr-2 sm:mr-4">
                        Página {currentPage} de {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="h-11 w-11 p-0 sm:h-10 sm:w-10 lg:h-8 lg:w-8"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="h-11 w-11 p-0 sm:h-10 sm:w-10 lg:h-8 lg:w-8"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
          </CardContent>
        </Card>
      </div>

      {selectedDoc && (
        <DocumentPreview
          key={selectedDoc.id}
          document={selectedDoc}
          documents={selectedDoc.documents}
          replies={selectedDoc.replies}
          onClose={() => setSelectedDoc(null)}
          currentUserRole={userRole}
        />
      )}
    </div>
  );
}

type AdminFilterCompany = {
  id: string;
  name: string;
  nit: string | null;
  count: number;
};

type AdminFilterStatusCounts = {
  PENDING: number;
  IN_REVIEW: number;
  APPROVED: number;
  REJECTED: number;
  total: number;
};

export function applyAdminActivityFilters(
  activities: ActivityListActivity[],
  options: {
    statuses: string[];
    companyIds: string[];
    searchTerm: string;
    categories?: ("Vencido" | "Por vencer" | "Cumplido")[];
    dateRange?: "all" | "7d" | "30d" | "90d";
    popularity?: "all" | "withDocs";
  }
): {
  activities: ActivityListActivity[];
  companies: AdminFilterCompany[];
  statusCounts: AdminFilterStatusCounts;
} {
  const allStatusValues = ["PENDING", "IN_REVIEW", "APPROVED", "REJECTED"];
  const companyMap = new Map<string, AdminFilterCompany>();

  activities.forEach((activity) => {
    const projectId = activity.project?.id || "no-project";
    const name = activity.project?.name || "Sin empresa";
    const nit = typeof activity.project?.nit === "string" ? activity.project.nit : null;
    const existing = companyMap.get(projectId);
    if (existing) {
      existing.count += 1;
    } else {
      companyMap.set(projectId, {
        id: projectId,
        name,
        nit,
        count: 1,
      });
    }
  });

  const companies = Array.from(companyMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "es")
  );

  let filtered = activities;

  if (options.companyIds.length > 0) {
    const set = new Set(options.companyIds);
    filtered = filtered.filter((activity) =>
      set.has(activity.project?.id || "")
    );
  }

  const term = options.searchTerm.trim().toLowerCase();
  if (term.length >= 2) {
    filtered = filtered.filter((activity) => {
      const name = (activity.project?.name || "").toLowerCase();
      const nit = typeof activity.project?.nit === "string" ? activity.project.nit.toLowerCase() : "";
      return name.includes(term) || nit.includes(term);
    });
  }

  const dateRange = options.dateRange || "all";
  if (dateRange !== "all") {
    const now = new Date();
    const cutoff = new Date(now);
    if (dateRange === "7d") {
      cutoff.setDate(now.getDate() - 7);
    } else if (dateRange === "30d") {
      cutoff.setDate(now.getDate() - 30);
    } else if (dateRange === "90d") {
      cutoff.setDate(now.getDate() - 90);
    }
    filtered = filtered.filter((activity) => {
      const value = activity.updatedAt;
      const date =
        value instanceof Date ? value : value ? new Date(value) : null;
      if (!date) return false;
      return date >= cutoff;
    });
  }

  const categories = options.categories || [];
  if (categories.length > 0) {
    const set = new Set(categories);
    filtered = filtered.filter((activity) => {
      const info = getActivityPriorityInfo(
        activity.priority,
        activity.title || "",
        activity.dueDate,
        activity.status
      );
      return set.has(info.label);
    });
  }

  const popularity = options.popularity || "all";
  if (popularity === "withDocs") {
    filtered = filtered.filter(
      (activity) => activity.documents && activity.documents.length > 0
    );
  }

  const counts: AdminFilterStatusCounts = {
    PENDING: 0,
    IN_REVIEW: 0,
    APPROVED: 0,
    REJECTED: 0,
    total: 0,
  };

  filtered.forEach((activity) => {
    if (activity.status === "PENDING") {
      counts.PENDING += 1;
    } else if (activity.status === "IN_REVIEW") {
      counts.IN_REVIEW += 1;
    } else if (activity.status === "APPROVED") {
      counts.APPROVED += 1;
    } else if (activity.status === "REJECTED") {
      counts.REJECTED += 1;
    }
    counts.total += 1;
  });

  const normalizedStatuses = options.statuses.filter((s) =>
    allStatusValues.includes(s)
  );
  const hasStatusFilter =
    normalizedStatuses.length > 0 &&
    normalizedStatuses.length < allStatusValues.length;

  if (hasStatusFilter) {
    const set = new Set(normalizedStatuses);
    filtered = filtered.filter((activity) => set.has(activity.status));
  }

  return {
    activities: filtered,
    companies,
    statusCounts: counts,
  };
}

interface AdvancedHeaderFiltersProps {
  statusFilter: string[];
  onToggleStatus: (value: string) => void;
  categoryFilter: ("Vencido" | "Por vencer" | "Cumplido")[];
  setCategoryFilter: (value: ("Vencido" | "Por vencer" | "Cumplido")[]) => void;
  dateRangeFilter: "all" | "7d" | "30d" | "90d";
  setDateRangeFilter: (value: "all" | "7d" | "30d" | "90d") => void;
  hasAnyFilter: boolean;
  onClearFilters: () => void;
  canClear: boolean;
  isCompact?: boolean;
}

function AdvancedHeaderFilters({
  statusFilter,
  onToggleStatus,
  categoryFilter,
  setCategoryFilter,
  dateRangeFilter,
  setDateRangeFilter,
  hasAnyFilter,
  onClearFilters,
  canClear,
  isCompact,
}: AdvancedHeaderFiltersProps) {
  const toggleCategory = (value: "Vencido" | "Por vencer" | "Cumplido") => {
    setCategoryFilter(categoryFilter[0] === value ? [] : [value]);
  };

  const [open, setOpen] = useState(false);
  const [openSection, setOpenSection] = useState<{
    status: boolean;
    category: boolean;
    date: boolean;
  }>({ status: true, category: false, date: false });

  const selectedCount =
    (statusFilter.length ? 1 : 0) +
    (categoryFilter.length ? 1 : 0) +
    (dateRangeFilter !== "all" ? 1 : 0);

  const sectionBodyClass = (enabled: boolean) =>
    [
      "grid overflow-hidden transition-all",
      enabled
        ? "grid-rows-[1fr] opacity-100 duration-[360ms]"
        : "grid-rows-[0fr] opacity-0 duration-[300ms]",
    ].join(" ");

  const optionClass = (active: boolean) =>
    [
      "min-h-11 rounded-xl border px-4 text-base font-semibold transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 focus-visible:ring-offset-white",
      active
        ? "border-[#D4AF37] bg-[#D4AF37] text-black"
        : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
    ].join(" ");

  if (isCompact) {
    return (
      <div className="flex items-center">
        <Button
          type="button"
          variant="outline"
          className={[
            "h-11 rounded-2xl border-[#D4AF37]/60 bg-white/90 px-4 text-base shadow-sm",
            "hover:border-[#D4AF37] hover:bg-white",
          ].join(" ")}
          onClick={() => setOpen(true)}
        >
          <Filter className="mr-2 h-4 w-4" />
          Filtros
          {selectedCount > 0 && (
            <span className="ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#D4AF37] px-2 text-sm font-semibold text-black">
              {selectedCount}
            </span>
          )}
        </Button>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className={[
              "h-[80vh] rounded-t-3xl border-t border-[#D4AF37]/25 p-0",
              "data-[state=open]:duration-[380ms] data-[state=closed]:duration-[320ms]",
            ].join(" ")}
          >
            <SheetHeader className="border-b border-slate-200">
              <SheetTitle className="text-base font-semibold text-slate-950">
                Filtros
              </SheetTitle>
              <div className="mt-2 flex flex-wrap gap-2">
                {statusFilter.length > 0 && (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700">
                    Estado:{" "}
                    {statusFilter[0] === "PENDING"
                      ? "Pendiente"
                      : statusFilter[0] === "IN_REVIEW"
                        ? "En revisión"
                        : statusFilter[0] === "REJECTED"
                          ? "Rechazada"
                          : "Aprobada"}
                  </span>
                )}
                {categoryFilter.length > 0 && (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700">
                    Categoría: {categoryFilter[0]}
                  </span>
                )}
                {dateRangeFilter !== "all" && (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700">
                    Fecha:{" "}
                    {dateRangeFilter === "7d"
                      ? "7 días"
                      : dateRangeFilter === "30d"
                        ? "30 días"
                        : "90 días"}
                  </span>
                )}
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center justify-between px-4 py-3 text-left text-base font-semibold text-slate-950"
                    aria-expanded={openSection.status}
                    onClick={() =>
                      setOpenSection((s) => ({ ...s, status: !s.status }))
                    }
                  >
                    <span>Estado</span>
                    <span className="text-sm text-slate-500">
                      {openSection.status ? "Cerrar" : "Abrir"}
                    </span>
                  </button>
                  <div className={sectionBodyClass(openSection.status)}>
                    <div className="overflow-hidden px-4 pb-4">
                      <div className="grid grid-cols-1 gap-2">
                        <button
                          type="button"
                          onClick={() => onToggleStatus("PENDING")}
                          aria-pressed={statusFilter.includes("PENDING")}
                          className={optionClass(statusFilter.includes("PENDING"))}
                        >
                          Pendiente
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleStatus("IN_REVIEW")}
                          aria-pressed={statusFilter.includes("IN_REVIEW")}
                          className={optionClass(statusFilter.includes("IN_REVIEW"))}
                        >
                          En revisión
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleStatus("REJECTED")}
                          aria-pressed={statusFilter.includes("REJECTED")}
                          className={optionClass(statusFilter.includes("REJECTED"))}
                        >
                          Rechazada
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleStatus("APPROVED")}
                          aria-pressed={statusFilter.includes("APPROVED")}
                          className={optionClass(statusFilter.includes("APPROVED"))}
                        >
                          Aprobada
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center justify-between px-4 py-3 text-left text-base font-semibold text-slate-950"
                    aria-expanded={openSection.category}
                    onClick={() =>
                      setOpenSection((s) => ({ ...s, category: !s.category }))
                    }
                  >
                    <span>Categoría</span>
                    <span className="text-sm text-slate-500">
                      {openSection.category ? "Cerrar" : "Abrir"}
                    </span>
                  </button>
                  <div className={sectionBodyClass(openSection.category)}>
                    <div className="overflow-hidden px-4 pb-4">
                      <div className="grid grid-cols-1 gap-2">
                        <button
                          type="button"
                          onClick={() => toggleCategory("Vencido")}
                          aria-pressed={categoryFilter.includes("Vencido")}
                          className={optionClass(categoryFilter.includes("Vencido"))}
                        >
                          Vencido
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleCategory("Por vencer")}
                          aria-pressed={categoryFilter.includes("Por vencer")}
                          className={optionClass(categoryFilter.includes("Por vencer"))}
                        >
                          Por vencer
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleCategory("Cumplido")}
                          aria-pressed={categoryFilter.includes("Cumplido")}
                          className={optionClass(categoryFilter.includes("Cumplido"))}
                        >
                          Cumplido
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center justify-between px-4 py-3 text-left text-base font-semibold text-slate-950"
                    aria-expanded={openSection.date}
                    onClick={() =>
                      setOpenSection((s) => ({ ...s, date: !s.date }))
                    }
                  >
                    <span>Fecha</span>
                    <span className="text-sm text-slate-500">
                      {openSection.date ? "Cerrar" : "Abrir"}
                    </span>
                  </button>
                  <div className={sectionBodyClass(openSection.date)}>
                    <div className="overflow-hidden px-4 pb-4">
                      <div className="grid grid-cols-1 gap-2">
                        <button
                          type="button"
                          onClick={() => setDateRangeFilter("all")}
                          aria-pressed={dateRangeFilter === "all"}
                          className={optionClass(dateRangeFilter === "all")}
                        >
                          Todas
                        </button>
                        <button
                          type="button"
                          onClick={() => setDateRangeFilter("7d")}
                          aria-pressed={dateRangeFilter === "7d"}
                          className={optionClass(dateRangeFilter === "7d")}
                        >
                          7 días
                        </button>
                        <button
                          type="button"
                          onClick={() => setDateRangeFilter("30d")}
                          aria-pressed={dateRangeFilter === "30d"}
                          className={optionClass(dateRangeFilter === "30d")}
                        >
                          30 días
                        </button>
                        <button
                          type="button"
                          onClick={() => setDateRangeFilter("90d")}
                          aria-pressed={dateRangeFilter === "90d"}
                          className={optionClass(dateRangeFilter === "90d")}
                        >
                          90 días
                        </button>
                      </div>
                    </div>
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
                  onClick={onClearFilters}
                  disabled={!canClear}
                >
                  Limpiar
                </Button>
                <Button
                  type="button"
                  className="h-11 flex-1 rounded-xl bg-[#D4AF37] text-base font-semibold text-black hover:bg-[#B59530]"
                  onClick={() => setOpen(false)}
                >
                  Ver resultados
                </Button>
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="flex items-center">
      <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-2xl bg-gradient-to-r from-[#FDF7E3] via-white to-[#F5E3B3] px-3 py-2 text-xs text-slate-700 shadow-[0_10px_30px_rgba(0,0,0,0.12)] ring-1 ring-white/60 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(0,0,0,0.18)]">
        <div className="flex items-center gap-1 pr-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#D4AF37]/90 text-[11px] font-semibold text-black shadow-[0_4px_10px_rgba(0,0,0,0.25)]">
            <Filter className="h-3 w-3" aria-hidden="true" />
          </span>
          <span className="whitespace-nowrap text-sm font-semibold">
            Filtros avanzados
          </span>
          {hasAnyFilter && (
            <span className="ml-1 inline-flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1 border-l border-yellow-200/60 pl-2">
          <span className="mr-1 text-[11px] uppercase tracking-wide text-slate-500">
            Estado
          </span>
          <button
            type="button"
            onClick={() => onToggleStatus("PENDING")}
            aria-pressed={statusFilter.includes("PENDING")}
            className={`rounded-full px-2 py-1 text-[11px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 ${
              statusFilter.includes("PENDING")
                ? "bg-[#D4AF37] text-black shadow-md"
                : "bg-white/70 text-slate-700 hover:bg-yellow-50"
            }`}
          >
            Pendiente
          </button>
          <button
            type="button"
            onClick={() => onToggleStatus("IN_REVIEW")}
            aria-pressed={statusFilter.includes("IN_REVIEW")}
            className={`rounded-full px-2 py-1 text-[11px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 ${
              statusFilter.includes("IN_REVIEW")
                ? "bg-[#D4AF37] text-black shadow-md"
                : "bg-white/70 text-slate-700 hover:bg-yellow-50"
            }`}
          >
            En revisión
          </button>
          <button
            type="button"
            onClick={() => onToggleStatus("REJECTED")}
            aria-pressed={statusFilter.includes("REJECTED")}
            className={`rounded-full px-2 py-1 text-[11px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 ${
              statusFilter.includes("REJECTED")
                ? "bg-[#D4AF37] text-black shadow-md"
                : "bg-white/70 text-slate-700 hover:bg-yellow-50"
            }`}
          >
            Rechazada
          </button>
          <button
            type="button"
            onClick={() => onToggleStatus("APPROVED")}
            aria-pressed={statusFilter.includes("APPROVED")}
            className={`rounded-full px-2 py-1 text-[11px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 ${
              statusFilter.includes("APPROVED")
                ? "bg-[#D4AF37] text-black shadow-md"
                : "bg-white/70 text-slate-700 hover:bg-yellow-50"
            }`}
          >
            Aprobada
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1 border-l border-yellow-200/60 pl-2">
          <span className="mr-1 text-[11px] uppercase tracking-wide text-slate-500">
            Categoría
          </span>
          <button
            type="button"
            onClick={() => toggleCategory("Vencido")}
            aria-pressed={categoryFilter.includes("Vencido")}
            className={`rounded-full px-2 py-1 text-[11px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 ${
              categoryFilter.includes("Vencido")
                ? "bg-red-500 text-white shadow-md"
                : "bg-white/70 text-slate-700 hover:bg-rose-50"
            }`}
          >
            Vencido
          </button>
          <button
            type="button"
            onClick={() => toggleCategory("Por vencer")}
            aria-pressed={categoryFilter.includes("Por vencer")}
            className={`rounded-full px-2 py-1 text-[11px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 ${
              categoryFilter.includes("Por vencer")
                ? "bg-yellow-400 text-black shadow-md"
                : "bg-white/70 text-slate-700 hover:bg-yellow-50"
            }`}
          >
            Por vencer
          </button>
          <button
            type="button"
            onClick={() => toggleCategory("Cumplido")}
            aria-pressed={categoryFilter.includes("Cumplido")}
            className={`rounded-full px-2 py-1 text-[11px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 ${
              categoryFilter.includes("Cumplido")
                ? "bg-emerald-400 text-black shadow-md"
                : "bg-white/70 text-slate-700 hover:bg-emerald-50"
            }`}
          >
            Cumplido
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1 border-l border-yellow-200/60 pl-2">
          <span className="mr-1 text-[11px] uppercase tracking-wide text-slate-500">
            Fecha
          </span>
          <button
            type="button"
            onClick={() => setDateRangeFilter("all")}
            aria-pressed={dateRangeFilter === "all"}
            className={`rounded-full px-2 py-1 text-[11px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 ${
              dateRangeFilter === "all"
                ? "bg-slate-900 text-white shadow-md"
                : "bg-white/70 text-slate-700 hover:bg-slate-100"
            }`}
          >
            Todas
          </button>
          <button
            type="button"
            onClick={() => setDateRangeFilter("7d")}
            aria-pressed={dateRangeFilter === "7d"}
            className={`rounded-full px-2 py-1 text-[11px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 ${
              dateRangeFilter === "7d"
                ? "bg-slate-900 text-white shadow-md"
                : "bg-white/70 text-slate-700 hover:bg-slate-100"
            }`}
          >
            7 días
          </button>
          <button
            type="button"
            onClick={() => setDateRangeFilter("30d")}
            aria-pressed={dateRangeFilter === "30d"}
            className={`rounded-full px-2 py-1 text-[11px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 ${
              dateRangeFilter === "30d"
                ? "bg-slate-900 text-white shadow-md"
                : "bg-white/70 text-slate-700 hover:bg-slate-100"
            }`}
          >
            30 días
          </button>
          <button
            type="button"
            onClick={() => setDateRangeFilter("90d")}
            aria-pressed={dateRangeFilter === "90d"}
            className={`rounded-full px-2 py-1 text-[11px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 ${
              dateRangeFilter === "90d"
                ? "bg-slate-900 text-white shadow-md"
                : "bg-white/70 text-slate-700 hover:bg-slate-100"
            }`}
          >
            90 días
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1 border-l border-yellow-200/60 pl-2">
          <button
            type="button"
            onClick={onClearFilters}
            disabled={!canClear}
            className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm transition-all duration-200 hover:border-[#D4AF37] hover:text-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Limpiar filtros
          </button>
        </div>
      </div>
    </div>
  );
}
