ALTER TABLE "tenders"
ADD COLUMN "number" TEXT;

CREATE INDEX "tenders_number_idx" ON "tenders"("number");
