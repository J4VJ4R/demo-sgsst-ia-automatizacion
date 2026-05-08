export const COLLABORATOR_PRELOADED_ACTIVITY_TITLES = [
  "Contrato",
  "EMO",
  "Inducción",
  "Induccion",
  "Perfil sociodemográfico",
  "Perfil sociodemografico",
  "Autor reporte de condiciones de salud",
  "Entrega de EPP",
  "Cursos",
  "Rendición de cuentas",
  "Rendicion de cuentas",
  "Seguimiento a condiciones de salud - Restricciones y recomendaciones",
] as const;

function normalizeTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const PRELOADED_SET = new Set(COLLABORATOR_PRELOADED_ACTIVITY_TITLES.map(normalizeTitle));

export function isCollaboratorPreloadedActivityTitle(title: string): boolean {
  return PRELOADED_SET.has(normalizeTitle(title));
}

