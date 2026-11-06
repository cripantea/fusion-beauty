-- CreateTable
CREATE TABLE "_OperatorExcludedServices" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_OperatorExcludedServices_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_OperatorExcludedServices_B_index" ON "_OperatorExcludedServices"("B");

-- AddForeignKey
ALTER TABLE "_OperatorExcludedServices" ADD CONSTRAINT "_OperatorExcludedServices_A_fkey" FOREIGN KEY ("A") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OperatorExcludedServices" ADD CONSTRAINT "_OperatorExcludedServices_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

