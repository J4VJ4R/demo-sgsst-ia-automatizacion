"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/app/auth-actions";
import { evaluateFormula, sanitizeVariableKey, tokenizeFormula } from "@/lib/minimum-indicators-formula";
import type { Prisma } from "@prisma/client";

type ProjectAccess =
  | { ok: true; canView: true; canManage: boolean; userRole: string; userId: string }
  | { ok: false; error: string };

async function getProjectAccess(userId: string, userRole: string, projectId: string): Promise<ProjectAccess> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, consultantId: true, clientUserId: true },
  });
  if (!project) return { ok: false, error: "Proyecto no encontrado" };

  const isAdmin = userRole === "ADMIN_PMD";
  const isConsultant = userRole === "CONSULTANT" && project.consultantId === userId;
  const isClient = (userRole === "CLIENT" || userRole === "CLIENT_VIEWER") && project.clientUserId === userId;

  if (!isAdmin && !isConsultant && !isClient) return { ok: false, error: "Sin permisos" };

  return { ok: true, canView: true, canManage: isAdmin || isConsultant, userRole, userId };
}

export type MinimumIndicatorListItem = {
  id: string;
  name: string;
  description: string | null;
  type: string | null;
  unit: string;
  periodicity: string;
  targetPercent: number;
  formula: string;
  variables: Array<{ key: string; label: string }>;
  latestMeasurement:
    | null
    | {
        id: string;
        periodStart: string;
        periodEnd: string;
        computedValue: number;
        compliancePct: number;
        resultAnalysis: string | null;
        createdAt: string;
      };
};

export async function listMinimumIndicators(args: {
  projectId: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  type?: string | null;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  if (!(prisma as unknown as Record<string, unknown>).minimumIndicator) {
    return { success: false as const, error: "Módulo no disponible en esta instancia. Verifica migraciones y Prisma Client." };
  }

  const access = await getProjectAccess(user.id, user.role, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };

  const where: Prisma.MinimumIndicatorWhereInput = {
    projectId: args.projectId,
    deletedAt: null,
  };
  if (args.type) where.type = args.type;

  let indicators: Array<{
    id: string;
    name: string;
    description: string | null;
    type: string | null;
    unit: string;
    periodicity: string;
    targetPercent: number;
    formula: string;
    variablesJson: string;
    measurements: Array<{
      id: string;
      periodStart: Date;
      periodEnd: Date;
      computedValue: number;
      compliancePct: number;
      resultAnalysis?: string | null;
      createdAt: Date;
    }>;
  }> = [];

  try {
    indicators = await prisma.minimumIndicator.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        unit: true,
        periodicity: true,
        targetPercent: true,
        formula: true,
        variablesJson: true,
        measurements: {
          where: {
            deletedAt: null,
            ...(args.periodStart ? { periodEnd: { gte: new Date(args.periodStart) } } : {}),
            ...(args.periodEnd ? { periodStart: { lte: new Date(args.periodEnd) } } : {}),
          },
          orderBy: { periodEnd: "desc" },
          take: 1,
          select: {
            id: true,
            periodStart: true,
            periodEnd: true,
            computedValue: true,
            compliancePct: true,
            resultAnalysis: true,
            createdAt: true,
          },
        },
      },
    });
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? (err as { code?: unknown }).code : null;
    if (code === "P2021") {
      return {
        success: false as const,
        error: "La tabla de Indicadores mínimos no existe en la base de datos. Debes aplicar la migración del módulo.",
      };
    }
    if (code === "P2022") {
      try {
        indicators = await prisma.minimumIndicator.findMany({
          where,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            description: true,
            type: true,
            unit: true,
            periodicity: true,
            targetPercent: true,
            formula: true,
            variablesJson: true,
            measurements: {
              where: {
                deletedAt: null,
                ...(args.periodStart ? { periodEnd: { gte: new Date(args.periodStart) } } : {}),
                ...(args.periodEnd ? { periodStart: { lte: new Date(args.periodEnd) } } : {}),
              },
              orderBy: { periodEnd: "desc" },
              take: 1,
              select: {
                id: true,
                periodStart: true,
                periodEnd: true,
                computedValue: true,
                compliancePct: true,
                createdAt: true,
              },
            },
          },
        });
      } catch {
        return {
          success: false as const,
          error: "La base de datos está desactualizada (falta la columna resultAnalysis en minimum_indicator_measurement). Aplica migraciones.",
        };
      }
    } else {
      return { success: false as const, error: "No se pudo cargar los indicadores." };
    }
  }

  const items: MinimumIndicatorListItem[] = indicators.map((i) => {
    let variables: Array<{ key: string; label: string }> = [];
    try {
      variables = JSON.parse(i.variablesJson || "[]");
    } catch {
      variables = [];
    }
    const latest = i.measurements[0];
    return {
      id: i.id,
      name: i.name,
      description: i.description ?? null,
      type: i.type ?? null,
      unit: i.unit,
      periodicity: i.periodicity,
      targetPercent: i.targetPercent,
      formula: i.formula,
      variables,
      latestMeasurement: latest
        ? {
            id: latest.id,
            periodStart: latest.periodStart.toISOString(),
            periodEnd: latest.periodEnd.toISOString(),
            computedValue: latest.computedValue,
            compliancePct: latest.compliancePct,
            resultAnalysis: latest.resultAnalysis ?? null,
            createdAt: latest.createdAt.toISOString(),
          }
        : null,
    };
  });

  return { success: true as const, indicators: items, canManage: access.canManage };
}

