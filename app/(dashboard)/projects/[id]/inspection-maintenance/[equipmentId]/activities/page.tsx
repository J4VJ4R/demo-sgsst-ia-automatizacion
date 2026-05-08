import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/app/auth-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wrench } from "lucide-react";
import { CollaboratorActivitiesTable } from "@/components/collaborators/collaborator-activities-table";
import { updateInspectionActivityDueDate } from "@/app/inspection-maintenance-actions";

export default async function InspectionEquipmentActivitiesPage(props: {
  params: Promise<{ id: string; equipmentId: string }>;
}) {
  const { id: projectId, equipmentId } = await props.params;

  const user = await getCurrentUser();
  const userRole = user?.role || "CLIENT_VIEWER";
  const userId = user?.id || null;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, consultantId: true, clientUserId: true },
  });
  if (!project) return notFound();

  const isAdmin = userRole === "ADMIN_PMD";
  const isProjectConsultant = userRole === "CONSULTANT" && !!userId && project.consultantId === userId;
  const isProjectClient = (userRole === "CLIENT" || userRole === "CLIENT_VIEWER") && !!userId && project.clientUserId === userId;

  if (!isAdmin && !isProjectConsultant && !isProjectClient) return notFound();

  const section = await prisma.projectSection.findUnique({
    where: { projectId_sectionKey: { projectId, sectionKey: "inspection-maintenance" } },
    select: { enabled: true },
  });
  if (!section?.enabled) {
    return (
      <div className="p-8">
        <div className="mx-auto max-w-xl space-y-4 text-center">
          <h1 className="text-2xl font-bold text-slate-900">Sección desactivada</h1>
          <p className="text-sm text-muted-foreground">
            La sección de Programa de inspecciones y mantenimiento está desactivada para esta empresa.
          </p>
          <Button asChild>
            <Link href={`/projects/${projectId}?view=inspection-maintenance`}>Volver a la empresa</Link>
          </Button>
        </div>
      </div>
    );
  }

  const equipment = await prisma.inspectionEquipment.findUnique({
    where: { id: equipmentId },
    select: { id: true, projectId: true, name: true },
  });
  if (!equipment || equipment.projectId !== projectId) return notFound();

  const activities = await prisma.activity.findMany({
    where: { projectId, inspectionEquipmentId: equipmentId },
    orderBy: { title: "asc" },
    include: {
      documents: {
        where: { deletedAt: null },
        orderBy: { uploadedAt: "desc" },
        include: {
          uploadedByUser: {
            select: { name: true, role: true },
          },
        },
      },
    },
  });

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="outline" className="h-11 w-full rounded-2xl sm:h-9 sm:w-auto sm:rounded-md">
          <Link href={`/projects/${projectId}?view=inspection-maintenance`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a equipos
          </Link>
        </Button>
      </div>

      <Card className="min-w-0 overflow-x-hidden gap-2 py-3">
        <CardHeader className="px-3 gap-2">
          <div className="grid gap-1">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Wrench className="h-5 w-5 text-[#D4AF37]" />
              {equipment.name}
            </CardTitle>
            <p className="text-sm leading-[1.5] text-slate-600">
              Actividades del equipo registradas en el programa de inspecciones y mantenimiento.
            </p>
          </div>
        </CardHeader>
        <CardContent className="min-w-0 overflow-x-hidden px-3">
          <CollaboratorActivitiesTable
            activities={activities.map((a) => ({
              id: a.id,
              title: a.title,
              status: a.status,
              priority: a.priority,
              dueDate: a.dueDate ? a.dueDate.toISOString() : null,
              periodicity: a.periodicity ?? null,
              documents: a.documents.map((d) => ({
                id: d.id,
                name: d.name,
                url: d.url,
                uploadedAt: d.uploadedAt.toISOString(),
                version: d.version,
                sizeBytes: d.sizeBytes ?? null,
                uploadedByUser: d.uploadedByUser,
              })),
            }))}
            collaboratorProjectName={`${project.name} / ${equipment.name}`}
            canManageActivities={!!(isAdmin || isProjectConsultant || isProjectClient)}
            isAdmin={isAdmin}
            userRole={userRole}
            defaultPriorityWhenNoDueDate="Vencido"
            onUpdateDueDate={updateInspectionActivityDueDate}
          />
        </CardContent>
      </Card>
    </div>
  );
}
