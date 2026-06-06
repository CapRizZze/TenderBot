import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "public"."tender_profile_scores"
    ADD COLUMN IF NOT EXISTS "userVerdict" "public"."TenderScoreVerdict",
    ADD COLUMN IF NOT EXISTS "userComment" TEXT;
  `);

  console.log("score-feedback migration applied");
} finally {
  await prisma.$disconnect();
}
