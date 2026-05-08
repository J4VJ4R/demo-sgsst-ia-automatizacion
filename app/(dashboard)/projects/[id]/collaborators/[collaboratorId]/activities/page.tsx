import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/app/auth-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CollaboratorActivityCreateDialog } from "@/components/collaborators/collaborator-activity-create-dialog";
import { ArrowLeft, FileText, User } from "lucide-react";
import { CollaboratorActivitiesTable } from "@/components/collaborators/collaborator-activities-table";
import { updateActivityDueDate } from "@/app/actions";

const DEFAULT_COLLABORATOR_ACTIVITIES = [
  "Contrato",
  "EMO",
  "Inducción",
  "Perfil sociodemográfico",
  "Autor reporte de condiciones de salud",
  "Entrega de EPP",
  "Cursos",
  "Seguimiento a condiciones de salud - Restricciones y recomendaciones",
];

export default async function CollaboratorActivitiesPage({
  params,
}: {
  params: Promise<{ id: string; collaboratorId: string }>;
}) {
  const { id: projectId, collaboratorId } = await params;

  if (!projectId || !collaboratorId) {
    return notFound();
  }

  console.log("[CollaboratorActivitiesPage] Params received", {
    projectId,
    collaboratorId,
  });

  const currentUser = await getCurrentUser();

  console.log("[CollaboratorActivitiesPage] Current user", currentUser
    ? { id: currentUser.id, role: currentUser.role }
    : null);

  const collaborator = await prisma.collaborator.findUnique({
    where: { id: collaboratorId },
    include: {
      project: {
        include: {
          consultant: true,
        },
      },
    },
  });

  if (!collaborator) {
    console.error("[CollaboratorActivitiesPage] Collaborator not found", {
      projectId,
      collaboratorId,
    });
    return (
      <div className="p-8">
        <div className="mx-auto max-w-xl space-y-4 text-center">
          <h1 className="text-2xl font-bold text-slate-900">
            Colaborador no encontrado
          </h1>
          <p className="text-sm text-muted-foreground">
            No se encontró información para este colaborador en la empresa
            seleccionada.
          </p>
          <Button asChild>
            <Link href={`/projects/${projectId}?view=collaborators`}>
              Volver a colaboradores
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (collaborator.projectId !== projectId) {
    console.error("[CollaboratorActivitiesPage] Collaborator belongs to different project", {
      projectIdFromUrl: projectId,
      collaboratorProjectId: collaborator.projectId,
      collaboratorId,
    });
    return (
      <div className="p-8">
        <div className="mx-auto max-w-xl space-y-4 text-center">
          <h1 className="text-2xl font-bold text-slate-900">
            Empresa incorrecta
          </h1>
          <p className="text-sm text-muted-foreground">
            Este colaborador pertenece a otra empresa. Revise la navegación o
            regrese al listado de colaboradores.
          </p>
          <Button asChild>
            <Link href={`/projects/${projectId}?view=collaborators`}>
              Volver a colaboradores
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const userRole = currentUser?.role || "CLIENT_VIEWER";
  const userId = currentUser?.id || null;

  const isAdmin = userRole === "ADMIN_PMD";
  const isProjectConsultant =
    userRole === "CONSULTANT" && !!userId && collaborator.project.consultantId === userId;
  const isProjectClient =
    userRole === "CLIENT_VIEWER" && !!userId && collaborator.project.clientUserId === userId;

  if (!isAdmin && !isProjectConsultant && !isProjectClient) {
    console.warn("[CollaboratorActivitiesPage] Unauthorized access", {
      projectId,
      collaboratorId,
      userRole,
      userId,
      collaboratorProjectId: collaborator.projectId,
      consultantId: collaborator.project.consultantId,
      clientUserId: collaborator.project.clientUserId,
    });
    return (
      <div className="p-8">
        <div className="mx-auto max-w-xl space-y-4 text-center">
          <h1 className="text-2xl font-bold text-slate-900">
            Sin permisos para ver actividades
          </h1>
          <p className="text-sm text-muted-foreground">
            Tu usuario no tiene permisos para administrar las actividades de
            este colaborador.
          </p>
          <Button asChild>
            <Link href="/overview">
              Volver al resumen
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const section = await prisma.projectSection.findUnique({
    where: { projectId_sectionKey: { projectId, sectionKey: "collaborators" } },
    select: { enabled: true },
  });
  if (!section?.enabled) {
    return (
      <div className="p-8">
        <div className="mx-auto max-w-xl space-y-4 text-center">
          <h1 className="text-2xl font-bold text-slate-900">
            Sección desactivada
          </h1>
          <p className="text-sm text-muted-foreground">
            La sección de Colaboradores está desactivada para esta empresa. Actívala desde el panel de Gestión.
          </p>
          <Button asChild>
            <Link href={`/projects/${projectId}?view=collaborators`}>
              Volver a la empresa
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const canManageActivities = !!(isAdmin || isProjectConsultant || isProjectClient);
  const canCreateActivities = !!isAdmin;

  const existingActivities = await prisma.activity.findMany({
    where: {
      projectId,
      collaboratorId,
    },
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

  const existingTitles = new Set(existingActivities.map((a) => a.title));
  const normalizeTitle = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  const removedTitleKey = normalizeTitle("Rendición de cuentas");
  const removeIds = existingActivities
    .filter((a) => normalizeTitle(a.title) === removedTitleKey && a.documents.length === 0)
    .map((a) => a.id);

  if (removeIds.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.notification.deleteMany({ where: { activityId: { in: removeIds } } });
      await tx.activityHistory.deleteMany({ where: { activityId: { in: removeIds } } });
      await tx.document.deleteMany({ where: { activityId: { in: removeIds } } });
      await tx.activity.deleteMany({ where: { id: { in: removeIds } } });
    });
  }

  const missingTitles = DEFAULT_COLLABORATOR_ACTIVITIES.filter(
    (title) => !existingTitles.has(title) && normalizeTitle(title) !== removedTitleKey
  );

  if (missingTitles.length > 0) {
    console.log("[CollaboratorActivitiesPage] Seeding missing activities", {
      projectId,
      collaboratorId,
      missingCount: missingTitles.length,
    });
    await prisma.activity.createMany({
      data: missingTitles.map((title) => ({
        title,
        status: "PENDING",
        priority: "Vencido",
        projectId,
        collaboratorId,
      })),
    });
  }

  const activities = await prisma.activity.findMany({
    where: {
      projectId,
      collaboratorId,
    },
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
    orderBy: { title: "asc" },
  });

  console.log("[CollaboratorActivitiesPage] Activities loaded", {
    projectId,
    collaboratorId,
    count: activities.length,
  });

  const collaboratorFullName = `${collaborator.firstName} ${
    collaborator.secondName ? `${collaborator.secondName} ` : ""
  }${collaborator.firstSurname}${collaborator.secondSurname ? ` ${collaborator.secondSurname}` : ""}`.trim();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link href="/projects" className="hover:underline">
              Empresas
            </Link>
            <span>/</span>
            <Link href={`/projects/${projectId}?view=collaborators`} className="hover:underline">
              Colaboradores
            </Link>
            <span>/</span>
            <span>Actividades</span>
          </div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <User className="h-5 w-5 text-slate-500" />
            <span>{collaboratorFullName}</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Empresa: <span className="font-medium">{collaborator.project.name}</span> · Documento:{" "}
            <span className="font-mono">{collaborator.documentNumber}</span>
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          {canCreateActivities && (
            <CollaboratorActivityCreateDialog
              collaboratorId={collaborator.id}
              projectId={projectId}
              userRole={currentUser?.role}
              currentUserId={currentUser?.id}
            />
          )}
          <Link href={`/projects/${projectId}?view=collaborators`} className="sm:ml-2">
            <Button
              type="button"
              variant="outline"
              className="w-full border-zinc-300 text-slate-800 hover:bg-zinc-100 sm:w-auto"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver a colaboradores
            </Button>
          </Link>
        </div>
      </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Actividades del colaborador</CardTitle>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700">
              <FileText className="h-3 w-3" />
              <span>{activities.length} actividades</span>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <CollaboratorActivitiesTable
              activities={activities.map((activity) => ({
                id: activity.id,
                title: activity.title,
                status: activity.status,
                priority: activity.priority,
                dueDate: activity.dueDate
                  ? new Date(activity.dueDate).toISOString()
                  : null,
                periodicity: activity.periodicity ?? null,
                documents: activity.documents.map((doc) => ({
                  id: doc.id,
                  name: doc.name,
                  url: doc.url,
                  uploadedAt: doc.uploadedAt.toISOString(),
                  version: doc.version ?? 1,
                  sizeBytes: doc.sizeBytes ?? null,
                  uploadedByUser: doc.uploadedByUser
                    ? { name: doc.uploadedByUser.name, role: doc.uploadedByUser.role }
                    : null,
                })),
              }))}
              collaboratorProjectName={collaborator.project.name}
              canManageActivities={canManageActivities}
              isAdmin={isAdmin}
              userRole={currentUser?.role}
              onUpdateDueDate={async (activityId, dueDate) => {
                "use server";
                return await updateActivityDueDate(activityId, dueDate);
              }}
            />
          </CardContent>
        </Card>
    </div>
  );
}
