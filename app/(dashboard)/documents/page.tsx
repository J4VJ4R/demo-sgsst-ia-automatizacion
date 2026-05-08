import prisma from "@/lib/prisma";
import { DocumentList } from "@/components/documents/document-list";
import { getCurrentUser } from "@/app/auth-actions";

export default async function DocumentsPage() {
  const user = await getCurrentUser();
  const userRole = user?.role || "CLIENT_VIEWER";
  const userId = user?.id || null;

  let projectFilter: any = {};

  if (userRole === "CONSULTANT" && userId) {
    projectFilter = { consultantId: userId };
  } else if (userRole === "CLIENT_VIEWER" && userId) {
    projectFilter = { clientUserId: userId };
  }

  const documents = await prisma.document.findMany({
    include: {
      activity: {
        include: {
          project: true,
        },
      },
    },
    where: {
      deletedAt: null,
      activity: {
        project: projectFilter,
      },
    },
    orderBy: { uploadedAt: "desc" },
  });

  const activities = await prisma.activity.findMany({
    where: {
      project: projectFilter,
    },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight text-slate-900">Documentos</h2>
      <DocumentList documents={documents} activities={activities} />
    </div>
  );
}
