-- CreateTable
CREATE TABLE "learning_course" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverUrl" TEXT,
    "coverKey" TEXT,
    "coverSizeBytes" INTEGER,
    "certificateEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "learning_course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_module" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "youtubeVideoId" TEXT NOT NULL,
    "materialsJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_module_progress" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_module_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_exam" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "passingScorePercent" INTEGER NOT NULL DEFAULT 70,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_exam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_exam_question" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "optionsJson" TEXT NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "learning_exam_question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_exam_attempt" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scorePercent" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_exam_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_certificate" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attemptId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_certificate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "learning_course_projectId_idx" ON "learning_course"("projectId");

-- CreateIndex
CREATE INDEX "learning_course_deletedAt_idx" ON "learning_course"("deletedAt");

-- CreateIndex
CREATE INDEX "learning_module_courseId_idx" ON "learning_module"("courseId");

-- CreateIndex
CREATE INDEX "learning_module_order_idx" ON "learning_module"("order");

-- CreateIndex
CREATE UNIQUE INDEX "learning_module_progress_moduleId_userId_key" ON "learning_module_progress"("moduleId", "userId");

-- CreateIndex
CREATE INDEX "learning_module_progress_userId_idx" ON "learning_module_progress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_exam_courseId_key" ON "learning_exam"("courseId");

-- CreateIndex
CREATE INDEX "learning_exam_question_examId_idx" ON "learning_exam_question"("examId");

-- CreateIndex
CREATE INDEX "learning_exam_question_order_idx" ON "learning_exam_question"("order");

-- CreateIndex
CREATE INDEX "learning_exam_attempt_examId_idx" ON "learning_exam_attempt"("examId");

-- CreateIndex
CREATE INDEX "learning_exam_attempt_userId_idx" ON "learning_exam_attempt"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_certificate_attemptId_key" ON "learning_certificate"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_certificate_courseId_userId_key" ON "learning_certificate"("courseId", "userId");

-- CreateIndex
CREATE INDEX "learning_certificate_userId_idx" ON "learning_certificate"("userId");

-- AddForeignKey
ALTER TABLE "learning_course" ADD CONSTRAINT "learning_course_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_course" ADD CONSTRAINT "learning_course_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_module" ADD CONSTRAINT "learning_module_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning_course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_module_progress" ADD CONSTRAINT "learning_module_progress_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "learning_module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_module_progress" ADD CONSTRAINT "learning_module_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_exam" ADD CONSTRAINT "learning_exam_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning_course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_exam_question" ADD CONSTRAINT "learning_exam_question_examId_fkey" FOREIGN KEY ("examId") REFERENCES "learning_exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_exam_attempt" ADD CONSTRAINT "learning_exam_attempt_examId_fkey" FOREIGN KEY ("examId") REFERENCES "learning_exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_exam_attempt" ADD CONSTRAINT "learning_exam_attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_certificate" ADD CONSTRAINT "learning_certificate_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "learning_course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_certificate" ADD CONSTRAINT "learning_certificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_certificate" ADD CONSTRAINT "learning_certificate_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "learning_exam_attempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

