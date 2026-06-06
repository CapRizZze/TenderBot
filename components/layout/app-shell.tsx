import { ChatPanel } from "@/components/chat/chat-panel";
import { Sidebar } from "@/components/layout/sidebar";
import type { KeywordDto } from "@/types/keyword.dto";
import type { SabyApiCallLogEntry } from "@/types/saby-api-log.dto";
import type { SearchProfileDto } from "@/types/search-profile.dto";
import type {
  SabyDailyLimitStatistics,
  Tender,
} from "@/types/tender-parser.dto";

interface AppShellProps {
  initialKeywords: KeywordDto[];
  tenders: Tender[];
  activeTender?: Tender;
  requestNames: string[];
  availableRequestNames: string[];
  activeRequestName: string;
  searchProfiles: SearchProfileDto[];
  activeSearchProfile?: SearchProfileDto;
  recentSabyApiCalls: SabyApiCallLogEntry[];
  sabyDailyLimitStatistics?: SabyDailyLimitStatistics | null;
  tendersLoadError?: string | null;
  activeTenderId?: string;
}

export function AppShell({
  initialKeywords,
  tenders,
  activeTender,
  requestNames,
  availableRequestNames,
  activeRequestName,
  searchProfiles,
  activeSearchProfile,
  recentSabyApiCalls,
  sabyDailyLimitStatistics,
  tendersLoadError,
  activeTenderId,
}: AppShellProps) {
  const resolvedActiveTender =
    activeTender ??
    tenders.find((tender) => tender.id === activeTenderId);

  return (
    <main className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-background text-foreground md:flex-row">
      <Sidebar
        activeTenderId={resolvedActiveTender?.id}
        activeRequestName={activeRequestName}
        activeSearchProfile={activeSearchProfile}
        availableRequestNames={availableRequestNames}
        initialKeywords={initialKeywords}
        recentSabyApiCalls={recentSabyApiCalls}
        requestNames={requestNames}
        sabyDailyLimitStatistics={sabyDailyLimitStatistics}
        searchProfiles={searchProfiles}
        tendersLoadError={tendersLoadError}
        tenders={tenders}
      />
      <ChatPanel
        activeSearchProfile={activeSearchProfile}
        tender={resolvedActiveTender}
      />
    </main>
  );
}
