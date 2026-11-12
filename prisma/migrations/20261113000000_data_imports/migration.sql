-- CreateTable
CREATE TABLE "data_imports" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "stats" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "data_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_imports_tenantId_createdAt_idx" ON "data_imports"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "data_imports" ADD CONSTRAINT "data_imports_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
