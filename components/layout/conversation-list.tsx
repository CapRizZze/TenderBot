"use client";

import { Trash2 } from "lucide-react";
import { useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useConversations } from "@/hooks/use-conversations";

function formatConversationDay(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const dateKey = date.toISOString().slice(0, 10);
  const todayKey = today.toISOString().slice(0, 10);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  if (dateKey === todayKey) {
    return "Сегодня";
  }

  if (dateKey === yesterdayKey) {
    return "Вчера";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
  }).format(date);
}

export function ConversationList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { conversations, isLoading, errorMessage, deleteConversation } = useConversations();

  const activeTenderId = searchParams.get("tenderId") ?? undefined;

  const groups = useMemo(() => {
    const map = new Map<string, typeof conversations>();

    for (const conversation of conversations) {
      const label = formatConversationDay(conversation.updatedAt);
      const existing = map.get(label) ?? [];
      existing.push(conversation);
      map.set(label, existing);
    }

    return [...map.entries()];
  }, [conversations]);

  function openConversation(tenderExternalId: string) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tenderId", tenderExternalId);

    startTransition(() => {
      router.push(`/?${nextParams.toString()}`, { scroll: false });
    });
  }

  async function handleDeleteConversation(tenderExternalId: string) {
    await deleteConversation(tenderExternalId);

    if (searchParams.get("tenderId") === tenderExternalId) {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete("tenderId");
      router.push(`/?${nextParams.toString()}`, { scroll: false });
      router.refresh();
    }
  }

  return (
    <section>
      <div className="space-y-3">
        {isLoading ? <p className="text-xs text-muted-foreground">Загружаем чаты...</p> : null}

        {errorMessage ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {errorMessage}
          </p>
        ) : null}

        {!isLoading && conversations.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Диалоги появятся здесь после первого вопроса по тендеру.
          </p>
        ) : null}

        {groups.map(([label, items]) => (
          <div className="space-y-2" key={label}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <div className="space-y-1.5">
              {items.map((conversation) => {
                const fullTitle = conversation.title ?? conversation.tender.title;
                const isActive = conversation.tender.externalId === activeTenderId;

                return (
                  <div
                    className={[
                      "flex items-start gap-2 rounded-md border bg-card px-2 py-1.5 transition-colors hover:bg-accent/50",
                      isActive ? "border-primary bg-primary/5" : "",
                    ].join(" ")}
                    key={conversation.id}
                  >
                    <button
                      className="min-w-0 flex-1 text-left"
                      disabled={isPending}
                      onClick={() => openConversation(conversation.tender.externalId)}
                      title={fullTitle}
                      type="button"
                    >
                      <p className="line-clamp-1 text-sm font-medium">{fullTitle}</p>
                      {conversation.lastMessage ? (
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                          {conversation.lastMessage.content}
                        </p>
                      ) : null}
                    </button>
                    <button
                      className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => void handleDeleteConversation(conversation.tender.externalId)}
                      title="Удалить чат"
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
