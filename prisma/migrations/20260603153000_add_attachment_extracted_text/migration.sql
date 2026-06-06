-- AlterTable
ALTER TABLE "tender_attachments"
ADD COLUMN "extractedText" TEXT,
ADD COLUMN "extractedTextAt" TIMESTAMP(3),
ADD COLUMN "extractedTextError" TEXT;
