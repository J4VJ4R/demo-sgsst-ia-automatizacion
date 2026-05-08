export type PriorityLevel = "Vencido" | "Por vencer" | "Cumplido";

export interface PriorityResult {
  priority: PriorityLevel;
  color: string;
  isValid: boolean;
  error?: string;
}

export function calculatePriority(dueDate: Date, referenceDate?: Date): PriorityResult {
  // Normalize dates to start of day
  const today = referenceDate ? new Date(referenceDate) : new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) {
    return {
      priority: "Cumplido",
      color: "bg-red-100 text-red-800",
      isValid: false,
      error: "Fecha de vencimiento inválida.",
    };
  }
  due.setHours(0, 0, 0, 0);

  // Calculate difference in days
  const diffTime = due.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysRemaining <= 0) {
    return {
      priority: "Vencido",
      color: "bg-red-100 text-red-800",
      isValid: true,
    };
  }

  if (daysRemaining <= 15) {
    return {
      priority: "Por vencer",
      color: "bg-yellow-100 text-yellow-800", // Yellow for Medium
      isValid: true,
    };
  }

  return {
    priority: "Cumplido",
    color: "bg-green-100 text-green-800", // Green for Low
    isValid: true,
  };
}

export const PRIORITY_COLORS = {
    Vencido: "bg-red-100 text-red-800",
    "Por vencer": "bg-yellow-100 text-yellow-800",
    Cumplido: "bg-green-100 text-green-800"
};

export function isUploadAllowed(dueDate: Date | null | undefined): boolean {
  if (!dueDate) return true; // Allow if no date is set (fallback)
  
  const result = calculatePriority(new Date(dueDate));
  if (!result.isValid) return true;
  return result.priority !== "Cumplido";
}
