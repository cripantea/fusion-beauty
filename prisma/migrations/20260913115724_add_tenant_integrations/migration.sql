-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('GOOGLE_CALENDAR', 'ICAL_URL');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "icsFeedToken" TEXT;

-- CreateTable
CREATE TABLE "tenant_integrations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "externalCalendarUrl" TEXT,
    "credentials" JSONB,
    "syncToken" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_calendar_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "externalUid" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_integrations_tenantId_type_key" ON "tenant_integrations"("tenantId", "type");

-- CreateIndex
CREATE INDEX "external_calendar_events_tenantId_startTime_idx" ON "external_calendar_events"("tenantId", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "external_calendar_events_integrationId_externalUid_key" ON "external_calendar_events"("integrationId", "externalUid");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_icsFeedToken_key" ON "tenants"("icsFeedToken");

-- AddForeignKey
ALTER TABLE "tenant_integrations" ADD CONSTRAINT "tenant_integrations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_calendar_events" ADD CONSTRAINT "external_calendar_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_calendar_events" ADD CONSTRAINT "external_calendar_events_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "tenant_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

