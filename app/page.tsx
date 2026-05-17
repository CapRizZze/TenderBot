import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppShell } from "@/components/layout/app-shell";
import { tenderSyncService } from "@/lib/services/tenderSyncService";
import { userKeywordService } from "@/lib/services/userKeywordService";
import { tenderParserService } from "@/lib/tender-parser/tenderParserService";

interface HomePageProps {
  searchParams?: {
    tenderId?: string;
  };
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const initialKeywords = await userKeywordService.getOrCreateUserKeywords(
    session.user.id,
  );
  const keywordValues = initialKeywords.map((keyword) => keyword.value);
  const parsedTenders = await tenderParserService.fetchTendersByKeywords(
    keywordValues,
  );
  const tenders = await tenderSyncService.syncParsedTenders(parsedTenders);

  return (
    <AppShell
      activeTenderId={searchParams?.tenderId}
      initialKeywords={initialKeywords}
      tenders={tenders}
    />
  );
}
