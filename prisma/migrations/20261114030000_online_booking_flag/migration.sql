-- Prenotazione online attivabile per centro. La Boutique del Benessere per ora la sospende.
ALTER TABLE "tenants" ADD COLUMN "onlineBookingEnabled" BOOLEAN NOT NULL DEFAULT true;

UPDATE "tenants" SET "onlineBookingEnabled" = false WHERE "slug" = 'boutique-del-benessere';
