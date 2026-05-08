import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculatePercentage(value: number, total: number): string {
  if (total === 0) return "0";
  return ((value / total) * 100).toFixed(1);
}

export function getPriorityBadgeClass(priority: string | null | undefined): string {
  const p = (priority || "").toLowerCase();
  if (p === "vencido" || p === "alta" || p === "high" || p === "critical") {
    return "bg-red-500/90 text-white";
  }
  if (p === "por vencer" || p === "media" || p === "medium") {
    return "bg-yellow-400/90 text-black";
  }
  return "bg-emerald-400/90 text-black";
}

export function translatePriority(priority: string | null | undefined): string {
  if (!priority) return "Cumplido"; // Default to Cumplido if no priority
  
  const p = priority.toLowerCase().trim();
  
  if (p === "high" || p === "alta" || p === "critical" || p === "vencido") return "Vencido";
  if (p === "medium" || p === "media" || p === "por vencer") return "Por vencer";
  // Be explicitly inclusive for "cumplido" variants, but careful not to trap unknowns if possible
  if (p === "low" || p === "baja" || p === "cumplido") return "Cumplido";
  
  // If we reach here, it's an unknown priority.
  // In the context of enabling uploads, defaulting to "Cumplido" disables it.
  // This is safe but might be annoying if priority is weird.
  return "Cumplido";
}
