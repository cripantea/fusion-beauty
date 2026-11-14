-- Con più trattamenti ognuno ha il suo orario, scelto a mano (vuoto = di seguito, come prima).
ALTER TABLE "appointment_extra_services" ADD COLUMN "startTime" TIMESTAMP(3);
