-- CreateEnum
CREATE TYPE "SabyRequestStatus" AS ENUM ('success', 'empty', 'error', 'daily_limit', 'blocked');

-- CreateTable
CREATE TABLE "saby_request_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "requestName" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" "SabyRequestStatus" NOT NULL,
    "tenderCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saby_request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saby_request_logs_createdAt_idx" ON "saby_request_logs"("createdAt");

-- CreateIndex
CREATE INDEX "saby_request_logs_requestName_createdAt_idx" ON "saby_request_logs"("requestName", "createdAt");

-- CreateIndex
CREATE INDEX "saby_request_logs_status_createdAt_idx" ON "saby_request_logs"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "saby_request_logs" ADD CONSTRAINT "saby_request_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
