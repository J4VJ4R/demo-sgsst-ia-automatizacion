ALTER TABLE "Activity" ADD COLUMN "returnedNote" TEXT;
ALTER TABLE "Activity" ADD COLUMN "returnedAt" TIMESTAMP(3);

CREATE INDEX "Activity_returnedAt_idx" ON "Activity"("returnedAt");

