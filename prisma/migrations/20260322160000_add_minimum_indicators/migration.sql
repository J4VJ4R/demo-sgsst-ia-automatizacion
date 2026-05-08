CREATE TABLE IF NOT EXISTS "minimum_indicator" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT,
  "unit" TEXT NOT NULL,
  "periodicity" TEXT NOT NULL,
  "targetPercent" DOUBLE PRECISION NOT NULL,
  "formula" TEXT NOT NULL,
  "variablesJson" TEXT NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "minimum_indicator_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "minimum_indicator_projectId_idx" ON "minimum_indicator"("projectId");
CREATE INDEX IF NOT EXISTS "minimum_indicator_deletedAt_idx" ON "minimum_indicator"("deletedAt");

DO $$
BEGIN
  ALTER TABLE "minimum_indicator"
  ADD CONSTRAINT "minimum_indicator_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

CREATE TABLE IF NOT EXISTS "minimum_indicator_measurement" (
  "id" TEXT NOT NULL,
  "indicatorId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "inputsJson" TEXT NOT NULL DEFAULT '{}',
  "computedValue" DOUBLE PRECISION NOT NULL,
  "compliancePct" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" TEXT,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "minimum_indicator_measurement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "minimum_indicator_measurement_indicatorId_idx" ON "minimum_indicator_measurement"("indicatorId");
CREATE INDEX IF NOT EXISTS "minimum_indicator_measurement_periodStart_idx" ON "minimum_indicator_measurement"("periodStart");
CREATE INDEX IF NOT EXISTS "minimum_indicator_measurement_deletedAt_idx" ON "minimum_indicator_measurement"("deletedAt");

DO $$
BEGIN
  ALTER TABLE "minimum_indicator_measurement"
  ADD CONSTRAINT "minimum_indicator_measurement_indicatorId_fkey"
  FOREIGN KEY ("indicatorId") REFERENCES "minimum_indicator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "minimum_indicator_measurement"
  ADD CONSTRAINT "minimum_indicator_measurement_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
