import assert from "node:assert/strict";
import { buildActivitiesWhere } from "../activities/build-activities-where";
import type { Prisma } from "@prisma/client";

type DueDateFilter = {
  not?: null | Date;
  gt?: Date;
  gte?: Date;
  lt?: Date;
  lte?: Date;
};

function isDueDateFilter(value: unknown): value is DueDateFilter {
  return typeof value === "object" && value !== null && !(value instanceof Date);
}

function normalizeAnd(where: Prisma.ActivityWhereInput) {
  const and = where.AND;
  if (!and) return [];
  return Array.isArray(and) ? and : [and];
}

function hasAndClause(
  where: Prisma.ActivityWhereInput,
  predicate: (clause: Prisma.ActivityWhereInput) => boolean
) {
  return normalizeAnd(where).some((c) => predicate(c));
}

function run() {
  {
    const where = buildActivitiesWhere({
      userRole: "CLIENT",
      userId: "u1",
      searchParams: {},
      now: new Date("2026-03-10T12:00:00Z"),
    });
    assert.equal(where.project?.is?.clientUserId, "u1");
  }

  {
    const where = buildActivitiesWhere({
      userRole: "CLIENT_VIEWER",
      userId: "u2",
      searchParams: {},
      now: new Date("2026-03-10T12:00:00Z"),
    });
    assert.equal(where.project?.is?.clientUserId, "u2");
  }

  {
    const where = buildActivitiesWhere({
      userRole: "CONSULTANT",
      userId: "c1",
      searchParams: {},
      now: new Date("2026-03-10T12:00:00Z"),
    });
    assert.equal(where.project?.is?.consultantId, "c1");
  }

  {
    const now = new Date("2026-03-10T12:00:00Z");
    const where = buildActivitiesWhere({
      userRole: "CLIENT",
      userId: "u1",
      searchParams: { priority: "Por vencer" },
      now,
    });

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const inThirtyOneDaysStart = new Date(todayStart);
    inThirtyOneDaysStart.setDate(inThirtyOneDaysStart.getDate() + 31);

    assert.ok(normalizeAnd(where).length > 0);
    assert.ok(
      hasAndClause(where, (c) => isDueDateFilter(c.dueDate) && c.dueDate.not === null)
    );
    assert.ok(
      hasAndClause(where, (c) => isDueDateFilter(c.dueDate) && c.dueDate.gte instanceof Date)
    );
    assert.ok(
      hasAndClause(where, (c) => isDueDateFilter(c.dueDate) && c.dueDate.lt instanceof Date)
    );
    assert.ok(
      hasAndClause(
        where,
        (c) =>
          isDueDateFilter(c.dueDate) &&
          c.dueDate.gte?.getTime() === tomorrowStart.getTime()
      )
    );
    assert.ok(
      hasAndClause(
        where,
        (c) =>
          isDueDateFilter(c.dueDate) &&
          c.dueDate.lt?.getTime() === inThirtyOneDaysStart.getTime()
      )
    );
  }

  console.log("activities-page-where tests passed");
}

run();
