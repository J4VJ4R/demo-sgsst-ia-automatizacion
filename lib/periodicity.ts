export const PERIODICITY_OPTIONS = [
  "Diario",
  "Semanal",
  "Quincenal",
  "Mensual",
  "Trimestral",
  "Semestral",
  "Anual",
] as const;

export type Periodicity = (typeof PERIODICITY_OPTIONS)[number];

export function normalizePeriodicity(value: string): string {
  return value.trim();
}

export function isValidPeriodicity(value: string): value is Periodicity {
  return (PERIODICITY_OPTIONS as readonly string[]).includes(value);
}

