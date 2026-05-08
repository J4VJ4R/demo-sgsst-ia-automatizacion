-- Add optional dueDate column to Activity for collaborator activity deadlines
ALTER TABLE "Activity" ADD COLUMN "dueDate" TIMESTAMP(3);

