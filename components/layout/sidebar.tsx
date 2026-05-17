import type { Tender } from "@/types/tender-parser.dto";
import type { KeywordDto } from "@/types/keyword.dto";
import { ConversationList } from "@/components/layout/conversation-list";
import { KeywordEditor } from "@/components/layout/keyword-editor";
import { SignOutButton } from "@/components/layout/sign-out-button";

interface SidebarProps {
  tenders: Tender[];
  initialKeywords: KeywordDto[];
  activeTenderId?: string;
}

const currencyFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function Sidebar({
  tenders,
  initialKeywords,
  activeTenderId,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-full flex-col border-r bg-background md:w-96">
      <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            AI Tender Bot
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            Подбор тендеров
          </h1>
        </div>
        <SignOutButton />
      </div>

      <div className="border-b px-5 py-4">
        <KeywordEditor initialKeywords={initialKeywords} />
      </div>

      <ConversationList />

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {tenders.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
            Тендеры по выбранным ключевым словам пока не найдены.
          </div>
        ) : (
          <nav className="space-y-2" aria-label="Список тендеров">
            {tenders.map((tender) => {
              const isActive = tender.id === activeTenderId;
              const deadline = dateFormatter.format(new Date(tender.deadline));

              return (
                <a
                  className={[
                    "block rounded-lg border px-4 py-3 transition-colors",
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-card hover:bg-accent hover:text-accent-foreground",
                  ].join(" ")}
                  href={`/?tenderId=${encodeURIComponent(tender.id)}`}
                  key={tender.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="line-clamp-2 text-sm font-semibold">
                      {tender.title}
                    </h2>
                    <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                      {deadline}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs opacity-80">
                    {tender.customer}
                  </p>
                  {typeof tender.budget === "number" ? (
                    <p className="mt-3 text-xs font-semibold">
                      {currencyFormatter.format(tender.budget)}
                    </p>
                  ) : null}
                </a>
              );
            })}
          </nav>
        )}
      </div>
    </aside>
  );
}
