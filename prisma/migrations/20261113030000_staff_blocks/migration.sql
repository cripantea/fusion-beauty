-- CreateTable
CREATE TABLE "staff_blocks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "staff_blocks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "staff_blocks_tenantId_startTime_idx" ON "staff_blocks"("tenantId", "startTime");
CREATE INDEX "staff_blocks_userId_startTime_idx" ON "staff_blocks"("userId", "startTime");
ALTER TABLE "staff_blocks" ADD CONSTRAINT "staff_blocks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_blocks" ADD CONSTRAINT "staff_blocks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
