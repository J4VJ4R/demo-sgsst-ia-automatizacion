/*
  Warnings:

  - A unique constraint covering the columns `[contractNumber]` on the table `Project` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'Baja';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "ciiu" TEXT,
ADD COLUMN     "contractNumber" INTEGER,
ADD COLUMN     "contractStartDate" TIMESTAMP(3),
ADD COLUMN     "economicActivity" TEXT,
ADD COLUMN     "riskLevel" TEXT;

-- CreateTable
CREATE TABLE "ActivityHistory" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_contractNumber_key" ON "Project"("contractNumber");

-- AddForeignKey
ALTER TABLE "ActivityHistory" ADD CONSTRAINT "ActivityHistory_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityHistory" ADD CONSTRAINT "ActivityHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
