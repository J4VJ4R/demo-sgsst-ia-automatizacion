
export function getStatusInfo(status: string, hasDocuments: boolean) {
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
}
