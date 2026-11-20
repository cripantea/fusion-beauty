-- La cliente ha già lasciato la recensione su Google: le automazioni non gliela richiedono più.
ALTER TABLE "clients" ADD COLUMN "googleReviewAt" TIMESTAMP(3);

-- "Richiesta recensione dopo la prima visita": dentro il ramo "prima visita" il
-- messaggio parte solo se la cliente non ha già lasciato la recensione.
UPDATE "automations"
SET "steps" = jsonb_set(
      "steps"::jsonb,
      '{0,then}',
      jsonb_build_array(jsonb_build_object(
        'id', 'se-recensita',
        'type', 'CONDITION',
        'condition', jsonb_build_object('field', 'GOOGLE_REVIEW_LEFT'),
        'then', '[]'::jsonb,
        'else', "steps"::jsonb -> 0 -> 'then'
      ))
    ),
    "updatedAt" = NOW()
WHERE "presetKey" = 'boutique:recensione-prima-visita'
  AND "steps"::jsonb -> 0 ->> 'type' = 'CONDITION'
  AND "steps"::jsonb -> 0 -> 'condition' ->> 'field' = 'FIRST_VISIT'
  AND "steps"::text NOT LIKE '%GOOGLE_REVIEW_LEFT%';
