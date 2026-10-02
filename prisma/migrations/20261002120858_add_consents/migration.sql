-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('PRIVACY_GDPR', 'MARKETING', 'TREATMENT');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('PENDING', 'SIGNED', 'REVOKED');

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "dateOfBirth" DATE,
ADD COLUMN     "taxCode" TEXT;

-- CreateTable
CREATE TABLE "consent_templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "ConsentType" NOT NULL,
    "serviceId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "templateId" TEXT NOT NULL,
    "collectedById" TEXT,
    "status" "ConsentStatus" NOT NULL DEFAULT 'PENDING',
    "templateVersion" INTEGER NOT NULL,
    "titleSnapshot" TEXT NOT NULL,
    "bodySnapshot" TEXT NOT NULL,
    "answers" JSONB,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "signatureKey" TEXT,
    "pdfKey" TEXT,
    "documentHash" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "signedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consent_templates_tenantId_type_isActive_idx" ON "consent_templates"("tenantId", "type", "isActive");

-- CreateIndex
CREATE INDEX "consent_records_tenantId_clientId_idx" ON "consent_records"("tenantId", "clientId");

-- CreateIndex
CREATE INDEX "consent_records_tenantId_status_idx" ON "consent_records"("tenantId", "status");

-- CreateIndex
CREATE INDEX "consent_records_appointmentId_idx" ON "consent_records"("appointmentId");

-- AddForeignKey
ALTER TABLE "consent_templates" ADD CONSTRAINT "consent_templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_templates" ADD CONSTRAINT "consent_templates_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "consent_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
