-- CreateTable
CREATE TABLE "accidentalidad_empresa" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "actividad" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'Cumplido',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accidentalidad_empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archivos_accidentalidad" (
    "id" TEXT NOT NULL,
    "accidentalidadId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sizeBytes" INTEGER,
    "uploadedByUserId" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "archivos_accidentalidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historial_accidentalidad" (
    "id" TEXT NOT NULL,
    "accidentalidadId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_accidentalidad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accidentalidad_empresa_projectId_idx" ON "accidentalidad_empresa"("projectId");

-- CreateIndex
CREATE INDEX "accidentalidad_empresa_status_idx" ON "accidentalidad_empresa"("status");

-- CreateIndex
CREATE INDEX "archivos_accidentalidad_accidentalidadId_idx" ON "archivos_accidentalidad"("accidentalidadId");

-- CreateIndex
CREATE INDEX "historial_accidentalidad_accidentalidadId_idx" ON "historial_accidentalidad"("accidentalidadId");

-- AddForeignKey
ALTER TABLE "accidentalidad_empresa" ADD CONSTRAINT "accidentalidad_empresa_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archivos_accidentalidad" ADD CONSTRAINT "archivos_accidentalidad_accidentalidadId_fkey" FOREIGN KEY ("accidentalidadId") REFERENCES "accidentalidad_empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archivos_accidentalidad" ADD CONSTRAINT "archivos_accidentalidad_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_accidentalidad" ADD CONSTRAINT "historial_accidentalidad_accidentalidadId_fkey" FOREIGN KEY ("accidentalidadId") REFERENCES "accidentalidad_empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historial_accidentalidad" ADD CONSTRAINT "historial_accidentalidad_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
