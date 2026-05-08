CREATE TABLE "project_section" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "sectionKey" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "enabledAt" TIMESTAMP(3),
  "enabledBy" TEXT,
  "disabledAt" TIMESTAMP(3),
  "disabledBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_section_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_section_projectId_sectionKey_key" ON "project_section"("projectId", "sectionKey");
CREATE INDEX "project_section_projectId_idx" ON "project_section"("projectId");
CREATE INDEX "project_section_sectionKey_idx" ON "project_section"("sectionKey");

ALTER TABLE "project_section"
ADD CONSTRAINT "project_section_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

