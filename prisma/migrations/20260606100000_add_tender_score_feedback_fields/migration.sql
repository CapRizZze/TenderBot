ALTER TABLE "public"."tender_profile_scores"
ADD COLUMN "userVerdict" "public"."TenderScoreVerdict",
ADD COLUMN "userComment" TEXT;
