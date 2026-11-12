-- CreateTable
CREATE TABLE "whatsapp_history_chunks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_history_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_history_chunks_contentHash_key" ON "whatsapp_history_chunks"("contentHash");

-- CreateIndex
CREATE INDEX "whatsapp_history_chunks_tenantId_idx" ON "whatsapp_history_chunks"("tenantId");

-- AddForeignKey
ALTER TABLE "whatsapp_history_chunks" ADD CONSTRAINT "whatsapp_history_chunks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
