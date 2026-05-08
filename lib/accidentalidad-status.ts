export type AccidentalidadEstado = "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED";

export function getAccidentalidadEstadoLabel(status: string): string {
  if (status === "APPROVED") return "Aprobada";
  if (status === "IN_REVIEW") return "En revisión";
  if (status === "REJECTED") return "Rechazada";
  return "Pendiente";
}

export function getAccidentalidadEstadoBadgeClass(status: string): string {
  if (status === "APPROVED") return "bg-emerald-500 text-white hover:bg-emerald-600";
  if (status === "IN_REVIEW") return "bg-blue-600 text-white hover:bg-blue-700";
  if (status === "REJECTED") return "bg-red-600 text-white hover:bg-red-700";
  return "text-yellow-700 border-yellow-200 bg-yellow-50/40";
}

export function isAccidentalidadEstado(value: string): value is AccidentalidadEstado {
  return value === "PENDING" || value === "IN_REVIEW" || value === "APPROVED" || value === "REJECTED";
}

export function validateAccidentalidadEstadoTransition(args: {
  from: string;
  to: string;
  actorRole: string;
}) {
  const from = args.from;
  const to = args.to;

  if (!isAccidentalidadEstado(to)) {
    return { ok: false as const, error: "Estado inválido." };
  }

  if (from === to) {
    return { ok: true as const };
  }

  if (from === "APPROVED") {
    return { ok: false as const, error: "No se puede cambiar el estado de una actividad aprobada." };
  }

  const isAdmin = args.actorRole === "ADMIN_PMD";
  const isConsultant = args.actorRole === "CONSULTANT";

  if (to === "APPROVED" && !isAdmin) {
    return { ok: false as const, error: "Solo auditor puede aprobar." };
  }

  if (to === "REJECTED" && !isAdmin) {
    return { ok: false as const, error: "Solo auditor puede rechazar." };
  }

  if (to === "IN_REVIEW" && !(isAdmin || isConsultant)) {
    return { ok: false as const, error: "No tiene permisos para enviar a revisión." };
  }

  if (to === "PENDING" && !(isAdmin || isConsultant)) {
    return { ok: false as const, error: "No tiene permisos para devolver a pendiente." };
  }

  if (from === "PENDING" && to === "IN_REVIEW") return { ok: true as const };
  if (from === "IN_REVIEW" && (to === "APPROVED" || to === "REJECTED" || to === "PENDING"))
    return { ok: true as const };
  if (from === "REJECTED" && (to === "IN_REVIEW" || to === "PENDING"))
    return { ok: true as const };
  if (from === "PENDING" && to === "REJECTED" && isAdmin) return { ok: true as const };

  return { ok: false as const, error: "Transición de estado no permitida." };
}

