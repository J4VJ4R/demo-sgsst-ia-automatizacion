"use client";

import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPriorityBadgeClass, translatePriority } from "@/lib/utils";
import { calculatePriority } from "@/lib/priority-logic";
import { canEditDueDate } from "@/lib/permissions";
import { RequirementActions } from "@/components/activities/requirement-actions";
import { CollaboratorActivityActions } from "@/components/activities/collaborator-activity-actions";
import { useRealTimeRefresh } from "@/hooks/use-real-time-refresh";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

type PriorityLevel = "Vencido" | "Por vencer" | "Cumplido";

export interface CollaboratorActivityForTable {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  dueDate: string | null;
  periodicity: string | null;
  documents: {
    id: string;
    name: string;
    url: string;
    uploadedAt: string;
    version: number;
    sizeBytes: number | null;
    uploadedByUser?: {
      name: string | null;
      role?: string | null;
    } | null;
  }[];
}

interface CollaboratorActivitiesTableProps {
  activities: CollaboratorActivityForTable[];
  collaboratorProjectName: string;
  canManageActivities: boolean;
  isAdmin: boolean;
  userRole?: string; // Added userRole
  defaultPriorityWhenNoDueDate?: PriorityLevel;
  onUpdateDueDate: (
    activityId: string,
    dueDate: string | null
  ) => Promise<{ success?: boolean; error?: string }>;
}

