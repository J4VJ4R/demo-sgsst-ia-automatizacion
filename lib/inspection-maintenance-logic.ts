import { calculatePriority } from "@/lib/priority-logic";

export type InspectionMaintenancePriority = "Vencido" | "Por vencer" | "Cumplido";

function parseDateOnly(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const [y, m, d] = trimmed.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

export function getInspectionMaintenancePriority(input: {
  dueDate: Date | string | null | undefined;
  referenceDate?: Date;
}) {
  const raw =
    typeof input.dueDate === "string"
      ? parseDateOnly(input.dueDate)
      : input.dueDate
      ? new Date(input.dueDate)
      : null;

  if (typeof input.dueDate === "string") {
    const trimmed = input.dueDate.trim();
    if (trimmed && !raw) {
      return { ok: false as const, error: "Fecha de vencimiento inválida." };
    }
  }

  if (!raw) {
    return { ok: true as const, priority: "Vencido" as const, dueDate: null };
  }

  const res = calculatePriority(raw, input.referenceDate);
  if (!res.isValid) {
    return { ok: false as const, error: res.error || "Fecha de vencimiento inválida." };
  }

  return { ok: true as const, priority: res.priority as InspectionMaintenancePriority, dueDate: raw };
}
