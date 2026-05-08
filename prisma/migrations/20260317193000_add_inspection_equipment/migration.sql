ALTER TABLE "Activity" ADD COLUMN "inspectionEquipmentId" TEXT;

CREATE TABLE "inspection_equipment" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "location" TEXT,
  "brand" TEXT,
  "model" TEXT,
  "serial" TEXT,
  "teamResponsible" TEXT NOT NULL,
  "teamUser" TEXT NOT NULL,
  "verificationPeriodicity" TEXT NOT NULL,
  "maintenancePeriodicity" TEXT NOT NULL,
  "observations" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inspection_equipment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inspection_equipment_projectId_idx" ON "inspection_equipment"("projectId");

ALTER TABLE "inspection_equipment"
ADD CONSTRAINT "inspection_equipment_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Activity"
ADD CONSTRAINT "Activity_inspectionEquipmentId_fkey"
FOREIGN KEY ("inspectionEquipmentId") REFERENCES "inspection_equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Activity_inspectionEquipmentId_idx" ON "Activity"("inspectionEquipmentId");

CREATE TABLE "inspection_equipment_photo" (
  "id" TEXT NOT NULL,
  "equipmentId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "sizeBytes" INTEGER,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "uploadedByUserId" TEXT,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "inspection_equipment_photo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inspection_equipment_photo_equipmentId_idx" ON "inspection_equipment_photo"("equipmentId");
CREATE INDEX "inspection_equipment_photo_deletedAt_idx" ON "inspection_equipment_photo"("deletedAt");

ALTER TABLE "inspection_equipment_photo"
ADD CONSTRAINT "inspection_equipment_photo_equipmentId_fkey"
FOREIGN KEY ("equipmentId") REFERENCES "inspection_equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inspection_equipment_photo"
ADD CONSTRAINT "inspection_equipment_photo_uploadedByUserId_fkey"
FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

