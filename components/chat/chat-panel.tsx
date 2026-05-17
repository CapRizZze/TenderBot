"use client";

import { SendHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect } from "react";
import { useChat } from "ai/react";

import { useConversationHistory } from "@/hooks/use-conversation-history";
import type { Tender } from "@/types/tender-parser.dto";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface ChatPanelProps {
  tender?: Tender;
}

export function ChatPanel({ tender }: ChatPanelProps) {
  const router = useRouter();
  const {
    conversationId,
    messages: historyMessages,
    isLoading: isHistoryLoading,
    errorMessage: historyErrorMessage,
  } = useConversationHistory(tender?.id);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    setMessages,
  } = useChat({
    api: "/api/chat",
    body: tender
      ? {
          conversationId: conversationId ?? undefined,
          tender,
        }
      : undefined,
    initialMessages: tender
      ? [
          {
            id: `assistant-initial-${tender.id}`,
            role: "assistant",
            content:
              "Я готов проанализировать требования, риски, сроки и соответствие вашей компании этому тендеру.",
          },
        ]
      : [],
    onFinish: () => {
      router.refresh();
    },
  });

  function handleChatSubmit(event: FormEvent<HTMLFormElement>) {
    if (!tender) {
      return;
    }

    handleSubmit(event, {
      body: {
        clientMessageId: crypto.randomUUID(),
        conversationId: conversationId ?? undefined,
        tender,
      },
    });
  }

  useEffect(() => {
    if (historyMessages.length === 0) {
      return;
    }

    setMessages(
      historyMessages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
      })),
    );
  }, [historyMessages, setMessages]);

  if (!tender) {
    return (
      <section className="flex h-full flex-1 items-center justify-center bg-muted/30 px-6">
        <Card className="max-w-md p-6 text-center">
          <h2 className="text-lg font-semibold">Выберите тендер</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            После выбора тендера здесь появится диалог с LLM, история сообщений
            и контекст закупки.
          </p>
        </Card>
      </section>
    );
  }

  return (
    <section className="flex h-full flex-1 flex-col bg-background">
      <header className="border-b px-6 py-4">
        <p className="text-sm text-muted-foreground">Диалог по тендеру</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">
          {tender.title}
        </h2>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {tender.description}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.map((message) => {
            const isUserMessage = message.role === "user";

            return (
              <div
                className={[
                  "max-w-[80%] rounded-lg px-4 py-3 text-sm shadow-sm",
                  isUserMessage
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "border bg-card text-card-foreground",
                ].join(" ")}
                key={message.id}
              >
                <p className="font-medium">
                  {isUserMessage ? "Вы" : "AI Tender Bot"}
                </p>
                <p className="mt-2 whitespace-pre-wrap opacity-90">
                  {message.content}
                </p>
              </div>
            );
          })}

          {isHistoryLoading ? (
            <Card className="max-w-[80%] px-4 py-3 text-sm text-muted-foreground">
              Загружаю историю диалога...
            </Card>
          ) : null}

          {historyErrorMessage ? (
            <Card className="max-w-[80%] border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {historyErrorMessage}
            </Card>
          ) : null}

          {isLoading ? (
            <Card className="max-w-[80%] px-4 py-3 text-sm text-muted-foreground">
              AI Tender Bot анализирует тендер...
            </Card>
          ) : null}

          {error ? (
            <Card className="max-w-[80%] border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              Не удалось получить ответ LLM. Проверьте настройки Qwen API и
              попробуйте снова.
            </Card>
          ) : null}
        </div>
      </div>

      <form className="border-t bg-card px-6 py-4" onSubmit={handleChatSubmit}>
        <div className="mx-auto flex max-w-3xl gap-3">
          <label className="sr-only" htmlFor="chat-message">
            Сообщение для AI Tender Bot
          </label>
          <Textarea
            className="min-h-12 flex-1 resize-none"
            id="chat-message"
            onChange={handleInputChange}
            placeholder="Задайте вопрос по тендеру"
            rows={1}
            value={input}
          />
          <Button className="h-12 gap-2 px-5" disabled={isLoading} type="submit">
            <SendHorizontal className="h-4 w-4" />
            <span>Отправить</span>
          </Button>
        </div>
      </form>
    </section>
  );
}
