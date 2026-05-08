
export function canEditDueDate(userRole?: string): boolean {
  if (!userRole) return true; // Default to true if role is not provided (maintain backward compatibility)
  
  const restrictedRoles = ["CONSULTANT", "CLIENT", "CLIENT_VIEWER"];
  return !restrictedRoles.includes(userRole);
}

export function canViewAccidentalidad(userRole?: string): boolean {
  if (!userRole) return false;
  return ["ADMIN_PMD", "CONSULTANT", "CLIENT", "CLIENT_VIEWER", "GESTOR"].includes(userRole);
}

export function canEditAccidentalidad(userRole?: string): boolean {
  if (!userRole) return false;
  return ["ADMIN_PMD", "CONSULTANT", "GESTOR"].includes(userRole);
}
