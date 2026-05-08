ALTER TABLE "accidentalidad_empresa" ADD COLUMN "assignedToId" TEXT;

ALTER TABLE "accidentalidad_empresa"
ADD CONSTRAINT "accidentalidad_empresa_assignedToId_fkey"
FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "accidentalidad_empresa_assignedToId_idx" ON "accidentalidad_empresa" ("assignedToId");
