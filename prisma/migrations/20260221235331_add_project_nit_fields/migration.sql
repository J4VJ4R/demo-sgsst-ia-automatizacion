/*
  Warnings:

  - A unique constraint covering the columns `[nit]` on the table `Project` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "address" TEXT,
ADD COLUMN     "chapter" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "municipality" TEXT,
ADD COLUMN     "nit" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "workerCount" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Project_nit_key" ON "Project"("nit");
