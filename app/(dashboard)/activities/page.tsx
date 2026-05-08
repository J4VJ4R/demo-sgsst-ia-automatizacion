import prisma from "@/lib/prisma";
import { ActivityList } from "@/components/activities/activity-list";
import { getCurrentUser } from "@/app/auth-actions";
import { buildActivitiesWhere } from "@/lib/activities/build-activities-where";
import { COLLABORATOR_PRELOADED_ACTIVITY_TITLES } from "@/lib/collaborator-preloaded-activities";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function ActivitiesPage(props: {
  searchParams: SearchParams;
}) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  const userRole = user?.role || "CLIENT_VIEWER";
  const userId = user?.id || null;
  const statusParam = typeof searchParams.status === "string" ? searchParams.status : undefined;
  const companyIdParam = typeof searchParams.companyId === "string" ? searchParams.companyId : undefined;
  const priorityParam = typeof searchParams.priority === "string" ? searchParams.priority : undefined;
  const activityBaseWhere = buildActivitiesWhere({
    userRole,
    userId,
    searchParams: {
      status: statusParam,
      companyId:
        companyIdParam,
      priority: priorityParam,
    },
  });

  const sectionGating = {
    OR: [
      { collaboratorId: null, inspectionEquipmentId: null, project: { is: { sections: { some: { sectionKey: "requirements", enabled: true } } } } },
      { collaboratorId: { not: null }, project: { is: { sections: { some: { sectionKey: "collaborators", enabled: true } } } } },
      { inspectionEquipmentId: { not: null }, project: { is: { sections: { some: { sectionKey: "inspection-maintenance", enabled: true } } } } },
    ],
  };

  const excludeCollaboratorPreloaded = {
    NOT: {
      AND: [
        { collaboratorId: { not: null } },
        { title: { in: [...COLLABORATOR_PRELOADED_ACTIVITY_TITLES] } },
      ],
    },
  };

  const activities = await prisma.activity.findMany({
    where: {
      ...activityBaseWhere,
      AND: Array.isArray((activityBaseWhere as any).AND)
        ? [...((activityBaseWhere as any).AND as any[]), sectionGating, excludeCollaboratorPreloaded]
        : (activityBaseWhere as any).AND
          ? [((activityBaseWhere as any).AND as any), sectionGating, excludeCollaboratorPreloaded]
          : [sectionGating, excludeCollaboratorPreloaded],
    },
    include: {
      project: { include: { consultant: true } },
      assignedTo: true,
      documents: {
        where: { deletedAt: null },
        orderBy: { uploadedAt: "desc" },
        select: {
          id: true,
          name: true,
          url: true,
          uploadedAt: true,
        },
      },
      replies: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          adminMessage: true,
          message: true,
          createdAt: true,
          isRead: true,
          document: { select: { id: true, name: true, url: true } },
          createdByUser: { select: { name: true, role: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    // Increase limit significantly when filtering, or remove it if filtering is active?
    // If filtering is active, user expects to see ALL matches usually.
    // Let's increase it to 500 for now to be safe, or 1000.
    take: 500,
  });

  const adminUsers =
    userRole === "CONSULTANT" || userRole === "ADMIN_PMD"
      ? await prisma.user.findMany({
          where: { role: "ADMIN_PMD" },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight text-slate-900">
        Actividades
      </h2>
      <ActivityList
        activities={activities as any}
        userRole={userRole}
        adminUsers={adminUsers}
        currentUserId={user?.id || ""}
      />
    </div>
  );
}
