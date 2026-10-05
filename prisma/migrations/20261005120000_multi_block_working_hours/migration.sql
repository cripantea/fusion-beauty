-- Allow multiple blocks per day: drop unique constraint, add non-unique index
DROP INDEX IF EXISTS "working_hours_userId_dayOfWeek_key";
CREATE INDEX IF NOT EXISTS "working_hours_userId_dayOfWeek_idx" ON "working_hours"("userId", "dayOfWeek");

-- Staff exceptions (one-off unavailabilities)
CREATE TABLE "staff_exceptions" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "startTime" TEXT,
  "endTime" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_exceptions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "staff_exceptions_tenantId_userId_idx" ON "staff_exceptions"("tenantId", "userId");
CREATE INDEX "staff_exceptions_userId_date_idx" ON "staff_exceptions"("userId", "date");
ALTER TABLE "staff_exceptions" ADD CONSTRAINT "staff_exceptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_exceptions" ADD CONSTRAINT "staff_exceptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
