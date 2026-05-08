export type AiRiskCategory = "IMPORTANTE" | "CONSIDERABLE";

export type AiRiskCode =
  | "CONTACTO_ELECTRICO"
  | "ARCO_ELECTRICO"
  | "VIOLACION_DISTANCIAS"
  | "RIESGO_LOCATIVO"
  | "SOBRETENSION";

export type AiRiskFinding = {
  raw: string;
  code: AiRiskCode;
  category: AiRiskCategory;
  weight: number;
};

export type AiRiskSource = {
  activityId: string;
  activityTitle: string;
  projectId: string;
  projectName?: string | null;
  department?: string | null;
  municipality?: string | null;
  inspectionEquipmentId?: string | null;
  latestReplyMessage?: string | null;
};

export type AiRiskAlert = {
  id: string;
  level: "CRITICO";
  locationLabel: string;
  importantCount: number;
  message: string;
};

export type AiZoneProbability = {
  zone: string;
  probabilityPct: number;
  importantFindings: number;
  totalFindings: number;
  topCauseLabel: string | null;
  topCausePct: number | null;
};

export type AiRiskSummary = {
  riskAccumulatedPct: number;
  zoneProbabilities: AiZoneProbability[];
  alerts: AiRiskAlert[];
  insightText: string;
  isTrained: boolean;
};

const IMPORTANT_WEIGHT = 1.0;
const CONSIDERABLE_WEIGHT = 0.6;

