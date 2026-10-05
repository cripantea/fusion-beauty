-- PlanStatus enum
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- ClientPlan: percorsi trattamenti per cliente
CREATE TABLE "client_plans" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "totalSessions" INTEGER NOT NULL,
  "totalPrice" DECIMAL(10,2) NOT NULL,
  "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_plans_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "client_plans_tenantId_clientId_idx" ON "client_plans"("tenantId", "clientId");
ALTER TABLE "client_plans" ADD CONSTRAINT "client_plans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_plans" ADD CONSTRAINT "client_plans_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ClientPlanSession: singole sedute del percorso
CREATE TABLE "client_plan_sessions" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "sessionNumber" INTEGER NOT NULL,
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_plan_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "client_plan_sessions_planId_sessionNumber_key" ON "client_plan_sessions"("planId", "sessionNumber");
ALTER TABLE "client_plan_sessions" ADD CONSTRAINT "client_plan_sessions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "client_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
