import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/app/auth-actions";
import { redirect } from "next/navigation";
import { UsersTable } from "@/components/users/users-table";

export default async function UsersPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || currentUser.role !== 'ADMIN_PMD') {
    redirect('/overview');
  }

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
    include: {
      projectsConsulted: {
        select: { id: true, name: true }
      },
      clientProjects: {
        select: {
          id: true,
          name: true,
          consultant: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        }
      }
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Usuarios</h2>
      </div>
      <UsersTable users={users} />
    </div>
  );
}
