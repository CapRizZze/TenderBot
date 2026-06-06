-- AlterTable
ALTER TABLE "tenders" ADD COLUMN     "placedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "tenders_placedAt_idx" ON "tenders"("placedAt");
