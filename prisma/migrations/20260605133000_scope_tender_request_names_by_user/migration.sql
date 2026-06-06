ALTER TABLE "tender_request_names" ADD COLUMN "userId" TEXT;

DROP INDEX IF EXISTS "tender_request_names_tenderId_requestName_key";

CREATE UNIQUE INDEX "tender_request_names_userId_tenderId_requestName_key"
ON "tender_request_names"("userId", "tenderId", "requestName");

CREATE INDEX "tender_request_names_userId_requestName_idx"
ON "tender_request_names"("userId", "requestName");

ALTER TABLE "tender_request_names"
ADD CONSTRAINT "tender_request_names_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
