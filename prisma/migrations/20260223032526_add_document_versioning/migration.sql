-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "sizeBytes" INTEGER,
ADD COLUMN     "uploadedByUserId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
