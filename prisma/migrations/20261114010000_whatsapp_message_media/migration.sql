-- Foto e vocali in Messaggi: id del file su Meta e tipo (audio/ogg, image/jpeg…).
ALTER TABLE "whatsapp_messages" ADD COLUMN "mediaId" TEXT;
ALTER TABLE "whatsapp_messages" ADD COLUMN "mediaType" TEXT;
