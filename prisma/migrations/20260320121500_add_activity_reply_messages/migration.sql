-- CreateTable
CREATE TABLE "ActivityReply" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "adminMessage" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "ActivityReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityReply_activityId_idx" ON "ActivityReply"("activityId");
CREATE INDEX "ActivityReply_documentId_idx" ON "ActivityReply"("documentId");
CREATE INDEX "ActivityReply_isRead_idx" ON "ActivityReply"("isRead");

-- AddForeignKey
ALTER TABLE "ActivityReply" ADD CONSTRAINT "ActivityReply_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityReply" ADD CONSTRAINT "ActivityReply_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityReply" ADD CONSTRAINT "ActivityReply_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

