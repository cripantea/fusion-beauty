-- La tabella "payments" e l'enum "PaymentMethod" esistono già (migration 20260918000000):
-- qui si aggiunge solo l'autore dell'incasso. Le altre tabelle legacy (products, booking_requests...)
-- restano intatte per non perdere dati.
CREATE TYPE "AppointmentSource" AS ENUM ('INTERNAL', 'ONLINE');

ALTER TABLE "appointments" ADD COLUMN "source" "AppointmentSource" NOT NULL DEFAULT 'INTERNAL';

ALTER TABLE "clients"
  ADD COLUMN "city" TEXT,
  ADD COLUMN "allergies" TEXT,
  ADD COLUMN "healthNotes" TEXT,
  ADD COLUMN "acquisitionSource" TEXT,
  ADD COLUMN "interests" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "payments" ADD COLUMN "createdById" TEXT;
ALTER TABLE "payments" ADD CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "client_questionnaires" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "answers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_questionnaires_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "client_questionnaires_token_key" ON "client_questionnaires"("token");
CREATE INDEX "client_questionnaires_clientId_idx" ON "client_questionnaires"("clientId");

ALTER TABLE "client_questionnaires" ADD CONSTRAINT "client_questionnaires_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_questionnaires" ADD CONSTRAINT "client_questionnaires_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
