-- Con la prenotazione online spenta, al posto dell'agenda compare un form di richiesta appuntamento.
ALTER TABLE "tenants" ADD COLUMN "bookingFormId" TEXT;

-- La Boutique: form "Richiedi il tuo appuntamento" (creato da prisma/setup.boutique-forms.ts) e telefono del centro.
UPDATE "tenants" SET "bookingFormId" = 'boutique-prenota' WHERE "slug" = 'boutique-del-benessere';
UPDATE "tenants" SET "phone" = '+39 351 857 1506' WHERE "slug" = 'boutique-del-benessere' AND ("phone" IS NULL OR "phone" = '');
