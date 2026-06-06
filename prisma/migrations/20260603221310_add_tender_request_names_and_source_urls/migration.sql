-- AlterTable
ALTER TABLE "tenders" ADD COLUMN     "sabyUrl" TEXT,
ADD COLUMN     "sourceUrl" TEXT;

-- CreateTable
CREATE TABLE "tender_request_names" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "requestName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tender_request_names_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tender_request_names_requestName_idx" ON "tender_request_names"("requestName");

-- CreateIndex
CREATE INDEX "tender_request_names_tenderId_idx" ON "tender_request_names"("tenderId");

-- CreateIndex
CREATE UNIQUE INDEX "tender_request_names_tenderId_requestName_key" ON "tender_request_names"("tenderId", "requestName");

-- AddForeignKey
ALTER TABLE "tender_request_names" ADD CONSTRAINT "tender_request_names_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
