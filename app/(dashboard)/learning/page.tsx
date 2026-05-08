import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/app/auth-actions";
import { redirect } from "next/navigation";
import { LearningPageClient } from "@/components/learning/learning-page-client";

export default async function LearningPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const role = user.role || "CLIENT_VIEWER";
  const allowed = role === "ADMIN_PMD" || role === "CLIENT" || role === "CLIENT_VIEWER" || role === "STUDENT";
  if (!allowed) redirect("/overview");

  const projectWhere =
    role === "ADMIN_PMD"
      ? {}
      : role === "STUDENT"
      ? {
          status: "ACTIVE",
          learningCourses: {
            some: {
              deletedAt: null,
              enrollments: { some: { userId: user.id } },
            },
          },
        }
      : {
          clientUserId: user.id,
          status: "ACTIVE",
        };

  const projects = await prisma.project.findMany({
    where: projectWhere,
    orderBy: { startDate: "desc" },
    select: { id: true, name: true, clientName: true, status: true },
  });

  const initialProjectId = projects[0]?.id || null;

  return (
    <LearningPageClient
      currentUser={{ id: user.id, name: user.name, role }}
      projects={projects.map((p) => ({
        id: p.id,
        name: p.name,
        clientName: p.clientName,
        status: p.status,
      }))}
      initialProjectId={initialProjectId}
    />
  );
}

