import { ChatPanel } from "@/components/chat/chat-panel";
import { Sidebar } from "@/components/layout/sidebar";
import type { SabyApiCallLogEntry } from "@/types/saby-api-log.dto";
import type { SabyQueryDto } from "@/types/saby-query.dto";
import type { SearchProfileDto } from "@/types/search-profile.dto";
import type {
  SabyDailyLimitStatistics,
  Tender,
} from "@/types/tender-parser.dto";

interface AppShellProps {
  tenders: Tender[];
  activeTender?: Tender;
  activeQueryId?: string;
  availableQueries: SabyQueryDto[];
  canSyncSabyStructure: boolean;
  activeRequestName: string;
  searchProfiles: SearchProfileDto[];
  activeSearchProfile?: SearchProfileDto;
  recentSabyApiCalls: SabyApiCallLogEntry[];
  sabyDailyLimitStatistics?: SabyDailyLimitStatistics | null;
  tendersLoadError?: string | null;
  activeTenderId?: string;
}

export function AppShell({
  tenders,
  activeTender,
  activeQueryId,
  availableQueries,
  canSyncSabyStructure,
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
    <main className="flex h-[100dvh] min-h-0 min-w-0 flex-col overflow-hidden bg-background text-foreground md:flex-row">
      <Sidebar
        activeQueryId={activeQueryId}
        activeTenderId={resolvedActiveTender?.id}
        activeRequestName={activeRequestName}
        activeSearchProfile={activeSearchProfile}
        availableQueries={availableQueries}
        canSyncSabyStructure={canSyncSabyStructure}
        recentSabyApiCalls={recentSabyApiCalls}
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
