CREATE TABLE "saby_api_call_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "operation" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "requestName" TEXT,
    "tenderExternalId" TEXT,
    "tenderNumber" TEXT,
    "status" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "durationMs" INTEGER NOT NULL,
    "usedRequests" INTEGER,
    "dayCounterBefore" INTEGER,
    "dayCounterAfter" INTEGER,
    "dayRemainingBefore" INTEGER,
    "dayRemainingAfter" INTEGER,
    "payloadSummary" JSONB,
    "responseSummary" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saby_api_call_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "saby_api_call_logs_createdAt_idx" ON "saby_api_call_logs"("createdAt");
CREATE INDEX "saby_api_call_logs_operation_createdAt_idx" ON "saby_api_call_logs"("operation", "createdAt");
CREATE INDEX "saby_api_call_logs_method_createdAt_idx" ON "saby_api_call_logs"("method", "createdAt");
CREATE INDEX "saby_api_call_logs_requestName_createdAt_idx" ON "saby_api_call_logs"("requestName", "createdAt");

ALTER TABLE "saby_api_call_logs"
ADD CONSTRAINT "saby_api_call_logs_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
