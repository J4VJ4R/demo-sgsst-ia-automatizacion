"use client";

import { canViewGlobalSummary } from "@/lib/rbac";
import { ClientActivitySummary } from "@/components/dashboard/client-activity-summary";

export function GlobalSummaryGate(props: { role: string | null | undefined }) {
  if (!canViewGlobalSummary(props.role)) return null;
  return <ClientActivitySummary />;
}

