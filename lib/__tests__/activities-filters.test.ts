import assert from "node:assert";
import {
  applyAdminActivityFilters,
  type ActivityListActivity,
} from "@/components/activities/activity-list";

const sampleActivities: ActivityListActivity[] = [
  {
    id: "a1",
    title: "Inspección inicial",
    status: "PENDING",
    updatedAt: new Date(),
    priority: "Baja",
    project: {
      id: "p1",
      name: "Acme S.A.S.",
      nit: "900123456-1",
    },
    assignedTo: {
      name: "Ana",
    },
    documents: [
      {
        id: "d1",
        name: "Plan de emergencia.pdf",
        url: "https://example.com/plan.pdf",
        uploadedAt: new Date(),
      },
    ],
  },
  {
    id: "a2",
    title: "Plan de emergencia",
    status: "IN_REVIEW",
    updatedAt: new Date(),
    priority: "Media",
    project: {
      id: "p1",
      name: "Acme S.A.S.",
      nit: "900123456-1",
    },
    assignedTo: {
      name: "Ana",
    },
    documents: [
      {
        id: "d2",
        name: "Informe anual.pdf",
        url: "https://example.com/informe.pdf",
        uploadedAt: new Date(),
      },
    ],
  },
  {
    id: "a3",
    title: "Informe anual",
    status: "APPROVED",
    updatedAt: new Date(),
    priority: "Alta",
    project: {
      id: "p2",
      name: "Beta Ltda.",
      nit: "901999888-2",
    },
    assignedTo: {
      name: "Luis",
    },
    documents: [],
  },
] ;

async function run() {
  const noFilter = applyAdminActivityFilters(sampleActivities, {
    statuses: [],
    companyIds: [],
    searchTerm: "",
    categories: [],
    dateRange: "all",
    popularity: "all",
  });

  assert.strictEqual(noFilter.activities.length, 3);
  assert.strictEqual(noFilter.statusCounts.PENDING, 1);
  assert.strictEqual(noFilter.statusCounts.IN_REVIEW, 1);
  assert.strictEqual(noFilter.statusCounts.APPROVED, 1);

  const statusFiltered = applyAdminActivityFilters(sampleActivities, {
    statuses: ["PENDING"],
    companyIds: [],
    searchTerm: "",
    categories: [],
    dateRange: "all",
    popularity: "all",
  });

  assert.strictEqual(statusFiltered.activities.length, 1);
  assert.strictEqual(statusFiltered.activities[0].status, "PENDING");
  assert.strictEqual(statusFiltered.statusCounts.PENDING, 1);

  const companyFiltered = applyAdminActivityFilters(sampleActivities, {
    statuses: [],
    companyIds: ["p1"],
    searchTerm: "",
    categories: [],
    dateRange: "all",
    popularity: "all",
  });

  assert.strictEqual(companyFiltered.activities.length, 2);
  assert.ok(
    companyFiltered.activities.every((a) => a.project.id === "p1"),
  );

  const nameSearch = applyAdminActivityFilters(sampleActivities, {
    statuses: [],
    companyIds: [],
    searchTerm: "acme",
    categories: [],
    dateRange: "all",
    popularity: "all",
  });

  assert.strictEqual(nameSearch.activities.length, 2);
  assert.ok(
    nameSearch.activities.every((a) =>
      a.project.name.toLowerCase().includes("acme"),
    ),
  );

  const nitSearch = applyAdminActivityFilters(sampleActivities, {
    statuses: [],
    companyIds: [],
    searchTerm: "9001",
    categories: [],
    dateRange: "all",
    popularity: "all",
  });

  assert.strictEqual(nitSearch.activities.length, 2);

  const combined = applyAdminActivityFilters(sampleActivities, {
    statuses: ["IN_REVIEW", "APPROVED"],
    companyIds: ["p1"],
    searchTerm: "acme",
    categories: [],
    dateRange: "all",
    popularity: "all",
  });

  const categoryFiltered = applyAdminActivityFilters(sampleActivities, {
    statuses: [],
    companyIds: [],
    searchTerm: "",
    categories: ["Alta"],
    dateRange: "all",
    popularity: "all",
  });

  assert.strictEqual(categoryFiltered.activities.length, 1);
  assert.strictEqual(categoryFiltered.activities[0].status, "APPROVED");

  const dateFiltered = applyAdminActivityFilters(
    sampleActivities.map((a, index) => ({
      ...a,
      updatedAt: new Date(Date.now() - index * 10 * 24 * 60 * 60 * 1000),
    })),
    {
      statuses: [],
      companyIds: [],
      searchTerm: "",
      categories: [],
      dateRange: "7d",
      popularity: "all",
    }
  );

  assert.ok(
    dateFiltered.activities.every(
      (a) =>
        (a.updatedAt as Date).getTime() >=
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).getTime()
    )
  );

  const popularFiltered = applyAdminActivityFilters(
    sampleActivities,
    {
      statuses: [],
      companyIds: [],
      searchTerm: "",
      categories: [],
      dateRange: "all",
      popularity: "withDocs",
    }
  );

  assert.strictEqual(popularFiltered.activities.length, 2);

  assert.strictEqual(combined.activities.length, 1);
  assert.strictEqual(combined.activities[0].status, "IN_REVIEW");

  console.log("activities-filters tests passed");
}

run();