export function CollaboratorActivitiesTable({
  activities,
  collaboratorProjectName,
  canManageActivities,
  isAdmin,
  userRole, // Added userRole
  defaultPriorityWhenNoDueDate,
  onUpdateDueDate,
}: CollaboratorActivitiesTableProps) {
  // Refresh data every 5 seconds to show updates (e.g. status changes from admin)
  useRealTimeRefresh(5000);

  const [now, setNow] = useState<Date>(new Date());
  const [localDueDates, setLocalDueDates] = useState<Record<string, string | null>>(
    () =>
      Object.fromEntries(
        activities.map((a) => [a.id, a.dueDate])
      )
  );
  const [priorityFilter, setPriorityFilter] = useState<PriorityLevel | "Todas">(
    "Todas"
  );
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorByActivity, setErrorByActivity] = useState<Record<string, string>>(
    {}
  );
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;
  const [isCompact, setIsCompact] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(max-width: 1023px)").matches;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(max-width: 1023px)");
    const apply = () => setIsCompact(media.matches);
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    setLocalDueDates(
      Object.fromEntries(
        activities.map((a) => [a.id, a.dueDate])
      )
    );
  }, [activities]);

  const computedRows = useMemo(() => {
    return activities.map((activity) => {
      const effectiveDue =
        localDueDates[activity.id] !== undefined
          ? localDueDates[activity.id]
          : activity.dueDate;

      const fallbackPriority = translatePriority(activity.priority) as PriorityLevel;
      let priority: PriorityLevel = activity.status === "APPROVED" ? "Cumplido" : fallbackPriority;
      if (!effectiveDue && activity.status !== "APPROVED" && defaultPriorityWhenNoDueDate) {
        priority = defaultPriorityWhenNoDueDate;
      }

      // If effectiveDue is present, calculate priority dynamically
      if (activity.status !== "APPROVED" && effectiveDue) {
        const datePart = effectiveDue.includes('T') ? effectiveDue.split('T')[0] : effectiveDue;
        const [y, m, d] = datePart.split('-').map(Number);
        
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
            // Create date in local time 00:00:00 to avoid timezone shifts
            const dateObj = new Date(y, m - 1, d);
            const result = calculatePriority(dateObj, now);
            if (result.isValid) priority = result.priority;
        }
      }

      return {
        activity,
        effectiveDue,
        priority, // This is the dynamic priority based on the edited date
      };
    });
  }, [activities, localDueDates, now, defaultPriorityWhenNoDueDate]);

  const filteredRows = useMemo(() => {
    if (priorityFilter === "Todas") {
      return computedRows;
    }
    return computedRows.filter((row) => row.priority === priorityFilter);
  }, [computedRows, priorityFilter]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [priorityFilter]);

  const totalPages = Math.ceil(filteredRows.length / ITEMS_PER_PAGE);
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRows.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredRows, currentPage]);

  const handleDueDateChange = async (activityId: string, value: string) => {
    const trimmed = value.trim();
    // If empty, user is clearing it
    const newValue = trimmed.length === 0 ? null : trimmed;

    // Update local state immediately for responsiveness
    setLocalDueDates((prev) => ({
      ...prev,
      [activityId]: newValue,
    }));
    
    // Clear previous errors
    setErrorByActivity((prev) => ({
      ...prev,
      [activityId]: "",
    }));

    if (newValue) {
      const [y, m, d] = newValue.split('-').map(Number);
      // Construct date in local time 00:00:00
      const parsed = new Date(y, m - 1, d);
      
      const priorityResult = calculatePriority(parsed);
      
      if (!priorityResult.isValid && !priorityResult.priority) {
         // If truly invalid
         const errorMsg = priorityResult.error || "Fecha inválida";
         setErrorByActivity((prev) => ({
           ...prev,
           [activityId]: errorMsg,
         }));
         toast.error(errorMsg);
         return;
      }
    }

    setUpdatingId(activityId);
    try {
      const result = await onUpdateDueDate(activityId, newValue);
      if (!result.success) {
        // Revert local change if server fails
        setLocalDueDates((prev) => ({
            ...prev,
            [activityId]: activities.find(a => a.id === activityId)?.dueDate || null
        }));
        
        const msg = result.error || "Error al actualizar fecha.";
        setErrorByActivity((prev) => ({
          ...prev,
          [activityId]: msg,
        }));
        toast.error(msg);
      } else {
        toast.success("Fecha actualizada correctamente");
      }
    } catch (error) {
      console.error("Error en handleDueDateChange:", error);
      const message = "Error al guardar la fecha de vencimiento.";
      setErrorByActivity((prev) => ({
        ...prev,
        [activityId]: message,
      }));
      toast.error(message);
    } finally {
      setUpdatingId((prev) => (prev === activityId ? null : prev));
    }
  };

  const formatDateForInput = (value: string | null) => {
    if (!value) return "";
    if (value.length >= 10) {
      return value.slice(0, 10);
    }
    return value;
  };

  const formatDateForDisplay = (value: string | null) => {
    if (!value) return "Sin asignar";
    // Handle both ISO strings and YYYY-MM-DD
    const datePart = value.includes('T') ? value.split('T')[0] : value;
    const parts = datePart.split('-');
    if (parts.length === 3) {
        const [y, m, d] = parts;
        return `${d}/${m}/${y}`;
    }
    return value;
  };

  const getStatusLabel = (status: string, hasDocuments: boolean) => {
    if (status === "APPROVED") {
      return {
        label: "Completada",
        variant: "default" as const,
        className: "bg-green-600 text-white hover:bg-green-700",
      };
    }
    if (status === "REJECTED") {
      return {
        label: "Rechazada",
        variant: "destructive" as const,
        className: "bg-red-600 text-white hover:bg-red-700",
      };
    }
    if (status === "IN_REVIEW" || hasDocuments) {
      return {
        label: "En revisión",
        variant: "secondary" as const,
        className: "bg-blue-600 text-white hover:bg-blue-700",
      };
    }
    return {
      label: "Pendiente",
      variant: "outline" as const,
      className: "text-yellow-700 border-yellow-200 bg-yellow-50/40",
    };
  };

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-sm text-muted-foreground">
          Filtra por prioridad para ver primero las actividades urgentes del
          colaborador en <span className="font-medium">{collaboratorProjectName}</span>.
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
          <span className="text-sm text-slate-500">Prioridad:</span>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2">
            {(["Todas", "Vencido", "Por vencer", "Cumplido"] as const).map((level) => {
              const isActive = priorityFilter === level;
              let extraClasses =
                "text-slate-600 hover:bg-slate-100 hover:text-slate-900";
              if (level === "Vencido") {
                extraClasses =
                  "text-red-800 hover:bg-red-50 data-[active=true]:bg-red-600 data-[active=true]:text-white";
              } else if (level === "Por vencer") {
                extraClasses =
                  "text-yellow-800 hover:bg-yellow-50 data-[active=true]:bg-yellow-400 data-[active=true]:text-black";
              } else if (level === "Cumplido") {
                extraClasses =
                  "text-emerald-800 hover:bg-emerald-50 data-[active=true]:bg-emerald-400 data-[active=true]:text-black";
              }
              return (
                <Button
                  key={level}
                  type="button"
                  data-active={isActive ? "true" : "false"}
                  variant="ghost"
                  className={`h-11 rounded-xl px-4 text-base font-semibold sm:h-9 sm:text-sm ${extraClasses}`}
                  onClick={() => setPriorityFilter(level)}
                >
                  {level}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {isCompact ? (
        <div className="space-y-3">
          {paginatedRows.map(({ activity, effectiveDue, priority }) => {
            const hasDocuments = activity.documents.length > 0;
            const latestDoc = hasDocuments ? activity.documents[0] : null;
            const statusInfo = getStatusLabel(activity.status, hasDocuments);
            const priorityClassName = getPriorityBadgeClass(priority);

            return (
              <div
                key={activity.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <div className="break-words text-base font-semibold text-slate-950">
                    {activity.title}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">Periodicidad: {activity.periodicity || "-"}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant={statusInfo.variant} className={statusInfo.className}>
                      {statusInfo.label}
                    </Badge>
                    <span
                      className={`inline-flex min-w-[96px] items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${priorityClassName}`}
                    >
                      {translatePriority(priority)}
                    </span>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="text-sm font-semibold text-slate-900">Fecha de vencimiento</div>
                  {canEditDueDate(userRole) ? (
                    <input
                      type="date"
                      className="h-11 w-full rounded-xl border border-slate-200 px-3 text-base text-slate-900 shadow-sm focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37] disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70"
                      value={formatDateForInput(effectiveDue)}
                      onChange={(e) => handleDueDateChange(activity.id, e.target.value)}
                      disabled={updatingId === activity.id}
                    />
                  ) : (
                    <div className="text-sm font-medium text-slate-700">
                      {formatDateForDisplay(formatDateForInput(effectiveDue))}
                    </div>
                  )}
                  {errorByActivity[activity.id] ? (
                    <div className="text-xs text-red-600">{errorByActivity[activity.id]}</div>
                  ) : null}
                  {updatingId === activity.id ? (
                    <div className="text-xs text-slate-500">Guardando cambios…</div>
                  ) : null}
                </div>

                <div className="mt-3">
                  {activity.documents.length === 0 ? (
                    <span className="text-sm text-muted-foreground">Sin archivos cargados</span>
                  ) : latestDoc ? (
                    <a
                      href={latestDoc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm text-blue-700 hover:text-blue-900 hover:underline"
                      title={latestDoc.name}
                    >
                      {latestDoc.name}
                    </a>
                  ) : null}
                </div>

                <div className="mt-3">
                  <RequirementActions
                    activityId={activity.id}
                    latestDoc={
                      latestDoc
                        ? {
                            id: latestDoc.id,
                            name: latestDoc.name,
                            url: latestDoc.url,
                            activity: {
                              title: activity.title,
                              project: { name: collaboratorProjectName },
                            },
                          }
                        : null
                    }
                    documents={activity.documents.map((doc) => ({
                      id: doc.id,
                      name: doc.name,
                      url: doc.url,
                      uploadedAt: doc.uploadedAt,
                      version: doc.version ?? 1,
                      sizeBytes: doc.sizeBytes ?? null,
                      uploadedByUser: doc.uploadedByUser
                        ? { name: doc.uploadedByUser.name, role: doc.uploadedByUser.role }
                        : null,
                    }))}
                    canManage={canManageActivities}
                    canDelete={isAdmin}
                    userRole={userRole}
                    status={activity.status}
                    priority={priority}
                  />
                </div>

                {canManageActivities ? (
                  <div className="mt-3">
                    <CollaboratorActivityActions
                      activityId={activity.id}
                      title={activity.title}
                      status={activity.status}
                      periodicity={activity.periodicity}
                      dueDate={effectiveDue}
                      documentsCount={activity.documents.length}
                      canDelete={isAdmin}
                      isAdmin={isAdmin}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}

          {filteredRows.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-base text-slate-600">
              No hay actividades para el filtro de prioridad seleccionado.
            </div>
          ) : null}
        </div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="p-2">Actividad</th>
                <th className="p-2">Periodicidad</th>
                <th className="p-2">Estado</th>
                <th className="p-2">Prioridad</th>
                <th className="p-2">Fecha vencimiento</th>
                <th className="p-2">Archivos</th>
                <th className="p-2">Gestión de archivos</th>
                {canManageActivities && <th className="p-2 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map(({ activity, effectiveDue, priority }) => {
                const hasDocuments = activity.documents.length > 0;
                const latestDoc = hasDocuments ? activity.documents[0] : null;
                const statusInfo = getStatusLabel(activity.status, hasDocuments);
                const priorityClassName = getPriorityBadgeClass(priority);

                return (
                  <tr key={activity.id} className="border-t">
                    <td className="p-2 font-medium">{activity.title}</td>
                    <td className="p-2 text-xs text-slate-700">{activity.periodicity || "-"}</td>
                    <td className="p-2">
                      <Badge variant={statusInfo.variant} className={statusInfo.className}>
                        {statusInfo.label}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <span
                        className={`inline-flex min-w-[96px] items-center justify-center rounded-full px-3 py-1 text-xs font-semibold ${priorityClassName}`}
                      >
                        {translatePriority(priority)}
                      </span>
                    </td>
                    <td className="p-2 align-top">
                      <div className="flex flex-col gap-1">
                        {canEditDueDate(userRole) ? (
                          <>
                            <input
                              type="date"
                              className="h-8 w-40 rounded-md border border-slate-200 px-2 text-xs text-slate-900 shadow-sm focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37] disabled:opacity-70 disabled:cursor-not-allowed disabled:bg-slate-50"
                              value={formatDateForInput(effectiveDue)}
                              onChange={(e) => handleDueDateChange(activity.id, e.target.value)}
                              disabled={updatingId === activity.id}
                            />
                            {errorByActivity[activity.id] && (
                              <span className="text-[0.7rem] text-red-600">{errorByActivity[activity.id]}</span>
                            )}
                            {updatingId === activity.id && (
                              <span className="text-[0.7rem] text-slate-400">Guardando cambios…</span>
                            )}
                          </>
                        ) : (
                          <span className="text-sm text-slate-700 py-1 font-medium">
                            {formatDateForDisplay(formatDateForInput(effectiveDue))}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-2 align-top">
                      {activity.documents.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sin archivos cargados</span>
                      ) : latestDoc ? (
                        <a
                          href={latestDoc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-xs text-blue-700 hover:text-blue-900 hover:underline"
                        >
                          {latestDoc.name}
                        </a>
                      ) : null}
                    </td>
                    <td className="p-2">
                      <RequirementActions
                        activityId={activity.id}
                        latestDoc={
                          latestDoc
                            ? {
                                id: latestDoc.id,
                                name: latestDoc.name,
                                url: latestDoc.url,
                                activity: {
                                  title: activity.title,
                                  project: { name: collaboratorProjectName },
                                },
                              }
                            : null
                        }
                        documents={activity.documents.map((doc) => ({
                          id: doc.id,
                          name: doc.name,
                          url: doc.url,
                          uploadedAt: doc.uploadedAt,
                          version: doc.version ?? 1,
                          sizeBytes: doc.sizeBytes ?? null,
                          uploadedByUser: doc.uploadedByUser
                            ? { name: doc.uploadedByUser.name, role: doc.uploadedByUser.role }
                            : null,
                        }))}
                        canManage={canManageActivities}
                        canDelete={isAdmin}
                        userRole={userRole}
                        status={activity.status}
                        priority={priority}
                      />
                    </td>
                    {canManageActivities && (
                      <td className="p-2 text-right">
                        <CollaboratorActivityActions
                          activityId={activity.id}
                          title={activity.title}
                          status={activity.status}
                          dueDate={effectiveDue}
                          documentsCount={activity.documents.length}
                          canDelete={isAdmin}
                          isAdmin={isAdmin}
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td
                    colSpan={canManageActivities ? 8 : 7}
                    className="p-4 text-center text-sm text-muted-foreground"
                  >
                    No hay actividades para el filtro de prioridad seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      
      {totalPages > 1 && (
        <div className="flex flex-col gap-3 border-t border-slate-200 px-2 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredRows.length)} de {filteredRows.length} actividades
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 sm:h-8 sm:w-8"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 sm:h-8 sm:w-8"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium text-slate-700">
              Página {currentPage} de {totalPages}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 sm:h-8 sm:w-8"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 sm:h-8 sm:w-8"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
