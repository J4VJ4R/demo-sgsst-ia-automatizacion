-- CreateTable
CREATE TABLE "learning_course_enrollment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedByUserId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_course_enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "learning_course_enrollment_courseId_userId_key" ON "learning_course_enrollment"("courseId", "userId");

-- CreateIndex
CREATE INDEX "learning_course_enrollment_userId_idx" ON "learning_course_enrollment"("userId");

-- AddForeignKey
ALTER TABLE "learning_course_enrollment" ADD CONSTRAINT "learning_course_enrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning_course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_course_enrollment" ADD CONSTRAINT "learning_course_enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_course_enrollment" ADD CONSTRAINT "learning_course_enrollment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

