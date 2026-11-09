-- Fusion ID: login unico dei software Fusionsoft.
ALTER TABLE "users" ADD COLUMN "fusionIdSub" TEXT;
ALTER TABLE "users" ADD COLUMN "sessionsRevokedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "users_fusionIdSub_key" ON "users"("fusionIdSub");
