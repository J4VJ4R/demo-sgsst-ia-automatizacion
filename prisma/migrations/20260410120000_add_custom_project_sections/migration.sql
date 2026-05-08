CREATE TABLE "custom_project_section" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "enabledAt" TIMESTAMP(3),
    "enabledBy" TEXT,
    "disabledAt" TIMESTAMP(3),
    "disabledBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_project_section_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "custom_project_section_activity" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "documentName" TEXT,
    "documentUrl" TEXT,
    "documentKey" TEXT,
    "documentSizeBytes" INTEGER,
    "documentUploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "custom_project_section_activity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "custom_project_section_projectId_idx" ON "custom_project_section"("projectId");

CREATE INDEX "custom_project_section_enabled_idx" ON "custom_project_section"("enabled");

CREATE INDEX "custom_project_section_activity_sectionId_idx" ON "custom_project_section_activity"("sectionId");

CREATE INDEX "custom_project_section_activity_dueDate_idx" ON "custom_project_section_activity"("dueDate");

CREATE INDEX "custom_project_section_activity_deletedAt_idx" ON "custom_project_section_activity"("deletedAt");

ALTER TABLE "custom_project_section" ADD CONSTRAINT "custom_project_section_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "custom_project_section_activity" ADD CONSTRAINT "custom_project_section_activity_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "custom_project_section"("id") ON DELETE CASCADE ON UPDATE CASCADE;
