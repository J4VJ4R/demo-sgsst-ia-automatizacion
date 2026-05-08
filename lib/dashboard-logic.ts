
export type ActivitySummary = {
  id: string;
  status: string;
  priority: string | null;
  updatedAt: string;
  dueDate?: string | null;
  projectId: string;
  projectName: string;
  department: string | null;
  municipality: string | null;
  riskLevel: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  assignedToRole: string | null;
  consultantId: string | null;
  consultantName: string | null;
};

export type ProjectSummary = {
  id: string;
  name: string;
  consultantId: string | null;
  consultantName: string | null;
  department: string | null;
};

export type FilterState = {
  companyId: string;
  consultantId: string;
  department: string;
  risk: string;
  dateFrom: string;
  dateTo: string;
};

/**
 * Filter activities based on all selected filters.
 */
export function getFilteredActivities(
  activities: ActivitySummary[],
  filters: FilterState
): ActivitySummary[] {
  const { companyId, consultantId, department, risk, dateFrom, dateTo } = filters;

  const fromDate = dateFrom ? new Date(dateFrom) : null;
  const toDate = dateTo ? new Date(dateTo) : null;

  return activities.filter((activity) => {
    // Date Range
    const updated = new Date(activity.updatedAt);
    if (fromDate && updated < fromDate) return false;
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      if (updated > end) return false;
    }

    // Company (Client-side filter)
    if (companyId !== "all" && activity.projectId !== companyId) {
      return false;
    }

    // Consultant
    if (consultantId !== "all") {
      const isAssigned = activity.assignedToId === consultantId;
      const isProjectConsultant = activity.consultantId === consultantId;
      if (!isAssigned && !isProjectConsultant) {
        return false;
      }
    }

    // Department
    if (department !== "all" && activity.department !== department) {
      return false;
    }

    // Risk
    if (risk !== "all" && activity.riskLevel !== risk) {
      return false;
    }

    return true;
  });
}

/**
 * Get available consultants based on the selected company (and other potential context).
 * Bidirectional filtering: If a company is selected, show only consultants for that company.
 * Uses ProjectSummary directly as the source of truth.
 */
export function getAvailableConsultants(
  activities: ActivitySummary[], // Kept for signature compatibility but unused for core logic now
  allProjects: ProjectSummary[],
  selectedCompanyId: string
): { id: string; name: string }[] {
  const map = new Map<string, { id: string; name: string }>();

  allProjects.forEach((project) => {
    // 1. Filter by company if selected
    if (selectedCompanyId !== "all" && project.id !== selectedCompanyId) return;

    // 2. Add project consultant if exists
    if (project.consultantId) {
      map.set(project.consultantId, {
        id: project.consultantId,
        name: project.consultantName || "Consultor",
      });
    }
  });

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "es")
  );
}

export function getAvailableProjects(
  activities: ActivitySummary[], // Kept for signature compatibility but unused for core logic now
  allProjects: ProjectSummary[],
  selectedConsultantId: string
): ProjectSummary[] {
  if (selectedConsultantId === "all") {
    return allProjects;
  }

  // Filter projects where the consultant is the owner
  return allProjects.filter(project => project.consultantId === selectedConsultantId);
}
