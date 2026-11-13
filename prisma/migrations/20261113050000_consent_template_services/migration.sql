-- Un modello di consenso può valere per più trattamenti (es. tutte le zone del laser 808).
-- AlterTable
ALTER TABLE "consent_templates" ADD COLUMN     "checklist" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "_ConsentTemplateServices" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ConsentTemplateServices_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ConsentTemplateServices_B_index" ON "_ConsentTemplateServices"("B");

-- AddForeignKey
ALTER TABLE "_ConsentTemplateServices" ADD CONSTRAINT "_ConsentTemplateServices_A_fkey" FOREIGN KEY ("A") REFERENCES "consent_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConsentTemplateServices" ADD CONSTRAINT "_ConsentTemplateServices_B_fkey" FOREIGN KEY ("B") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- I modelli già collegati a un solo trattamento finiscono anche nella nuova lista.
INSERT INTO "_ConsentTemplateServices" ("A", "B")
SELECT "id", "serviceId" FROM "consent_templates" WHERE "serviceId" IS NOT NULL
ON CONFLICT DO NOTHING;
