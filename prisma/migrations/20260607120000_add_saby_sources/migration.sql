-- CreateEnum
CREATE TYPE "SabySourceRefreshPriority" AS ENUM ('high', 'medium', 'low');

-- CreateTable
CREATE TABLE "saby_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "requestName" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "includeKeywordsText" TEXT NOT NULL DEFAULT '',
    "excludeKeywordsText" TEXT NOT NULL DEFAULT '',
    "refreshPriority" "SabySourceRefreshPriority" NOT NULL DEFAULT 'medium',
    "refreshIntervalMin" INTEGER NOT NULL DEFAULT 1440,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saby_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_profile_saby_sources" (
    "id" TEXT NOT NULL,
    "searchProfileId" TEXT NOT NULL,
    "sabySourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_profile_saby_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saby_sources_requestName_key" ON "saby_sources"("requestName");

-- CreateIndex
CREATE INDEX "saby_sources_isActive_refreshPriority_idx" ON "saby_sources"("isActive", "refreshPriority");

-- CreateIndex
CREATE INDEX "search_profile_saby_sources_sabySourceId_idx" ON "search_profile_saby_sources"("sabySourceId");

-- CreateIndex
CREATE INDEX "search_profile_saby_sources_searchProfileId_idx" ON "search_profile_saby_sources"("searchProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "search_profile_saby_sources_searchProfileId_sabySourceId_key" ON "search_profile_saby_sources"("searchProfileId", "sabySourceId");

-- AddForeignKey
ALTER TABLE "search_profile_saby_sources" ADD CONSTRAINT "search_profile_saby_sources_searchProfileId_fkey" FOREIGN KEY ("searchProfileId") REFERENCES "search_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_profile_saby_sources" ADD CONSTRAINT "search_profile_saby_sources_sabySourceId_fkey" FOREIGN KEY ("sabySourceId") REFERENCES "saby_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed sources from existing SearchProfileRequestName values.
INSERT INTO "saby_sources" (
    "id",
    "name",
    "requestName",
    "description",
    "includeKeywordsText",
    "excludeKeywordsText",
    "refreshPriority",
    "refreshIntervalMin",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    'src_' || md5(lower(trim(spn."requestName"))),
    trim(spn."requestName"),
    trim(spn."requestName"),
    '',
    '',
    '',
    'medium'::"SabySourceRefreshPriority",
    1440,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT "requestName"
    FROM "search_profile_request_names"
    WHERE trim("requestName") <> ''
) spn
ON CONFLICT ("requestName") DO NOTHING;

-- Backfill SearchProfile -> SabySource links from old SearchProfileRequestName links.
INSERT INTO "search_profile_saby_sources" (
    "id",
    "searchProfileId",
    "sabySourceId",
    "createdAt",
    "updatedAt"
)
SELECT
    'sps_' || md5(spn."id" || ss."id"),
    spn."searchProfileId",
    ss."id",
    COALESCE(spn."createdAt", CURRENT_TIMESTAMP),
    COALESCE(spn."updatedAt", CURRENT_TIMESTAMP)
FROM "search_profile_request_names" spn
JOIN "saby_sources" ss
  ON lower(trim(ss."requestName")) = lower(trim(spn."requestName"))
ON CONFLICT ("searchProfileId", "sabySourceId") DO NOTHING;
