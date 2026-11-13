-- Pagamenti e link di pagamento collegati a un percorso
ALTER TABLE "payments" ADD COLUMN "planId" TEXT;
ALTER TABLE "payment_links" ADD COLUMN "planId" TEXT;

CREATE INDEX "payments_planId_idx" ON "payments"("planId");
CREATE INDEX "payment_links_planId_idx" ON "payment_links"("planId");

ALTER TABLE "payments" ADD CONSTRAINT "payments_planId_fkey" FOREIGN KEY ("planId") REFERENCES "client_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_links" ADD CONSTRAINT "payment_links_planId_fkey" FOREIGN KEY ("planId") REFERENCES "client_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
