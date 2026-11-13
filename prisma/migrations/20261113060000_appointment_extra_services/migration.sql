-- Più trattamenti nello stesso appuntamento (es. Manicure + Pedicure): il primo resta in "appointments"."serviceId".
-- CreateTable
CREATE TABLE "appointment_extra_services" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,

    CONSTRAINT "appointment_extra_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointment_extra_services_appointmentId_idx" ON "appointment_extra_services"("appointmentId");

-- CreateIndex
CREATE INDEX "appointment_extra_services_serviceId_idx" ON "appointment_extra_services"("serviceId");

-- AddForeignKey
ALTER TABLE "appointment_extra_services" ADD CONSTRAINT "appointment_extra_services_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_extra_services" ADD CONSTRAINT "appointment_extra_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
