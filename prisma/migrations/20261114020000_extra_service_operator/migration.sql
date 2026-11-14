-- Ogni trattamento dell'appuntamento può avere la sua operatrice (vuoto = quella dell'appuntamento).
ALTER TABLE "appointment_extra_services" ADD COLUMN "operatorId" TEXT;

CREATE INDEX "appointment_extra_services_operatorId_idx" ON "appointment_extra_services"("operatorId");

ALTER TABLE "appointment_extra_services" ADD CONSTRAINT "appointment_extra_services_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
