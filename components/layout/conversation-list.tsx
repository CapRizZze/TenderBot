"use client";

import { MessageSquareText } from "lucide-react";

import { useConversations } from "@/hooks/use-conversations";

export function ConversationList() {
  const { conversations, isLoading, errorMessage } = useConversations();

  return (
    <section className="border-b px-5 py-4">
      <div className="flex items-center gap-2">
        <MessageSquareText className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium">Чаты</p>
      </div>

      <div className="mt-3 space-y-2">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Загружаем чаты...</p>
        ) : null}

        {errorMessage ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {errorMessage}
          </p>
        ) : null}

        {!isLoading && conversations.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Начатые диалоги появятся здесь после первого вопроса по тендеру.
          </p>
        ) : null}

        {conversations.map((conversation) => (
          <a
            className="block rounded-md border bg-card px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            href={`/?tenderId=${encodeURIComponent(
              conversation.tender.externalId,
            )}`}
            key={conversation.id}
          >
            <p className="line-clamp-1 font-medium">
              {conversation.title ?? conversation.tender.title}
            </p>
            {conversation.lastMessage ? (
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                {conversation.lastMessage.content}
              </p>
            ) : null}
          </a>
        ))}
      </div>
    </section>
  );
}
