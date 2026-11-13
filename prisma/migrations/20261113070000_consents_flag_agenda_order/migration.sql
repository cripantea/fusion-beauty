-- Consensi attivabili per centro. La Boutique del Benessere non li usa.
ALTER TABLE "tenants" ADD COLUMN "consentsEnabled" BOOLEAN NOT NULL DEFAULT true;

UPDATE "tenants" SET "consentsEnabled" = false WHERE "slug" = 'boutique-del-benessere';

-- Ordine delle colonne in agenda (vista operatrici).
ALTER TABLE "users" ADD COLUMN "agendaOrder" INTEGER NOT NULL DEFAULT 0;

-- La Boutique: prima Roberta, poi Giulia, poi Dalila.
UPDATE "users" u SET "agendaOrder" = CASE
    WHEN u."firstName" ILIKE 'roberta%' THEN 1
    WHEN u."firstName" ILIKE 'giulia%' THEN 2
    WHEN u."firstName" ILIKE 'dalila%' THEN 3
    ELSE 9
  END
FROM "tenants" t
WHERE u."tenantId" = t.id AND t.slug = 'boutique-del-benessere';
