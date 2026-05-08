CREATE TABLE "custom_project_section_activity_document" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedByUserId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "custom_project_section_activity_document_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "custom_project_section_activity_document_activityId_idx" ON "custom_project_section_activity_document"("activityId");
CREATE INDEX "custom_project_section_activity_document_deletedAt_idx" ON "custom_project_section_activity_document"("deletedAt");

ALTER TABLE "custom_project_section_activity_document"
ADD CONSTRAINT "custom_project_section_activity_document_activityId_fkey"
FOREIGN KEY ("activityId") REFERENCES "custom_project_section_activity"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "custom_project_section_activity_document"
ADD CONSTRAINT "custom_project_section_activity_document_uploadedByUserId_fkey"
FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

