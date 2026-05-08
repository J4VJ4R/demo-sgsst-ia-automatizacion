import type { Prisma } from '@prisma/client';

export type ActivitiesSearchParams = {
  status?: string | string[];
  companyId?: string | string[];
  priority?: string | string[];
};

function getString(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value[0];
  return value;
}

export function buildActivitiesWhere(args: {
  userRole: string;
  userId: string | null;
  searchParams: ActivitiesSearchParams;
  now?: Date;
}): Prisma.ActivityWhereInput {
  const { userRole, userId, searchParams } = args;
  const now = args.now ?? new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const inSixteenDaysStart = new Date(todayStart);
  inSixteenDaysStart.setDate(inSixteenDaysStart.getDate() + 16);

  const where: Prisma.ActivityWhereInput = {};

  if (userId && userRole === 'CONSULTANT') {
    where.project = { is: { consultantId: userId } };
  } else if (userId && (userRole === 'CLIENT' || userRole === 'CLIENT_VIEWER')) {
    where.project = { is: { clientUserId: userId } };
  }

  const statusParam = getString(searchParams.status);
  if (statusParam) {
    const statuses = statusParam.split(',').filter(Boolean);
    if (statuses.length > 0) {
      where.status = { in: statuses };
    }
  }

  const companyIdParam = getString(searchParams.companyId);
  if (companyIdParam) {
    where.projectId = companyIdParam;
  }

  const priorityParam = getString(searchParams.priority);
  if (priorityParam) {
    if (priorityParam === 'Vencido') {
      const baseAnd = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : [];
      where.AND = [
        ...baseAnd,
        {
          OR: [
            { dueDate: { not: null, lt: tomorrowStart } },
            {
              AND: [
                { dueDate: null },
                {
                  OR: [
                    { priority: { equals: "Alta", mode: "insensitive" } },
                    { priority: { equals: "Vencido", mode: "insensitive" } },
                    { priority: { equals: "High", mode: "insensitive" } },
                    { priority: { equals: "Critical", mode: "insensitive" } },
                  ],
                },
              ],
            },
          ],
        },
      ];
    } else if (priorityParam === 'Por vencer') {
      const baseAnd = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : [];
      where.AND = [
        ...baseAnd,
        {
          OR: [
            {
              AND: [
                { dueDate: { not: null } },
                { dueDate: { gte: tomorrowStart } },
                { dueDate: { lt: inSixteenDaysStart } },
              ],
            },
            {
              AND: [
                { dueDate: null },
                {
                  OR: [
                    { priority: { equals: "Media", mode: "insensitive" } },
                    { priority: { equals: "Por vencer", mode: "insensitive" } },
                    { priority: { equals: "Medium", mode: "insensitive" } },
                  ],
                },
              ],
            },
          ],
        },
      ];
    } else if (priorityParam === 'Cumplido') {
      const baseAnd = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : [];
      where.AND = [
        ...baseAnd,
        { dueDate: { not: null, gte: inSixteenDaysStart } },
      ];
    }
  }

  return where;
}
