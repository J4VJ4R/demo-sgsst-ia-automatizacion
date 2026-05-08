-- CreateTable
CREATE TABLE "sgsst_design_section" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sgsst_design_section_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sgsst_design_file" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sizeBytes" INTEGER,
    "uploadedByUserId" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "sgsst_design_file_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sgsst_design_section_projectId_idx" ON "sgsst_design_section"("projectId");

-- CreateIndex
CREATE INDEX "sgsst_design_section_sortOrder_idx" ON "sgsst_design_section"("sortOrder");

-- CreateIndex
CREATE INDEX "sgsst_design_file_sectionId_idx" ON "sgsst_design_file"("sectionId");

-- CreateIndex
CREATE INDEX "sgsst_design_file_deletedAt_idx" ON "sgsst_design_file"("deletedAt");

-- AddForeignKey
ALTER TABLE "sgsst_design_section" ADD CONSTRAINT "sgsst_design_section_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sgsst_design_file" ADD CONSTRAINT "sgsst_design_file_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sgsst_design_section"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sgsst_design_file" ADD CONSTRAINT "sgsst_design_file_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
