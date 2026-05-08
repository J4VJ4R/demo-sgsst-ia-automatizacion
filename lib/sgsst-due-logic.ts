import { parseDateOnly } from "@/lib/accidentalidad-logic";

export type SgSstDueStatus = "Vencido" | "Por vencer" | "Cumplido";

export function calculateSgSstDueStatus(dueDate: Date | string, referenceDate?: Date): SgSstDueStatus {
  const today = new Date(referenceDate ? new Date(referenceDate) : new Date());
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const dueRaw = typeof dueDate === "string" ? parseDateOnly(dueDate) : new Date(dueDate);
  if (!dueRaw) return "Vencido";
  const dueStart = new Date(dueRaw.getFullYear(), dueRaw.getMonth(), dueRaw.getDate());

  const diffTime = dueStart.getTime() - todayStart.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysRemaining <= 0) return "Vencido";
  if (daysRemaining <= 15) return "Por vencer";
  return "Cumplido";
}

export function validateSgSstDueDate(dueDate: string, referenceDate?: Date) {
  const raw = parseDateOnly(dueDate);
  if (!raw) return { ok: false as const, error: "Fecha de vencimiento inválida." };

  const now = new Date(referenceDate ? new Date(referenceDate) : new Date());
  const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());

  if (Number.isNaN(d.getTime())) return { ok: false as const, error: "Fecha de vencimiento inválida." };
  if (d.getTime() <= nowStart.getTime()) return { ok: false as const, error: "La fecha de vencimiento debe ser futura." };

  return { ok: true as const, date: d };
}
