import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { CollaboratorsManager } from "@/components/collaborators/collaborators-manager";
import { SgSstDesignManager } from "@/components/sgsst-design/sgsst-design-manager";
import { CompanyProjectSectionsNav } from "@/components/projects/company-project-sections-nav";
import { ProjectAgenda } from "@/components/projects/project-agenda";
import { CompanySidebarController } from "@/components/dashboard/company-sidebar-controller";
import { getCurrentUser } from "@/app/auth-actions";

import { ProjectActivitiesTable } from "@/components/projects/project-activities-table";
import { ProjectAccidentalidadTable } from "@/components/projects/project-accidentalidad-table";
import { ProjectActivityCreateDialog } from "@/components/projects/project-activity-create-dialog";
import { AddChapterDialog } from "@/components/projects/add-chapter-dialog";
import { syncAccidentalidadForProject } from "@/app/actions/accidentalidad-actions";
import type { ProjectSectionKey } from "@/app/project-sections-actions";
import { InspectionMaintenanceManager } from "@/components/inspection-maintenance/inspection-maintenance-manager";
import { VehiclesInspectionManager } from "@/components/vehicles-inspection/vehicles-inspection-manager";
import { MinimumIndicatorsManager } from "@/components/minimum-indicators/minimum-indicators-manager";
import { listMinimumIndicators, type MinimumIndicatorListItem } from "@/app/minimum-indicators-actions";
import { listVehicleInspectionVehicles } from "@/app/vehicles-inspection-actions";
import { listDriverInspectionDrivers } from "@/app/drivers-inspection-actions";
import { DriversInspectionManager } from "@/components/drivers-inspection/drivers-inspection-manager";
import { CustomSectionManager } from "@/components/custom-sections/custom-section-manager";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const { view } = await searchParams;

  const user = await getCurrentUser();

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      consultant: true,
      clientUser: true,
    },
  });

  if (!project) return notFound();
  if (project.status === "INACTIVE") {
    const role = user?.role || "CLIENT_VIEWER";
    const isAdmin = role === "ADMIN_PMD" || role === "GESTOR";
    if (!isAdmin) {
      redirect("/projects");
    }
  }

  const activities = await prisma.activity.findMany({
    where: {
      projectId: project.id,
      collaboratorId: null,
      inspectionEquipmentId: null,
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      periodicity: true,
      assignedToId: true,
      replies: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { message: true },
      },
      documents: {
        where: { deletedAt: null },
        orderBy: { uploadedAt: "desc" },
        select: {
          id: true,
          name: true,
          url: true,
          uploadedAt: true,
          version: true,
          sizeBytes: true,
          uploadedByUser: {
            select: { name: true, role: true },
          },
        },
      },
    },
  });

  const userRole = user?.role || "CLIENT_VIEWER";
  const userId = user?.id || null;

  const isAdmin = userRole === "ADMIN_PMD";
  const isProjectConsultant =
    userRole === "CONSULTANT" && !!userId && project.consultantId === userId;
  const isProjectClient =
    (userRole === "CLIENT" || userRole === "CLIENT_VIEWER") &&
    !!userId &&
    project.clientUserId === userId;

  if (!isAdmin && !isProjectConsultant && !isProjectClient) {
    return notFound();
  }

  const sectionDefaults: Record<ProjectSectionKey, boolean> = {
    requirements: true,
    accidentalidad: false,
    collaborators: false,
    "sgsst-design": false,
    "inspection-maintenance": false,
    "minimum-indicators": false,
    "vehicles-inspection": false,
    "drivers-inspection": false,
  };

  const canManageSections = isAdmin || isProjectConsultant;
  const sectionsState: Record<ProjectSectionKey, boolean> = { ...sectionDefaults };
  try {
    const rows = await prisma.projectSection.findMany({
      where: { projectId: project.id },
      select: { sectionKey: true, enabled: true },
    });
    for (const r of rows) {
      const key = r.sectionKey as ProjectSectionKey;
      if (key in sectionsState) sectionsState[key] = r.enabled;
    }
  } catch {}

  let customSections: { id: string; name: string; enabled: boolean; createdAt: Date }[] = [];
  try {
    customSections = await prisma.customProjectSection.findMany({
      where: { projectId: project.id },
      select: { id: true, name: true, enabled: true, createdAt: true },
      orderBy: [{ createdAt: "asc" }],
    });
  } catch {
    customSections = [];
  }

  const viewToSectionKey: Record<string, ProjectSectionKey> = {
    requirements: "requirements",
    accidentalidad: "accidentalidad",
    collaborators: "collaborators",
    "sgsst-design": "sgsst-design",
    "inspection-maintenance": "inspection-maintenance",
    "minimum-indicators": "minimum-indicators",
    "vehicles-inspection": "vehicles-inspection",
    "drivers-inspection": "drivers-inspection",
  };

  const requestedView = view || "requirements";
  const requestedCustomId = requestedView.startsWith("custom-section-")
    ? requestedView.slice("custom-section-".length)
    : null;
  const requestedKey = viewToSectionKey[requestedView] || "requirements";
  const firstEnabled =
    (Object.keys(sectionsState) as ProjectSectionKey[]).find((k) => sectionsState[k]) || null;
  const firstEnabledCustom = customSections.find((s) => s.enabled)?.id || null;
  const fallbackView = firstEnabled
    ? firstEnabled === "collaborators"
      ? "collaborators"
      : firstEnabled === "sgsst-design"
        ? "sgsst-design"
        : firstEnabled
    : firstEnabledCustom
      ? `custom-section-${firstEnabledCustom}`
      : null;
  const effectiveView = requestedCustomId
    ? customSections.some((s) => s.id === requestedCustomId && s.enabled)
      ? requestedView
      : fallbackView
    : sectionsState[requestedKey]
      ? requestedView
      : fallbackView;

  let minimumIndicatorsInitial: { indicators: MinimumIndicatorListItem[]; canManage: boolean } | null = null;
  if (effectiveView === "minimum-indicators") {
    const res = await listMinimumIndicators({ projectId: project.id });
    minimumIndicatorsInitial = res.success ? { indicators: res.indicators, canManage: res.canManage } : { indicators: [], canManage: false };
  }

  const driverCollaborators =
    effectiveView === "vehicles-inspection"
      ? await prisma.collaborator.findMany({
          where: { projectId: project.id, status: "ACTIVE", driverRole: "CONDUCTOR" },
          select: { id: true, firstName: true, secondName: true, firstSurname: true, secondSurname: true, documentNumber: true },
          orderBy: [{ firstName: "asc" }, { firstSurname: "asc" }],
        })
      : [];

  const vehiclesInitial =
    effectiveView === "vehicles-inspection"
      ? await listVehicleInspectionVehicles({ projectId: project.id })
      : null;

  const driversInspectionInitial =
    effectiveView === "drivers-inspection"
      ? await listDriverInspectionDrivers({ projectId: project.id })
      : null;

  const isCustomView = typeof effectiveView === "string" && effectiveView.startsWith("custom-section-");
  const customSectionId = isCustomView ? effectiveView.slice("custom-section-".length) : null;
  const customSection = customSectionId ? customSections.find((s) => s.id === customSectionId) : null;
  let customActivities: { id: string; name: string; dueDate: Date | null; documentName: string | null; documentUrl: string | null; createdAt: Date }[] = [];
  if (customSectionId && customSection) {
    try {
      customActivities = await prisma.customProjectSectionActivity.findMany({
        where: { sectionId: customSectionId, deletedAt: null },
        select: { id: true, name: true, dueDate: true, documentName: true, documentUrl: true, createdAt: true },
        orderBy: [{ createdAt: "desc" }],
      });
    } catch {
      customActivities = [];
    }
  }

  const activeAdmins = await prisma.user.findMany({
    where: { role: "ADMIN_PMD", deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const potentialAssignees = (() => {
    const list: Array<{ id: string; name: string; roleLabel: "Administrador" | "Consultor" | "Cliente" }> = [];

    if (user?.role === "ADMIN_PMD" && user.id) {
      list.push({ id: user.id, name: user.name || "Administrador SG-SST-IA", roleLabel: "Administrador" });
    }

    if (user?.role === "CONSULTANT" || user?.role === "ADMIN_PMD") {
      for (const admin of activeAdmins) {
        list.push({ id: admin.id, name: admin.name || "Administrador SG-SST-IA", roleLabel: "Administrador" });
      }
    }

    if (project.consultantId && project.consultant && !project.consultant.deletedAt) {
      list.push({ id: project.consultantId, name: project.consultant.name || "Consultor asignado", roleLabel: "Consultor" });
    }

    if (project.clientUserId && project.clientUser && !project.clientUser.deletedAt) {
      list.push({ id: project.clientUserId, name: project.clientUser.name || project.clientName || "Cliente", roleLabel: "Cliente" });
    }

    const unique = new Map<string, { id: string; name: string; roleLabel: "Administrador" | "Consultor" | "Cliente" }>();
    for (const u of list) unique.set(u.id, u);
    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name, "es"));
  })();

  if (effectiveView === "accidentalidad") {
    await syncAccidentalidadForProject(project.id);
  }

  const accidentalidad =
    effectiveView === "accidentalidad"
      ? await prisma.accidentalidadEmpresa.findMany({
          where: { projectId: project.id },
          orderBy: { updatedAt: "desc" },
          include: {
            assignedTo: { select: { name: true } },
            archivos: {
              where: { deletedAt: null },
              orderBy: { uploadedAt: "desc" },
            },
          },
        })
      : [];

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-6 overflow-x-hidden lg:grid-cols-[280px_1fr]">
      <CompanySidebarController />
      <aside className="min-w-0 rounded-lg border bg-white">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Empresa</h3>
          <Badge variant="outline" className="text-blue-700 border-blue-200">
            {project.status === "ACTIVE"
              ? "ACTIVA"
              : project.status === "INACTIVE"
              ? "INACTIVA"
              : project.status}
          </Badge>
        </div>
        <div className="p-4 flex justify-center border-b bg-slate-50/50">
          {project.logoUrl ? (
            <div className="relative h-32 w-full">
              <Image
                src={project.logoUrl}
                alt={`Logo ${project.name}`}
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          ) : (
            <div className="h-32 w-32 rounded-full bg-slate-200 flex items-center justify-center text-slate-400">
              <span className="text-xs">Sin Logo</span>
            </div>
          )}
        </div>
        <div className="p-4 space-y-4 text-sm">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Razón Social
              </div>
              <div className="font-semibold text-slate-900 break-words">
                {project.name}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                NIT
              </div>
              <div className="font-medium break-words">
                {project.nit || "No registrado"}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Cliente
              </div>
              <div className="font-medium break-words">
                {project.clientName}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Consultor
              </div>
              <div className="font-medium break-words">
                {project.consultant?.name || "Sin asignar"}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Ubicación
              </div>
              <div className="font-medium break-words">
                {project.municipality && project.department
                  ? `${project.municipality}, ${project.department}`
                  : "No registrada"}
              </div>
              {project.address && (
                <div className="text-xs text-slate-500 break-words">
                  {project.address}
                </div>
              )}
            </div>
            <div>
              <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Contacto
              </div>
              <div className="font-medium break-words">
                {project.phone || "No registrado"}
              </div>
              <div className="text-xs text-slate-500 break-words">
                {project.contactEmail}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Trabajadores
              </div>
              <div className="font-medium">
                {project.workerCount || "No registrado"}
              </div>
            </div>
          </div>

          <details className="group rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2">
            <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-600">
              <span>Información adicional</span>
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3 space-y-3 text-sm">
              <div>
                <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Actividad Económica
                </div>
                <div
                  className="font-medium text-slate-900 break-words"
                  title={project.economicActivity || ""}
                >
                  {project.economicActivity || "No registrada"}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  CIIU
                </div>
                <div className="font-medium">
                  {project.ciiu || "No registrado"}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Inicio Contrato
                </div>
                <div className="font-medium">
                  {project.contractStartDate
                    ? new Date(project.contractStartDate).toLocaleDateString()
                    : "No registrado"}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  No. Contrato
                </div>
                <div className="font-medium break-words">
                  {project.contractNumber || "No registrado"}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Nivel Riesgo
                </div>
                <div className="font-medium">
                  {project.riskLevel
                    ? `Riesgo ${project.riskLevel}`
                    : "No registrado"}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Capítulo Asignado
                </div>
                <div className="font-medium">
                  {project.chapter
                    ? `Capítulo ${project.chapter}`
                    : "No asignado"}
                </div>
              </div>
            </div>
          </details>
        </div>
        <div className="p-4 border-t grid gap-2">
          <Link href="/projects" className="inline-flex">
            <Button variant="outline" className="w-full border-zinc-300 text-slate-800 hover:bg-zinc-100">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a empresas
            </Button>
          </Link>
          
          {/* Herramientas de Administración */}
          <div className="pt-4 border-t mt-2">
             <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Gestión</h4>
             <div className="space-y-2">
              <CompanyProjectSectionsNav
                projectId={project.id}
                view={effectiveView || undefined}
                sections={sectionsState}
                customSections={customSections.map((s) => ({
                  id: s.id,
                  name: s.name,
                  enabled: s.enabled,
                  createdAt: s.createdAt.toISOString(),
                }))}
                canManage={canManageSections}
                userRole={userRole}
              />
             </div>
          </div>
        </div>
      </aside>

      <section className="min-w-0 space-y-6">
        {!effectiveView ? (
          <Card className="gap-2 py-3">
            <CardHeader className="px-3 gap-1">
              <div className="grid gap-1">
                <CardTitle>Secciones desactivadas</CardTitle>
                <p className="text-sm leading-[1.5] text-slate-600">
                  Activa una sección desde el panel de Gestión para empezar a visualizar información.
                </p>
              </div>
            </CardHeader>
          </Card>
        ) : effectiveView === 'collaborators' ? (
          <CollaboratorsManager
            projectId={project.id}
            canManage={!!(isAdmin || isProjectConsultant)}
            userRole={userRole}
          />
        ) : effectiveView === "sgsst-design" ? (
          <SgSstDesignManager
            projectId={project.id}
            canManage={!!(isAdmin || isProjectConsultant)}
            userRole={userRole}
          />
        ) : effectiveView === "accidentalidad" ? (
          <Card className="gap-2 py-3">
            <CardHeader className="px-3 gap-1">
              <div className="grid gap-1">
                <CardTitle>Sección Accidentalidad</CardTitle>
                <p className="text-sm leading-[1.5] text-slate-600">
                  Gestiona evidencias y fechas de vencimiento. Filtra por prioridad y rango de fechas para ubicar actividades rápidamente.
                </p>
              </div>
            </CardHeader>
            <CardContent className="px-3">
              <ProjectAccidentalidadTable
                projectId={project.id}
                projectName={project.name}
                canEdit={!!(isAdmin || isProjectConsultant)}
                canDelete={!!isAdmin}
                userRole={userRole}
                rows={accidentalidad.map((a) => ({
                  id: a.id,
                  actividad: a.actividad,
                  status: a.status,
                  priority: a.priority,
                  dueDate: a.dueDate.toISOString(),
                  createdAt: a.createdAt.toISOString(),
                  assignedTo: a.assignedTo?.name ?? null,
                  archivos: a.archivos.map((d) => ({
                    id: d.id,
                    name: d.name,
                    url: d.url,
                    uploadedAt: d.uploadedAt.toISOString(),
                    version: d.version,
                    sizeBytes: d.sizeBytes ?? null,
                  })),
                }))}
              />
            </CardContent>
          </Card>
        ) : effectiveView === "inspection-maintenance" ? (
          <InspectionMaintenanceManager projectId={project.id} canManage={!!(isAdmin || isProjectConsultant)} />
        ) : effectiveView === "vehicles-inspection" ? (
          <VehiclesInspectionManager
            projectId={project.id}
            canManage={!!(isAdmin || isProjectConsultant)}
            driverOptions={driverCollaborators.map((c) => ({
              id: c.id,
              name: `${c.firstName}${c.secondName ? ` ${c.secondName}` : ""} ${c.firstSurname}${c.secondSurname ? ` ${c.secondSurname}` : ""} (${c.documentNumber})`,
            }))}
            initialVehicles={vehiclesInitial?.success ? vehiclesInitial.vehicles : []}
          />
        ) : effectiveView === "drivers-inspection" ? (
          <DriversInspectionManager
            projectId={project.id}
            canManage={!!(isAdmin || isProjectConsultant)}
            initialDrivers={driversInspectionInitial?.success ? driversInspectionInitial.drivers : []}
          />
        ) : effectiveView === "minimum-indicators" ? (
          <MinimumIndicatorsManager
            projectId={project.id}
            initialIndicators={minimumIndicatorsInitial?.indicators || []}
            canManage={!!(isAdmin || isProjectConsultant)}
          />
        ) : effectiveView === "agenda" ? (
          userRole === "CONSULTANT" && isProjectConsultant ? (
            <ProjectAgenda projectId={project.id} />
          ) : (
            <Card className="min-w-0">
              <CardHeader className="px-3 gap-1">
                <div className="grid gap-1">
                  <CardTitle>Agenda</CardTitle>
                  <p className="text-sm leading-[1.5] text-slate-600">Sin permisos para ver la agenda.</p>
                </div>
              </CardHeader>
            </Card>
          )
        ) : typeof effectiveView === "string" && effectiveView.startsWith("custom-section-") ? (
          <CustomSectionManager
            projectId={project.id}
            sectionId={customSectionId || ""}
            sectionName={customSection?.name || "Sección"}
            canManage={!!(isAdmin || isProjectConsultant)}
            initialActivities={customActivities.map((a) => ({
              id: a.id,
              name: a.name,
              dueDate: a.dueDate ? a.dueDate.toISOString().slice(0, 10) : null,
              documentName: a.documentName ?? null,
              documentUrl: a.documentUrl ?? null,
              createdAt: a.createdAt.toISOString(),
            }))}
          />
        ) : (
          <Card className="min-w-0">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Requisitos / Obligaciones</CardTitle>
              {(isAdmin || isProjectConsultant) && (
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <AddChapterDialog 
                    projectId={project.id}
                    currentChapter={project.chapter}
                  />
                  <ProjectActivityCreateDialog 
                    projectId={project.id}
                    consultantUsers={potentialAssignees}
                    userRole={userRole}
                    currentUserId={userId || undefined}
                  />
                </div>
              )}
            </CardHeader>
            <CardContent className="min-w-0 overflow-x-hidden">
              <ProjectActivitiesTable
                activities={activities.map((a) => ({
                  id: a.id,
                  title: a.title,
                  status: a.status,
                  priority: a.priority,
                  dueDate: a.dueDate ? a.dueDate.toISOString() : null,
                  periodicity: a.periodicity ?? null,
                  assignedToId: a.assignedToId,
                  latestReplyMessage: a.replies?.[0]?.message ?? null,
                  documents: a.documents.map((d) => ({
                    id: d.id,
                    name: d.name,
                    url: d.url,
                    uploadedAt: d.uploadedAt.toISOString(),
                    version: d.version,
                    sizeBytes: d.sizeBytes,
                    uploadedByUser: d.uploadedByUser,
                  })),
                }))}
                projectName={project.name}
                projectId={project.id}
                canManageActivities={!!(isAdmin || isProjectConsultant || isProjectClient)}
                isAdmin={isAdmin}
                consultantUsers={potentialAssignees}
                userRole={userRole}
              />
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
