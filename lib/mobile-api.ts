import { NextResponse } from "next/server";
import { getCurrentUserFromMobileToken } from "@/lib/auth";

export async function requireMobileUser(req: Request) {
  const user = await getCurrentUserFromMobileToken(req);
  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, error: "No autorizado." }, { status: 401 }),
    };
  }
  return { ok: true as const, user };
}

export function isAdminRole(role: string) {
  return role === "ADMIN_PMD" || role === "GESTOR";
}

export function canSeeProject(user: { id: string; role: string }, project: { consultantId?: string | null; clientUserId?: string | null }) {
  return (
    isAdminRole(user.role) ||
    (user.role === "CONSULTANT" && project.consultantId === user.id) ||
    ((user.role === "CLIENT" || user.role === "CLIENT_VIEWER") && project.clientUserId === user.id)
  );
}

export function canManageProject(user: { id: string; role: string }, project: { consultantId?: string | null }) {
  return isAdminRole(user.role) || (user.role === "CONSULTANT" && project.consultantId === user.id);
}

export function canUploadActivityEvidence(
  user: { id: string; role: string },
  project: { consultantId?: string | null; clientUserId?: string | null }
) {
  return (
    isAdminRole(user.role) ||
    (user.role === "CONSULTANT" && project.consultantId === user.id) ||
    (user.role === "CLIENT_VIEWER" && project.clientUserId === user.id)
  );
}
