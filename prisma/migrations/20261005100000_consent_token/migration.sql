ALTER TABLE "consent_records" ADD COLUMN "token" TEXT;
CREATE UNIQUE INDEX "consent_records_token_key" ON "consent_records"("token");
