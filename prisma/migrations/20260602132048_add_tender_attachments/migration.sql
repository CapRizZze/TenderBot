-- CreateTable
CREATE TABLE "tender_attachments" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tender_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tender_attachments_tenderId_idx" ON "tender_attachments"("tenderId");

-- CreateIndex
CREATE UNIQUE INDEX "tender_attachments_tenderId_url_key" ON "tender_attachments"("tenderId", "url");

-- AddForeignKey
ALTER TABLE "tender_attachments" ADD CONSTRAINT "tender_attachments_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
