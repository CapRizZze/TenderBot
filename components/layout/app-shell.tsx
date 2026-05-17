import { ChatPanel } from "@/components/chat/chat-panel";
import { Sidebar } from "@/components/layout/sidebar";
import type { KeywordDto } from "@/types/keyword.dto";
import type { Tender } from "@/types/tender-parser.dto";

interface AppShellProps {
  tenders: Tender[];
  initialKeywords: KeywordDto[];
  activeTenderId?: string;
}

export function AppShell({
  tenders,
  initialKeywords,
  activeTenderId,
}: AppShellProps) {
  const activeTender =
    tenders.find((tender) => tender.id === activeTenderId) ?? tenders[0];

  return (
    <main className="flex h-screen min-h-0 flex-col bg-background text-foreground md:flex-row">
      <Sidebar
        activeTenderId={activeTender?.id}
        initialKeywords={initialKeywords}
        tenders={tenders}
      />
      <ChatPanel key={activeTender?.id ?? "empty"} tender={activeTender} />
    </main>
  );
}
