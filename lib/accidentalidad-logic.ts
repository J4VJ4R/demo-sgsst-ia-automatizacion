export type AccidentalidadPriority = "Vencido" | "Por vencer" | "Cumplido";

export const allowedAccidentalidadMimeTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export const maxAccidentalidadFileSizeBytes = 20 * 1024 * 1024;

function toLocalStartOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function parseDateOnly(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const [y, m, d] = trimmed.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

export function calculateAccidentalidadPriority(
  dueDate: Date | string,
  referenceDate?: Date
): AccidentalidadPriority {
  const today = toLocalStartOfDay(referenceDate ? new Date(referenceDate) : new Date());
  const dueRaw = typeof dueDate === "string" ? parseDateOnly(dueDate) : new Date(dueDate);
  if (!dueRaw) return "Vencido";
  const due = toLocalStartOfDay(dueRaw);

  const diffTime = due.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysRemaining <= 0) return "Vencido";
  if (daysRemaining <= 15) return "Por vencer";
  return "Cumplido";
}

export function validateFutureDueDate(dueDate: Date | string, referenceDate?: Date) {
  const now = toLocalStartOfDay(referenceDate ? new Date(referenceDate) : new Date());
  const raw = typeof dueDate === "string" ? parseDateOnly(dueDate) : new Date(dueDate);
  if (!raw) {
    return { ok: false as const, error: "Fecha de vencimiento inválida." };
  }
  const d = toLocalStartOfDay(raw);

  if (Number.isNaN(d.getTime())) {
    return { ok: false as const, error: "Fecha de vencimiento inválida." };
  }

  if (d.getTime() <= now.getTime()) {
    return { ok: false as const, error: "La fecha de vencimiento debe ser futura." };
  }

  return { ok: true as const };
}