function norm(input: string) {
  return (input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(haystack: string, needles: string[]) {
  for (const n of needles) {
    if (haystack.includes(n)) return true;
  }
  return false;
}

export function extractFindingsFromReply(message: string | null | undefined): string[] {
  if (!message) return [];
  const lines = message.split(/\r?\n/).map((l) => l.trim());
  const idx = lines.findIndex((l) => norm(l).startsWith("hallazgos:"));
  const findings: string[] = [];

  if (idx >= 0) {
    const header = lines[idx] || "";
    const colonPos = header.indexOf(":");
    const after = colonPos >= 0 ? header.slice(colonPos + 1).trim() : "";
    if (after) {
      const parts = after
        .split(/\s*-\s*/g)
        .map((p) => p.trim())
        .filter(Boolean);
      for (const p of parts) {
        if (norm(p).startsWith("analitica predictiva:")) break;
        if (norm(p).startsWith("probabilidad")) continue;
        findings.push(p);
      }
    }
  }

  const slice = idx >= 0 ? lines.slice(idx + 1) : lines;
  for (const line of slice) {
    const cleaned = line.replace(/^\-\s*/, "").trim();
    if (!cleaned) continue;
    if (norm(cleaned).startsWith("analitica predictiva:")) break;
    if (norm(cleaned).startsWith("probabilidad")) continue;
    findings.push(cleaned);
  }
  return findings;
}

export function classifyFinding(rawFinding: string): AiRiskFinding | null {
  const t = norm(rawFinding);
  if (!t) return null;

  const isViolationDistances = includesAny(t, [
    "violacion de distancias",
    "distancias de seguridad",
    "proximidad minima",
    "proximidad minima no respetada",
    "distancia minima",
  ]);
  if (isViolationDistances) {
    return { raw: rawFinding, code: "VIOLACION_DISTANCIAS", category: "IMPORTANTE", weight: IMPORTANT_WEIGHT };
  }

  const isArc = includesAny(t, ["arco electrico", "arco", "flash"]);
  if (isArc) {
    return { raw: rawFinding, code: "ARCO_ELECTRICO", category: "IMPORTANTE", weight: IMPORTANT_WEIGHT };
  }

  const isContact = includesAny(t, ["contacto electrico directo", "contacto electrico indirecto", "contacto electrico"]);
  if (isContact) {
    return { raw: rawFinding, code: "CONTACTO_ELECTRICO", category: "IMPORTANTE", weight: IMPORTANT_WEIGHT };
  }

  const isLocative = includesAny(t, ["riesgo locativo", "escalera", "escaleras", "almacenamiento", "pasillo obstruido"]);
  if (isLocative) {
    return { raw: rawFinding, code: "RIESGO_LOCATIVO", category: "CONSIDERABLE", weight: CONSIDERABLE_WEIGHT };
  }

  const isOvervoltage = includesAny(t, ["sobretension", "sobretension en equipos", "pico de tension"]);
  if (isOvervoltage) {
    return { raw: rawFinding, code: "SOBRETENSION", category: "CONSIDERABLE", weight: CONSIDERABLE_WEIGHT };
  }

  return null;
}

function hashToIndex(input: string, mod: number) {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return mod === 0 ? 0 : h % mod;
}

export function deriveZone(source: AiRiskSource): string {
  const msg = norm(source.latestReplyMessage || "");
  const m = msg.match(/\bzona\s+(norte|sur|centro|oriente|occidente)\b/i);
  if (m?.[1]) {
    const z = m[1].toLowerCase();
    return `Zona ${z.charAt(0).toUpperCase()}${z.slice(1)}`;
  }

  const dept = norm(source.department || "");
  if (dept.includes("bogota")) return "Zona Centro";
  if (dept.includes("antioquia")) return "Zona Occidente";
  if (dept.includes("atlantico")) return "Zona Norte";
  if (dept.includes("valle")) return "Zona Occidente";

  const zones = ["Zona Norte", "Zona Centro", "Zona Sur"];
  return zones[hashToIndex(source.activityId || source.projectId || "x", zones.length)] || "Zona Centro";
}

function causeLabel(code: AiRiskCode): string {
  switch (code) {
    case "VIOLACION_DISTANCIAS":
      return "Violación de Distancias";
    case "ARCO_ELECTRICO":
      return "Arco Eléctrico";
    case "CONTACTO_ELECTRICO":
      return "Contacto Eléctrico";
    case "RIESGO_LOCATIVO":
      return "Riesgo Locativo";
    case "SOBRETENSION":
      return "Sobretensión";
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function applyTrainingToProbability(probabilityPct: number, trained: boolean) {
  if (!trained) return clamp(Math.round(probabilityPct), 0, 100);
  const centered = 50 + (probabilityPct - 50) * 1.18;
  return clamp(Math.round(centered), 0, 100);
}

export function computeAiRiskSummary(
  sources: AiRiskSource[],
  opts?: { trained?: boolean; onlyElectricalInspections?: boolean }
): AiRiskSummary {
  const trained = Boolean(opts?.trained);
  const onlyElectricalInspections = opts?.onlyElectricalInspections ?? true;

  const relevant = sources.filter((s) => {
    const title = norm(s.activityTitle || "");
    const msg = norm(s.latestReplyMessage || "");

    const looksLikeInspection = title.includes("inspeccion") || msg.includes("hallazgos:");
    if (!looksLikeInspection) return false;

    if (!onlyElectricalInspections) return true;

    const looksElectricalTitle = title.includes("riesgo electrico") || title.includes("electrico");
    const looksElectricalMsg = includesAny(msg, [
      "distancias de seguridad",
      "violacion de distancias",
      "proximidad minima",
      "arco electrico",
      "contacto electrico",
      "dielec",
      "sobretension",
    ]);
    return looksElectricalTitle || looksElectricalMsg;
  });

  const byZone = new Map<
    string,
    {
      weightSum: number;
      importantCount: number;
      totalFindings: number;
      causeCounts: Record<AiRiskCode, number>;
      activitiesSeen: Set<string>;
    }
  >();

  const importantByLocation = new Map<string, number>();

  for (const src of relevant) {
    const zone = deriveZone(src);
    const findings = extractFindingsFromReply(src.latestReplyMessage);
    const classified = findings.map(classifyFinding).filter(Boolean) as AiRiskFinding[];
    const total = classified.length;
    if (total === 0) continue;

    const entry =
      byZone.get(zone) ||
      ({
        weightSum: 0,
        importantCount: 0,
        totalFindings: 0,
        causeCounts: {
          CONTACTO_ELECTRICO: 0,
          ARCO_ELECTRICO: 0,
          VIOLACION_DISTANCIAS: 0,
          RIESGO_LOCATIVO: 0,
          SOBRETENSION: 0,
        },
        activitiesSeen: new Set<string>(),
      } as const);

    entry.activitiesSeen.add(src.activityId);
    for (const f of classified) {
      entry.weightSum += f.weight;
      entry.totalFindings += 1;
      if (f.category === "IMPORTANTE") entry.importantCount += 1;
      entry.causeCounts[f.code] = (entry.causeCounts[f.code] || 0) + 1;
    }
    byZone.set(zone, { ...entry, activitiesSeen: entry.activitiesSeen });

    const locationKey = `${src.projectId}::${zone}`;
    const importantHere = classified.filter((f) => f.category === "IMPORTANTE").length;
    if (importantHere > 0) {
      importantByLocation.set(locationKey, (importantByLocation.get(locationKey) || 0) + importantHere);
    }
  }

  const zones = Array.from(byZone.entries()).map(([zone, v]) => {
    const activityCount = Math.max(1, v.activitiesSeen.size);
    const maxExpected = activityCount * 3;
    const normalized = maxExpected <= 0 ? 0 : (v.weightSum / maxExpected) * 100;
    const probabilityPct = applyTrainingToProbability(clamp(normalized, 0, 100), trained);

    const topCause = (Object.keys(v.causeCounts) as AiRiskCode[]).reduce(
      (acc, key) => {
        const count = v.causeCounts[key] || 0;
        if (count > acc.count) return { code: key, count };
        return acc;
      },
      { code: "VIOLACION_DISTANCIAS" as AiRiskCode, count: 0 }
    );

    const topCausePct =
      v.totalFindings > 0 ? clamp(Math.round((topCause.count / v.totalFindings) * 100), 0, 100) : null;

    return {
      zone,
      probabilityPct,
      importantFindings: v.importantCount,
      totalFindings: v.totalFindings,
      topCauseLabel: topCause.count > 0 ? causeLabel(topCause.code) : null,
      topCausePct: topCausePct,
    } satisfies AiZoneProbability;
  });

  zones.sort((a, b) => b.probabilityPct - a.probabilityPct);

  const allWeightSum = Array.from(byZone.values()).reduce((acc, v) => acc + v.weightSum, 0);
  const allActivities = Array.from(byZone.values()).reduce((acc, v) => acc + Math.max(1, v.activitiesSeen.size), 0);
  const allMax = allActivities * 3;
  const riskAccumulatedPct = applyTrainingToProbability(allMax <= 0 ? 0 : clamp((allWeightSum / allMax) * 100, 0, 100), trained);

  const alerts: AiRiskAlert[] = [];
  for (const [locationKey, importantCount] of importantByLocation.entries()) {
    if (importantCount >= 3) {
      const zone = locationKey.split("::")[1] || "Ubicación";
      alerts.push({
        id: `crit-${locationKey}`,
        level: "CRITICO",
        locationLabel: zone,
        importantCount,
        message: `Alerta Preventiva (Crítico): Se detectaron ${importantCount} riesgos importantes acumulados en ${zone}.`,
      });
    }
  }

  const topZone = zones[0] || null;
  const insightText = topZone
    ? `IA detecta patrón crítico: El ${topZone.topCausePct ?? 0}% de hallazgos en la ${topZone.zone} son por ${
        topZone.topCauseLabel || "causa dominante"
      }. Riesgo de Arco Eléctrico ALTO`
    : "IA: Sin datos suficientes para inferir patrones de riesgo.";

  return {
    riskAccumulatedPct,
    zoneProbabilities: zones,
    alerts,
    insightText,
    isTrained: trained,
  };
}
