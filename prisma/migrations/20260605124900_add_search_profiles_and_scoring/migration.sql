-- CreateEnum
CREATE TYPE "SearchProfileRuleType" AS ENUM ('positive', 'negative', 'hard_exclude', 'instruction');

-- CreateEnum
CREATE TYPE "TenderScoreVerdict" AS ENUM ('relevant', 'maybe', 'irrelevant');

-- CreateTable
CREATE TABLE "search_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "scoringPrompt" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_profile_request_names" (
    "id" TEXT NOT NULL,
    "searchProfileId" TEXT NOT NULL,
    "requestName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_profile_request_names_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_profile_rules" (
    "id" TEXT NOT NULL,
    "searchProfileId" TEXT NOT NULL,
    "type" "SearchProfileRuleType" NOT NULL,
    "value" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_profile_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_profile_scores" (
    "id" TEXT NOT NULL,
    "tenderId" TEXT NOT NULL,
    "searchProfileId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "verdict" "TenderScoreVerdict" NOT NULL,
    "reasons" JSONB NOT NULL,
    "positiveSignals" JSONB,
    "negativeSignals" JSONB,
    "suggestedRules" JSONB,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tender_profile_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_profiles_userId_idx" ON "search_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "search_profiles_userId_name_key" ON "search_profiles"("userId", "name");

-- CreateIndex
CREATE INDEX "search_profile_request_names_requestName_idx" ON "search_profile_request_names"("requestName");

-- CreateIndex
CREATE INDEX "search_profile_request_names_searchProfileId_idx" ON "search_profile_request_names"("searchProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "search_profile_request_names_searchProfileId_requestName_key" ON "search_profile_request_names"("searchProfileId", "requestName");

-- CreateIndex
CREATE INDEX "search_profile_rules_searchProfileId_type_idx" ON "search_profile_rules"("searchProfileId", "type");

-- CreateIndex
CREATE INDEX "tender_profile_scores_searchProfileId_verdict_score_idx" ON "tender_profile_scores"("searchProfileId", "verdict", "score");

-- CreateIndex
CREATE INDEX "tender_profile_scores_tenderId_idx" ON "tender_profile_scores"("tenderId");

-- CreateIndex
CREATE UNIQUE INDEX "tender_profile_scores_tenderId_searchProfileId_key" ON "tender_profile_scores"("tenderId", "searchProfileId");

-- AddForeignKey
ALTER TABLE "search_profiles" ADD CONSTRAINT "search_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_profile_request_names" ADD CONSTRAINT "search_profile_request_names_searchProfileId_fkey" FOREIGN KEY ("searchProfileId") REFERENCES "search_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_profile_rules" ADD CONSTRAINT "search_profile_rules_searchProfileId_fkey" FOREIGN KEY ("searchProfileId") REFERENCES "search_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_profile_scores" ADD CONSTRAINT "tender_profile_scores_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_profile_scores" ADD CONSTRAINT "tender_profile_scores_searchProfileId_fkey" FOREIGN KEY ("searchProfileId") REFERENCES "search_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
