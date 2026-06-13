-- AlterTable
ALTER TABLE "tenders"
ADD COLUMN     "procurementType" TEXT,
ADD COLUMN     "procurementTypeBrief" TEXT,
ADD COLUMN     "sourcePlatformName" TEXT,
ADD COLUMN     "sourcePlatformUrl" TEXT,
ADD COLUMN     "regulationName" TEXT;
