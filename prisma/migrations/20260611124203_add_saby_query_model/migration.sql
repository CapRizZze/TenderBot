-- CreateTable
CREATE TABLE "saby_folders" (
    "id" TEXT NOT NULL,
    "sabyFolderId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saby_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saby_queries" (
    "id" TEXT NOT NULL,
    "sabyQueryId" INTEGER NOT NULL,
    "folderId" TEXT,
    "name" TEXT NOT NULL,
    "parentFolderName" TEXT,
    "ftsString" TEXT NOT NULL DEFAULT '',
    "ftsStringExclude" TEXT NOT NULL DEFAULT '',
    "rawConfigJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saby_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_profile_saby_queries" (
    "id" TEXT NOT NULL,
    "searchProfileId" TEXT NOT NULL,
    "sabyQueryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_profile_saby_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saby_structure_sync_runs" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "foldersCount" INTEGER NOT NULL DEFAULT 0,
    "queriesCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "metaJson" JSONB,

    CONSTRAINT "saby_structure_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saby_query_refresh_runs" (
    "id" TEXT NOT NULL,
    "sabyQueryId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "tendersCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "metaJson" JSONB,

    CONSTRAINT "saby_query_refresh_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saby_folders_sabyFolderId_key" ON "saby_folders"("sabyFolderId");

-- CreateIndex
CREATE INDEX "saby_folders_isActive_sortOrder_idx" ON "saby_folders"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "saby_queries_sabyQueryId_key" ON "saby_queries"("sabyQueryId");

-- CreateIndex
CREATE INDEX "saby_queries_folderId_idx" ON "saby_queries"("folderId");

-- CreateIndex
CREATE INDEX "saby_queries_isActive_updatedAt_idx" ON "saby_queries"("isActive", "updatedAt");

-- CreateIndex
CREATE INDEX "search_profile_saby_queries_sabyQueryId_idx" ON "search_profile_saby_queries"("sabyQueryId");

-- CreateIndex
CREATE INDEX "search_profile_saby_queries_searchProfileId_idx" ON "search_profile_saby_queries"("searchProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "search_profile_saby_queries_searchProfileId_sabyQueryId_key" ON "search_profile_saby_queries"("searchProfileId", "sabyQueryId");

-- CreateIndex
CREATE INDEX "saby_structure_sync_runs_startedAt_idx" ON "saby_structure_sync_runs"("startedAt");

-- CreateIndex
CREATE INDEX "saby_structure_sync_runs_status_startedAt_idx" ON "saby_structure_sync_runs"("status", "startedAt");

-- CreateIndex
CREATE INDEX "saby_query_refresh_runs_sabyQueryId_startedAt_idx" ON "saby_query_refresh_runs"("sabyQueryId", "startedAt");

-- CreateIndex
CREATE INDEX "saby_query_refresh_runs_status_startedAt_idx" ON "saby_query_refresh_runs"("status", "startedAt");

-- AddForeignKey
ALTER TABLE "saby_queries" ADD CONSTRAINT "saby_queries_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "saby_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_profile_saby_queries" ADD CONSTRAINT "search_profile_saby_queries_searchProfileId_fkey" FOREIGN KEY ("searchProfileId") REFERENCES "search_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_profile_saby_queries" ADD CONSTRAINT "search_profile_saby_queries_sabyQueryId_fkey" FOREIGN KEY ("sabyQueryId") REFERENCES "saby_queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saby_query_refresh_runs" ADD CONSTRAINT "saby_query_refresh_runs_sabyQueryId_fkey" FOREIGN KEY ("sabyQueryId") REFERENCES "saby_queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
