export const departments = [
  "Amazonas",
  "Antioquia",
  "Arauca",
  "Atlántico",
  "Bogotá D.C.",
  "Bolívar",
  "Boyacá",
  "Caldas",
  "Caquetá",
  "Casanare",
  "Cauca",
  "Cesar",
  "Chocó",
  "Córdoba",
  "Cundinamarca",
  "Guainía",
  "Guaviare",
  "Huila",
  "La Guajira",
  "Magdalena",
  "Meta",
  "Nariño",
  "Norte de Santander",
  "Putumayo",
  "Quindío",
  "Risaralda",
  "San Andrés y Providencia",
  "Santander",
  "Sucre",
  "Tolima",
  "Valle del Cauca",
  "Vaupés",
  "Vichada",
];

type ColombiaDepartmentEntry = {
  departamento: string;
  ciudades: string[];
};

const COLOMBIA_JSON_URL =
  "https://raw.githubusercontent.com/marcovega/colombia-json/master/colombia.min.json";

function normalizeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchMunicipalitiesByDepartment(
  department: string
): Promise<string[]> {
  if (!department) return [];

  try {
    const res = await fetch(COLOMBIA_JSON_URL);
    if (!res.ok) {
      return [];
    }

    const data = (await res.json()) as ColombiaDepartmentEntry[];
    const target = normalizeName(department);

    const entry =
      data.find(
        (d) => normalizeName(d.departamento) === target
      ) ??
      // Mapear Bogotá D.C. al nombre usado en el JSON (BOGOTÁ, D.C. o similar)
      (target.startsWith("BOGOTA")
        ? data.find((d) => normalizeName(d.departamento).startsWith("BOGOTA"))
        : undefined);

    if (!entry) return [];

    return entry.ciudades;
  } catch {
    return [];
  }
}
