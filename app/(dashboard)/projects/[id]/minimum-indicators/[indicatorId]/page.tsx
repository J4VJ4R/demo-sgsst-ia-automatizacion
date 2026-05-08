import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/app/auth-actions";
import { MinimumIndicatorDetailClient } from "@/components/minimum-indicators/minimum-indicator-detail-client";
import { getMinimumIndicatorDetail } from "@/app/minimum-indicators-actions";

export default async function MinimumIndicatorDetailPage({
  params,
}: {
  params: Promise<{ id: string; indicatorId: string }>;
}) {
  const { id: projectId, indicatorId } = await params;
  const user = await getCurrentUser();
  if (!user) return notFound();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, consultantId: true, clientUserId: true },
  });
  if (!project) return notFound();

  const isAdmin = user.role === "ADMIN_PMD";
  const isProjectConsultant = user.role === "CONSULTANT" && project.consultantId === user.id;
  const isProjectClient =
    (user.role === "CLIENT" || user.role === "CLIENT_VIEWER") && project.clientUserId === user.id;
  if (!isAdmin && !isProjectConsultant && !isProjectClient) return notFound();

  const detail = await getMinimumIndicatorDetail({ projectId, indicatorId });
  if (!detail.success) return notFound();

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="outline" className="h-11 w-full rounded-2xl sm:h-9 sm:w-auto sm:rounded-md">
          <Link href={`/projects/${projectId}?view=minimum-indicators`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a indicadores
          </Link>
        </Button>
      </div>
      <MinimumIndicatorDetailClient projectId={projectId} initial={detail} />
    </div>
  );
}

