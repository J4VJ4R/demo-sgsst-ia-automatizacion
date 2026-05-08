export type UserRole =
  | "ADMIN_PMD"
  | "CONSULTANT"
  | "CLIENT"
  | "CLIENT_VIEWER"
  | string;

export function canViewGlobalSummary(role: UserRole | null | undefined): boolean {
  if (!role) return false;
  return (
    role === "ADMIN_PMD" ||
    role === "CONSULTANT" ||
    role === "CLIENT" ||
    role === "CLIENT_VIEWER"
  );
}