export async function createMinimumIndicator(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  if (!(prisma as unknown as Record<string, unknown>).minimumIndicator) {
    return { success: false as const, error: "Módulo no disponible en esta instancia. Verifica migraciones y Prisma Client." };
  }

  const projectId = (formData.get("projectId") as string | null)?.trim() || "";
  const name = (formData.get("name") as string | null)?.trim() || "";
  const description = (formData.get("description") as string | null)?.trim() || null;
  const type = (formData.get("type") as string | null)?.trim() || null;
  const unit = (formData.get("unit") as string | null)?.trim() || "";
  const periodicity = (formData.get("periodicity") as string | null)?.trim() || "";
  const targetPercentRaw = (formData.get("targetPercent") as string | null)?.trim() || "";
  const formula = (formData.get("formula") as string | null)?.trim() || "";
  const variablesJson = (formData.get("variablesJson") as string | null)?.trim() || "[]";

  if (!projectId) return { success: false as const, error: "Proyecto requerido" };
  if (!name) return { success: false as const, error: "Nombre requerido" };
  if (!unit) return { success: false as const, error: "Unidad requerida" };
  if (!periodicity) return { success: false as const, error: "Periodicidad requerida" };

  const targetPercent = Number(targetPercentRaw);
  if (!Number.isFinite(targetPercent) || targetPercent < 0 || targetPercent > 1000) {
    return { success: false as const, error: "Meta inválida" };
  }

  const access = await getProjectAccess(user.id, user.role, projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canManage) return { success: false as const, error: "Sin permisos" };

  const parsed = tokenizeFormula(formula);
  if (!parsed.ok) return { success: false as const, error: parsed.error };

  let variables: Array<{ key: string; label: string }> = [];
  try {
    variables = JSON.parse(variablesJson || "[]");
    if (!Array.isArray(variables)) variables = [];
  } catch {
    variables = [];
  }
  variables = variables
    .map((v) => {
      const obj = v as unknown as { key?: unknown; label?: unknown };
      const label = typeof obj.label === "string" ? obj.label.trim() : "";
      const rawKey = typeof obj.key === "string" ? obj.key : "";
      const key = sanitizeVariableKey(rawKey) || sanitizeVariableKey(label);
      return { key, label };
    })
    .filter((v) => v.key && v.label);

  const used = new Set(parsed.variables);
  for (const v of variables) used.add(v.key);
  const mergedVars = Array.from(used).map((key) => {
    const found = variables.find((v) => v.key === key);
    return { key, label: found?.label || key };
  });

  let indicator: { id: string };
  try {
    indicator = await prisma.minimumIndicator.create({
      data: {
        projectId,
        name,
        description,
        type,
        unit,
        periodicity,
        targetPercent,
        formula,
        variablesJson: JSON.stringify(mergedVars),
      },
      select: { id: true },
    });
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? (err as { code?: unknown }).code : null;
    if (code === "P2021") {
      return {
        success: false as const,
        error: "No se pudo guardar porque la tabla de Indicadores mínimos no existe en la base de datos (falta migración).",
      };
    }
    return { success: false as const, error: "No se pudo crear el indicador." };
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}?view=minimum-indicators`);

  return { success: true as const, indicatorId: indicator.id };
}

export async function updateMinimumIndicator(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  if (!(prisma as unknown as Record<string, unknown>).minimumIndicator) {
    return { success: false as const, error: "Módulo no disponible en esta instancia. Verifica migraciones y Prisma Client." };
  }

  const projectId = (formData.get("projectId") as string | null)?.trim() || "";
  const indicatorId = (formData.get("indicatorId") as string | null)?.trim() || "";
  const name = (formData.get("name") as string | null)?.trim() || "";
  const description = (formData.get("description") as string | null)?.trim() || null;
  const type = (formData.get("type") as string | null)?.trim() || null;
  const unit = (formData.get("unit") as string | null)?.trim() || "";
  const periodicity = (formData.get("periodicity") as string | null)?.trim() || "";
  const targetPercentRaw = (formData.get("targetPercent") as string | null)?.trim() || "";
  const formula = (formData.get("formula") as string | null)?.trim() || "";
  const variablesJson = (formData.get("variablesJson") as string | null)?.trim() || "[]";

  if (!projectId || !indicatorId) return { success: false as const, error: "Parámetros requeridos" };

  const access = await getProjectAccess(user.id, user.role, projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canManage) return { success: false as const, error: "Sin permisos" };

  let indicator: { id: string } | null = null;
  try {
    indicator = await prisma.minimumIndicator.findFirst({
      where: { id: indicatorId, projectId, deletedAt: null },
      select: { id: true },
    });
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? (err as { code?: unknown }).code : null;
    if (code === "P2021") {
      return {
        success: false as const,
        error: "No se pudo guardar porque la tabla de Indicadores mínimos no existe en la base de datos (falta migración).",
      };
    }
    return { success: false as const, error: "No se pudo actualizar el indicador." };
  }
  if (!indicator) return { success: false as const, error: "Indicador no encontrado" };

  const targetPercent = Number(targetPercentRaw);
  if (!Number.isFinite(targetPercent) || targetPercent < 0 || targetPercent > 1000) {
    return { success: false as const, error: "Meta inválida" };
  }

  const parsed = tokenizeFormula(formula);
  if (!parsed.ok) return { success: false as const, error: parsed.error };

  let variables: Array<{ key: string; label: string }> = [];
  try {
    variables = JSON.parse(variablesJson || "[]");
    if (!Array.isArray(variables)) variables = [];
  } catch {
    variables = [];
  }
  variables = variables
    .map((v) => {
      const obj = v as unknown as { key?: unknown; label?: unknown };
      const label = typeof obj.label === "string" ? obj.label.trim() : "";
      const rawKey = typeof obj.key === "string" ? obj.key : "";
      const key = sanitizeVariableKey(rawKey) || sanitizeVariableKey(label);
      return { key, label };
    })
    .filter((v) => v.key && v.label);

  const used = new Set(parsed.variables);
  for (const v of variables) used.add(v.key);
  const mergedVars = Array.from(used).map((key) => {
    const found = variables.find((v) => v.key === key);
    return { key, label: found?.label || key };
  });

  try {
    await prisma.minimumIndicator.update({
      where: { id: indicatorId },
      data: {
        name,
        description,
        type,
        unit,
        periodicity,
        targetPercent,
        formula,
        variablesJson: JSON.stringify(mergedVars),
      },
    });
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? (err as { code?: unknown }).code : null;
    if (code === "P2021") {
      return {
        success: false as const,
        error: "No se pudo guardar porque la tabla de Indicadores mínimos no existe en la base de datos (falta migración).",
      };
    }
    return { success: false as const, error: "No se pudo actualizar el indicador." };
  }

  revalidatePath(`/projects/${projectId}?view=minimum-indicators`);
  revalidatePath(`/projects/${projectId}/minimum-indicators/${indicatorId}`);
  return { success: true as const };
}

export async function getMinimumIndicatorDetail(args: { projectId: string; indicatorId: string }) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  if (!(prisma as unknown as Record<string, unknown>).minimumIndicator) {
    return { success: false as const, error: "Módulo no disponible en esta instancia. Verifica migraciones y Prisma Client." };
  }
  const access = await getProjectAccess(user.id, user.role, args.projectId);
  if (!access.ok) return { success: false as const, error: access.error };

  let indicator:
    | null
    | {
        id: string;
        name: string;
        description: string | null;
        type: string | null;
        unit: string;
        periodicity: string;
        targetPercent: number;
        formula: string;
        variablesJson: string;
        createdAt: Date;
        updatedAt: Date;
        measurements: Array<{
          id: string;
          periodStart: Date;
          periodEnd: Date;
          inputsJson: string;
          computedValue: number;
          compliancePct: number;
          resultAnalysis?: string | null;
          createdAt: Date;
        }>;
      } = null;

  try {
    indicator = await prisma.minimumIndicator.findFirst({
      where: { id: args.indicatorId, projectId: args.projectId, deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        unit: true,
        periodicity: true,
        targetPercent: true,
        formula: true,
        variablesJson: true,
        createdAt: true,
        updatedAt: true,
        measurements: {
          where: { deletedAt: null },
          orderBy: { periodEnd: "desc" },
          take: 100,
          select: {
            id: true,
            periodStart: true,
            periodEnd: true,
            inputsJson: true,
            computedValue: true,
            compliancePct: true,
            resultAnalysis: true,
            createdAt: true,
          },
        },
      },
    });
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? (err as { code?: unknown }).code : null;
    if (code === "P2021") {
      return {
        success: false as const,
        error: "La tabla de Indicadores mínimos no existe en la base de datos. Debes aplicar la migración del módulo.",
      };
    }
    if (code === "P2022") {
      try {
        indicator = await prisma.minimumIndicator.findFirst({
          where: { id: args.indicatorId, projectId: args.projectId, deletedAt: null },
          select: {
            id: true,
            name: true,
            description: true,
            type: true,
            unit: true,
            periodicity: true,
            targetPercent: true,
            formula: true,
            variablesJson: true,
            createdAt: true,
            updatedAt: true,
            measurements: {
              where: { deletedAt: null },
              orderBy: { periodEnd: "desc" },
              take: 100,
              select: {
                id: true,
                periodStart: true,
                periodEnd: true,
                inputsJson: true,
                computedValue: true,
                compliancePct: true,
                createdAt: true,
              },
            },
          },
        });
      } catch {
        return {
          success: false as const,
          error: "La base de datos está desactualizada (falta la columna resultAnalysis en minimum_indicator_measurement). Aplica migraciones.",
        };
      }
    } else {
      return { success: false as const, error: "No se pudo cargar el indicador." };
    }
  }

  if (!indicator) return { success: false as const, error: "Indicador no encontrado" };

  let variables: Array<{ key: string; label: string }> = [];
  try {
    variables = JSON.parse(indicator.variablesJson || "[]");
  } catch {
    variables = [];
  }

  return {
    success: true as const,
    canManage: access.canManage,
    indicator: {
      id: indicator.id,
      name: indicator.name,
      description: indicator.description ?? null,
      type: indicator.type ?? null,
      unit: indicator.unit,
      periodicity: indicator.periodicity,
      targetPercent: indicator.targetPercent,
      formula: indicator.formula,
      variables,
      createdAt: indicator.createdAt.toISOString(),
      updatedAt: indicator.updatedAt.toISOString(),
      measurements: indicator.measurements.map((m) => ({
        id: m.id,
        periodStart: m.periodStart.toISOString(),
        periodEnd: m.periodEnd.toISOString(),
        inputsJson: m.inputsJson,
        computedValue: m.computedValue,
        compliancePct: m.compliancePct,
        resultAnalysis: m.resultAnalysis ?? null,
        createdAt: m.createdAt.toISOString(),
      })),
    },
  };
}

export async function createMinimumIndicatorMeasurement(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { success: false as const, error: "No autenticado" };
  if (!(prisma as unknown as Record<string, unknown>).minimumIndicator) {
    return { success: false as const, error: "Módulo no disponible en esta instancia. Verifica migraciones y Prisma Client." };
  }

  const projectId = (formData.get("projectId") as string | null)?.trim() || "";
  const indicatorId = (formData.get("indicatorId") as string | null)?.trim() || "";
  const periodStartRaw = (formData.get("periodStart") as string | null)?.trim() || "";
  const periodEndRaw = (formData.get("periodEnd") as string | null)?.trim() || "";
  const inputsJson = (formData.get("inputsJson") as string | null)?.trim() || "{}";
  const resultAnalysisRaw = (formData.get("resultAnalysis") as string | null)?.trim() || "";
  const resultAnalysis = resultAnalysisRaw ? resultAnalysisRaw : null;

  if (!projectId || !indicatorId) return { success: false as const, error: "Parámetros requeridos" };
  const access = await getProjectAccess(user.id, user.role, projectId);
  if (!access.ok) return { success: false as const, error: access.error };
  if (!access.canManage) return { success: false as const, error: "Sin permisos" };

  const periodStart = new Date(periodStartRaw);
  const periodEnd = new Date(periodEndRaw);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    return { success: false as const, error: "Periodo inválido" };
  }
  if (periodEnd < periodStart) return { success: false as const, error: "La fecha fin debe ser mayor o igual a la fecha inicio." };

  let indicator: { formula: string; targetPercent: number; variablesJson: string } | null = null;
  try {
    indicator = await prisma.minimumIndicator.findFirst({
      where: { id: indicatorId, projectId, deletedAt: null },
      select: { formula: true, targetPercent: true, variablesJson: true },
    });
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? (err as { code?: unknown }).code : null;
    if (code === "P2021") {
      return {
        success: false as const,
        error: "No se pudo guardar porque la tabla de Indicadores mínimos no existe en la base de datos (falta migración).",
      };
    }
    return { success: false as const, error: "No se pudo guardar la medición." };
  }
  if (!indicator) return { success: false as const, error: "Indicador no encontrado" };

  let inputs: Record<string, number> = {};
  try {
    const parsed = JSON.parse(inputsJson || "{}");
    inputs = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    inputs = {};
  }

  const evalRes = evaluateFormula(indicator.formula, inputs);
  if (!evalRes.ok) return { success: false as const, error: evalRes.error };

  const computedValue = evalRes.value;
  const compliancePct = indicator.targetPercent === 0 ? 0 : (computedValue / indicator.targetPercent) * 100;

  try {
    await prisma.minimumIndicatorMeasurement.create({
      data: {
        indicatorId,
        periodStart,
        periodEnd,
        inputsJson: JSON.stringify(inputs),
        resultAnalysis,
        computedValue,
        compliancePct,
        createdByUserId: user.id,
      },
    });
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? (err as { code?: unknown }).code : null;
    if (code === "P2021") {
      return {
        success: false as const,
        error: "No se pudo guardar porque la tabla de Indicadores mínimos no existe en la base de datos (falta migración).",
      };
    }
    if (code === "P2022") {
      try {
        await prisma.minimumIndicatorMeasurement.create({
          data: {
            indicatorId,
            periodStart,
            periodEnd,
            inputsJson: JSON.stringify(inputs),
            computedValue,
            compliancePct,
            createdByUserId: user.id,
          },
        });
      } catch {
        return {
          success: false as const,
          error: "La base de datos está desactualizada (falta la columna resultAnalysis en minimum_indicator_measurement). Aplica migraciones.",
        };
      }
    } else {
      return { success: false as const, error: "No se pudo guardar la medición." };
    }
    return { success: false as const, error: "No se pudo guardar la medición." };
    return { success: false as const, error: "No se pudo guardar la medición." };
  }

  revalidatePath(`/projects/${projectId}?view=minimum-indicators`);
  revalidatePath(`/projects/${projectId}/minimum-indicators/${indicatorId}`);
  return { success: true as const };
}
