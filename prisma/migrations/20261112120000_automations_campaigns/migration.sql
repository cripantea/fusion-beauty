-- CreateEnum
CREATE TYPE "AutomationTrigger" AS ENUM ('CLIENT_CREATED', 'FORM_SUBMITTED', 'BOOKING_REQUESTED', 'APPOINTMENT_CONFIRMED', 'BEFORE_APPOINTMENT', 'AFTER_APPOINTMENT', 'BIRTHDAY', 'CLIENT_INACTIVE', 'QUESTIONNAIRE', 'WHATSAPP_RECEIVED');

-- CreateEnum
CREATE TYPE "AutomationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "AutomationRunStatus" AS ENUM ('RUNNING', 'WAITING', 'COMPLETED', 'FAILED', 'STOPPED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'PAUSED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CampaignRecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "automations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AutomationStatus" NOT NULL DEFAULT 'DRAFT',
    "trigger" "AutomationTrigger" NOT NULL,
    "triggerConfig" JSONB NOT NULL DEFAULT '{}',
    "steps" JSONB NOT NULL DEFAULT '[]',
    "quietHours" BOOLEAN NOT NULL DEFAULT true,
    "allowReentry" BOOLEAN NOT NULL DEFAULT true,
    "stopOnReply" BOOLEAN NOT NULL DEFAULT false,
    "presetKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_runs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "AutomationRunStatus" NOT NULL DEFAULT 'RUNNING',
    "currentStepId" TEXT,
    "resumeAt" TIMESTAMP(3),
    "triggerKey" TEXT NOT NULL,
    "context" JSONB NOT NULL DEFAULT '{}',
    "log" JSONB NOT NULL DEFAULT '[]',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "templateName" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "templateBody" TEXT NOT NULL DEFAULT '',
    "params" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "audience" JSONB NOT NULL DEFAULT '{}',
    "scheduledAt" TIMESTAMP(3),
    "batchSize" INTEGER NOT NULL DEFAULT 40,
    "batchIntervalMinutes" INTEGER NOT NULL DEFAULT 10,
    "nextBatchAt" TIMESTAMP(3),
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_recipients" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" "CampaignRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "messageId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "campaign_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automations_tenantId_trigger_status_idx" ON "automations"("tenantId", "trigger", "status");

-- CreateIndex
CREATE INDEX "automation_runs_status_resumeAt_idx" ON "automation_runs"("status", "resumeAt");

-- CreateIndex
CREATE INDEX "automation_runs_automationId_createdAt_idx" ON "automation_runs"("automationId", "createdAt");

-- CreateIndex
CREATE INDEX "automation_runs_clientId_idx" ON "automation_runs"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "automation_runs_automationId_triggerKey_key" ON "automation_runs"("automationId", "triggerKey");

-- CreateIndex
CREATE INDEX "campaigns_tenantId_createdAt_idx" ON "campaigns"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "campaigns_status_nextBatchAt_idx" ON "campaigns"("status", "nextBatchAt");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_recipients_messageId_key" ON "campaign_recipients"("messageId");

-- CreateIndex
CREATE INDEX "campaign_recipients_campaignId_status_idx" ON "campaign_recipients"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_recipients_campaignId_clientId_key" ON "campaign_recipients"("campaignId", "clientId");

-- AddForeignKey
ALTER TABLE "automations" ADD CONSTRAINT "automations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "whatsapp_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- I 6 messaggi automatici fissi di prima diventano automazioni (un passo "invia template").
INSERT INTO "automations" ("id", "tenantId", "name", "status", "trigger", "triggerConfig", "steps", "presetKey", "allowReentry", "updatedAt")
SELECT
  'mig' || wa."id",
  wa."tenantId",
  CASE wa."kind"
    WHEN 'BOOKING_REQUEST' THEN 'Richiesta online ricevuta'
    WHEN 'BOOKING_CONFIRMED' THEN 'Conferma appuntamento'
    WHEN 'REMINDER' THEN 'Promemoria del giorno prima'
    WHEN 'BIRTHDAY' THEN 'Auguri di compleanno'
    WHEN 'FORM_WELCOME' THEN 'Risposta a un form del sito'
    ELSE 'Questionario nuova cliente'
  END,
  (CASE WHEN wa."enabled" THEN 'ACTIVE' ELSE 'PAUSED' END)::"AutomationStatus",
  (CASE wa."kind"
    WHEN 'BOOKING_REQUEST' THEN 'BOOKING_REQUESTED'
    WHEN 'BOOKING_CONFIRMED' THEN 'APPOINTMENT_CONFIRMED'
    WHEN 'REMINDER' THEN 'BEFORE_APPOINTMENT'
    WHEN 'BIRTHDAY' THEN 'BIRTHDAY'
    WHEN 'FORM_WELCOME' THEN 'FORM_SUBMITTED'
    ELSE 'QUESTIONNAIRE'
  END)::"AutomationTrigger",
  CASE WHEN wa."kind" = 'REMINDER' THEN '{"hours": 24}'::jsonb ELSE '{}'::jsonb END,
  jsonb_build_array(jsonb_build_object(
    'id', 'invio',
    'type', 'SEND_TEMPLATE',
    'templateName', wa."templateName",
    'language', wa."language",
    'templateBody', wa."templateBody",
    'params', to_jsonb(wa."params")
  )),
  lower(wa."kind"::text),
  true,
  CURRENT_TIMESTAMP
FROM "whatsapp_automations" wa
WHERE wa."templateName" <> '';

-- DropTable
DROP TABLE "whatsapp_automations";

-- DropEnum
DROP TYPE "WhatsappAutomationKind";
