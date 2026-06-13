"use client";

import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FileType,
  Paperclip,
  SendHorizontal,
} from "lucide-react";
import { useChat } from "ai/react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useConversationHistory } from "@/hooks/use-conversation-history";
import { dispatchConversationsUpdated } from "@/lib/client-events";
import type { SearchProfileDto } from "@/types/search-profile.dto";
import type { Tender, TenderAttachment } from "@/types/tender-parser.dto";
import { getErrorMessageFromResponse } from "@/utils/api-client";

interface ChatPanelProps {
  tender?: Tender;
  activeSearchProfile?: SearchProfileDto;
}

interface TenderDocumentsResponse {
  documents?: TenderAttachment[];
  source?: "cache" | "saby" | "none";
}

const DEFAULT_TENDER_ANALYSIS_PROMPT = [
  "Сделай анализ текущего тендера по документам и карточке тендера.",
  "1. Сделай выжимку из документов.",
  "2. Выяви плюсы и риски участия.",
  "3. Рассчитай маржинальность.",
  "4. Если данных для точного расчёта не хватает, явно укажи это и дай сценарный расчёт с допущениями.",
  "5. Ответ дай обычным текстом, без HTML и markdown-таблиц.",
].join("\n");

const tenderDateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const currencyFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const TENDER_CONTEXT_COLLAPSED_STORAGE_KEY = "tenderbot:tender-context-collapsed";

function getDisplayTenderSourceUrl(tender: Tender): string {
  return tender.sourcePlatformUrl ?? tender.sourceUrl ?? tender.url;
}

function getProcurementTypeLabel(tender: Tender) {
  return tender.procurementType ?? "Не указан";
}

function getSourcePlatformLabel(tender: Tender) {
  return tender.sourcePlatformName ?? "Не указан";
}

function getRegulationBadgeLabel(tender: Tender) {
  if (!tender.regulationName) {
    return null;
  }

  if (tender.regulationName.includes("44")) {
    return "44-ФЗ";
  }

  if (tender.regulationName.includes("223")) {
    return "223-ФЗ";
  }

  return tender.regulationName;
}

function getFileExtension(fileName: string) {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()!.toUpperCase() : "FILE";
}

function getAttachmentVisual(fileName: string) {
  const extension = getFileExtension(fileName);

  if (extension === "PDF") {
    return {
      label: "PDF",
      icon: FileType,
      className: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  if (extension === "DOC" || extension === "DOCX" || extension === "RTF") {
    return {
      label: extension === "RTF" ? "RTF" : "WORD",
      icon: FileText,
      className: "border-blue-200 bg-blue-50 text-blue-700",
    };
  }

  if (extension === "XLS" || extension === "XLSX" || extension === "CSV") {
    return {
      label: "XLS",
      icon: FileSpreadsheet,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  return {
    label: extension,
    icon: FileText,
    className: "border-slate-200 bg-slate-50 text-slate-700",
  };
}

function formatTenderDateTime(value?: string) {
  if (!value) {
    return "Нет данных";
  }

  return tenderDateTimeFormatter.format(new Date(value));
}

function getScoreVerdictLabel(verdict: "relevant" | "maybe" | "irrelevant") {
  switch (verdict) {
    case "relevant":
      return "Релевантен";
    case "maybe":
      return "Под вопросом";
    default:
      return "Скрыт";
  }
}

export function ChatPanel({ tender, activeSearchProfile }: ChatPanelProps) {
  const [documents, setDocuments] = useState<TenderAttachment[]>(tender?.attachments ?? []);
  const [selectedDocumentUrls, setSelectedDocumentUrls] = useState<string[]>([]);
  const [isDocumentsLoading, setIsDocumentsLoading] = useState(false);
  const [isQuickAnalysisRunning, setIsQuickAnalysisRunning] = useState(false);
  const [documentsErrorMessage, setDocumentsErrorMessage] = useState<string | null>(null);
  const [isTenderContextCollapsed, setIsTenderContextCollapsed] = useState(false);
  const [feedbackVerdict, setFeedbackVerdict] = useState<
    "relevant" | "maybe" | "irrelevant" | null
  >(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [isFeedbackSaving, setIsFeedbackSaving] = useState(false);
  const [isFeedbackApplying, setIsFeedbackApplying] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const previousTenderIdRef = useRef<string | undefined>(undefined);
  const autoFetchedDocumentsTenderIdRef = useRef<string | undefined>(undefined);

  const {
    conversationId,
    messages: historyMessages,
    isLoading: isHistoryLoading,
    errorMessage: historyErrorMessage,
    loadHistory,
  } = useConversationHistory(tender?.id);

  const effectiveTender = useMemo(
    () =>
      tender
        ? {
            ...tender,
            attachments: documents,
          }
        : undefined,
    [documents, tender],
  );

  const selectedAttachments = useMemo(
    () => documents.filter((attachment) => selectedDocumentUrls.includes(attachment.url)),
    [documents, selectedDocumentUrls],
  );
  const effectiveScoreVerdict = feedbackVerdict ?? tender?.profileScore?.userVerdict ?? tender?.profileScore?.verdict;

  const tenderSourceUrl = useMemo(
    () => (tender ? getDisplayTenderSourceUrl(tender) : undefined),
    [tender],
  );

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    setInput,
    setMessages,
    append,
  } = useChat({
    api: "/api/chat",
    body: effectiveTender
      ? {
          conversationId: conversationId ?? undefined,
          tender: effectiveTender,
          selectedAttachments,
        }
      : undefined,
    initialMessages: [],
    onFinish: () => {
      setIsQuickAnalysisRunning(false);
      void loadHistory();
      dispatchConversationsUpdated();
    },
    onError: (chatError) => {
      setIsQuickAnalysisRunning(false);
      setDocumentsErrorMessage(chatError.message);
    },
  });

  useEffect(() => {
    const storedValue = window.localStorage.getItem(TENDER_CONTEXT_COLLAPSED_STORAGE_KEY);
    setIsTenderContextCollapsed(storedValue === "1");
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      TENDER_CONTEXT_COLLAPSED_STORAGE_KEY,
      isTenderContextCollapsed ? "1" : "0",
    );
  }, [isTenderContextCollapsed]);

  useEffect(() => {
    const nextTenderId = tender?.id;
    const previousTenderId = previousTenderIdRef.current;

    if (previousTenderId && nextTenderId && previousTenderId !== nextTenderId) {
      setIsTenderContextCollapsed(false);
    }

    previousTenderIdRef.current = nextTenderId;
    setDocuments(tender?.attachments ?? []);
    setSelectedDocumentUrls([]);
    setDocumentsErrorMessage(null);
    setIsDocumentsLoading(false);
    setIsQuickAnalysisRunning(false);
    setFeedbackVerdict(tender?.profileScore?.userVerdict ?? null);
    setFeedbackComment(tender?.profileScore?.userComment ?? "");
    setFeedbackMessage(null);
    setIsFeedbackSaving(false);
    setIsFeedbackApplying(false);
    autoFetchedDocumentsTenderIdRef.current = undefined;
    setMessages([]);
  }, [setMessages, tender]);

  useEffect(() => {
    if (!tender) {
      setMessages([]);
      return;
    }

    setMessages(
      historyMessages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
      })),
    );
  }, [historyMessages, setMessages, tender]);

  const fetchTenderDocumentsFromApi = useCallback(
    async (): Promise<TenderAttachment[]> => {
      if (!tender) {
        return [];
      }

      const response = await fetch(
        `/api/tenders/${encodeURIComponent(tender.id)}/documents`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error(
          await getErrorMessageFromResponse(
            response,
            "РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕР»СѓС‡РёС‚СЊ РґРѕРєСѓРјРµРЅС‚С‹ С‚РµРЅРґРµСЂР° РёР· Saby",
          ),
        );
      }

      const data = (await response.json()) as TenderDocumentsResponse;
      const nextDocuments = Array.isArray(data.documents) ? data.documents : [];

      setDocuments(nextDocuments);
      setSelectedDocumentUrls((currentUrls) =>
        currentUrls.filter((url) =>
          nextDocuments.some((attachment) => attachment.url === url),
        ),
      );

      return nextDocuments;
    },
    [tender],
  );

  useEffect(() => {
    if (
      !tender ||
      tender.attachments.length > 0 ||
      isDocumentsLoading ||
      autoFetchedDocumentsTenderIdRef.current === tender.id
    ) {
      return;
    }

    let isCancelled = false;

    autoFetchedDocumentsTenderIdRef.current = tender.id;
    setIsDocumentsLoading(true);
    setDocumentsErrorMessage(null);

    void fetchTenderDocumentsFromApi()
      .catch((documentsError) => {
        if (isCancelled) {
          return;
        }

        setDocumentsErrorMessage(
          documentsError instanceof Error
            ? documentsError.message
            : "Не удалось получить документы тендера из Saby",
        );
      })
      .finally(() => {
        if (!isCancelled) {
          setIsDocumentsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [fetchTenderDocumentsFromApi, isDocumentsLoading, tender]);

  function handleChatSubmit(event: FormEvent<HTMLFormElement>) {
    if (!effectiveTender) {
      return;
    }

    handleSubmit(event, {
      body: {
        clientMessageId: crypto.randomUUID(),
        conversationId: conversationId ?? undefined,
        tender: effectiveTender,
        selectedAttachments,
      },
    });
  }

  /* const fetchTenderDocumentsFromApi = useCallback(async (): Promise<TenderAttachment[]> => {
      if (!tender) {
        return [];
      }

      const response = await fetch(
        `/api/tenders/${encodeURIComponent(tender.id)}/documents`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error(
          await getErrorMessageFromResponse(
            response,
            "Не удалось получить документы тендера из Saby",
          ),
        );
      }

      const data = (await response.json()) as TenderDocumentsResponse;
      const nextDocuments = Array.isArray(data.documents) ? data.documents : [];

      setDocuments(nextDocuments);
      setSelectedDocumentUrls((currentUrls) =>
        currentUrls.filter((url) =>
          nextDocuments.some((attachment) => attachment.url === url),
        ),
      );

      return nextDocuments;
  }, [tender]); */

  function toggleAttachmentSelection(url: string) {
    setSelectedDocumentUrls((currentUrls) =>
      currentUrls.includes(url)
        ? currentUrls.filter((currentUrl) => currentUrl !== url)
        : [...currentUrls, url],
    );
  }

  function handleInsertSelectedDocuments() {
    if (selectedAttachments.length === 0) {
      return;
    }

    const attachmentSummary = selectedAttachments
      .map((attachment) => `- ${attachment.name}: ${attachment.url}`)
      .join("\n");
    const prefix = input.trim().length > 0 ? `${input.trim()}\n\n` : "";

    setInput(
      `${prefix}Проанализируй документы по тендеру:\n${attachmentSummary}\n\nСфокусируйся на требованиях, рисках, сроках и критичных условиях участия.`,
    );
  }

  async function handleQuickAnalysis() {
    if (!effectiveTender || isLoading || isDocumentsLoading || isQuickAnalysisRunning) {
      return;
    }

    setIsQuickAnalysisRunning(true);
    setDocumentsErrorMessage(null);

    try {
      let nextDocuments = documents;

      if (nextDocuments.length === 0) {
        setIsDocumentsLoading(true);

        try {
          nextDocuments = await fetchTenderDocumentsFromApi();
        } finally {
          setIsDocumentsLoading(false);
        }
      }

      setSelectedDocumentUrls(nextDocuments.map((attachment) => attachment.url));

      await append(
        {
          role: "user",
          content: DEFAULT_TENDER_ANALYSIS_PROMPT,
        },
        {
          body: {
            clientMessageId: crypto.randomUUID(),
            conversationId: conversationId ?? undefined,
            tender: {
              ...effectiveTender,
              attachments: nextDocuments,
            },
            selectedAttachments: nextDocuments,
          },
        },
      );
    } catch (analysisError) {
      setIsQuickAnalysisRunning(false);
      setDocumentsErrorMessage(
        analysisError instanceof Error
          ? analysisError.message
          : "Не удалось запустить анализ тендера",
      );
    }
  }

  async function submitScoreFeedback(applyToProfile: boolean) {
    if (!tender || !activeSearchProfile || !effectiveScoreVerdict) {
      return;
    }

    if (applyToProfile) {
      setIsFeedbackApplying(true);
    } else {
      setIsFeedbackSaving(true);
    }

    setFeedbackMessage(null);

    try {
      const response = await fetch(
        `/api/tenders/${encodeURIComponent(tender.id)}/score-feedback`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            searchProfileId: activeSearchProfile.id,
            verdict: effectiveScoreVerdict,
            comment: feedbackComment,
            applyToProfile,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          await getErrorMessageFromResponse(
            response,
            "Не удалось сохранить feedback по скорингу",
          ),
        );
      }

      const data = (await response.json()) as {
        createdRules?: Array<{ type: string; value: string }>;
      };

      if (applyToProfile) {
        const createdRulesCount = Array.isArray(data.createdRules)
          ? data.createdRules.length
          : 0;
        setFeedbackMessage(
          createdRulesCount > 0
            ? `Профиль обновлён. Добавлено правил: ${createdRulesCount}.`
            : "Feedback сохранён. Новых правил не понадобилось.",
        );
      } else {
        setFeedbackMessage("Оценка профиля сохранена.");
      }
    } catch (feedbackError) {
      setFeedbackMessage(
        feedbackError instanceof Error
          ? feedbackError.message
          : "Не удалось сохранить feedback по скорингу",
      );
    } finally {
      setIsFeedbackSaving(false);
      setIsFeedbackApplying(false);
    }
  }

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-background">
      <header className="border-b px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-col gap-3">
          {tender ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground">Диалог по тендеру</p>
                  <div className="mt-1 flex items-start justify-between gap-3">
                    <h2 className="min-w-0 flex-1 text-lg font-semibold leading-tight text-balance">
                      {tender.title}
                    </h2>
                    {getRegulationBadgeLabel(tender) ? (
                      <span className="shrink-0 rounded-md border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {getRegulationBadgeLabel(tender)}
                      </span>
                    ) : null}
                  </div>
                  {!isTenderContextCollapsed ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground text-pretty">
                      {tender.description}
                    </p>
                  ) : null}
                </div>
                <button
                  aria-label={
                    isTenderContextCollapsed
                      ? "Развернуть информацию о тендере"
                      : "Свернуть информацию о тендере"
                  }
                  className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  onClick={() => setIsTenderContextCollapsed((current) => !current)}
                  type="button"
                >
                  {isTenderContextCollapsed ? (
                      <ChevronDown className="h-4 w-4" />
                  ) : (
                      <ChevronUp className="h-4 w-4" />
                  )}
                </button>
              </div>

              {!isTenderContextCollapsed ? (
                <>
                  <div className="grid gap-2 text-sm xl:grid-cols-[minmax(0,2fr)_minmax(0,1.35fr)]">
                    <div className="rounded-md border bg-card px-3 py-2.5">
                      <div className="text-[11px] uppercase text-muted-foreground">
                        Организация закупки
                      </div>
                      <div className="mt-1 line-clamp-3 font-medium">{tender.customer}</div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-md border bg-card px-3 py-2">
                        <div className="text-[11px] uppercase text-muted-foreground">
                          Время размещения
                        </div>
                        <div className="mt-1 font-medium leading-5 tabular-nums">
                          {formatTenderDateTime(tender.placedAt)}
                        </div>
                      </div>
                      <div className="rounded-md border bg-card px-3 py-2">
                        <div className="text-[11px] uppercase text-muted-foreground">
                          Срок подачи
                        </div>
                        <div className="mt-1 font-medium leading-5 tabular-nums">
                          {formatTenderDateTime(tender.deadline)}
                        </div>
                      </div>
                      <div className="rounded-md border bg-card px-3 py-2">
                        <div className="text-[11px] uppercase text-muted-foreground">
                          Тип закупки
                        </div>
                        <div className="mt-1 font-medium leading-5">
                          {getProcurementTypeLabel(tender)}
                        </div>
                      </div>
                      <div className="rounded-md border bg-card px-3 py-2">
                        <div className="text-[11px] uppercase text-muted-foreground">
                          Цена контракта
                        </div>
                        <div className="mt-1 font-medium leading-5 tabular-nums">
                          {typeof tender.budget === "number"
                            ? currencyFormatter.format(tender.budget)
                            : "Нет данных"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {tender.profileScore && activeSearchProfile ? (
                    <Card className="px-3 py-3">
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] uppercase text-muted-foreground">
                              Скоринг профиля
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-muted px-2 py-0.5 text-sm font-semibold tabular-nums">
                                {tender.profileScore.score}/100
                              </span>
                              <span className="text-sm font-medium">
                                {getScoreVerdictLabel(
                                  effectiveScoreVerdict ?? tender.profileScore.verdict,
                                )}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Профиль: {activeSearchProfile.name}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(["relevant", "maybe", "irrelevant"] as const).map((verdict) => {
                              const isActive = effectiveScoreVerdict === verdict;

                              return (
                                <Button
                                  className="h-8 px-3 text-xs"
                                  key={verdict}
                                  onClick={() => setFeedbackVerdict(verdict)}
                                  size="sm"
                                  type="button"
                                  variant={isActive ? "default" : "outline"}
                                >
                                  {getScoreVerdictLabel(verdict)}
                                </Button>
                              );
                            })}
                          </div>
                        </div>

                        {tender.profileScore.reasons.length > 0 ? (
                          <div className="space-y-1">
                            <p className="text-[11px] uppercase text-muted-foreground">
                              Причины
                            </p>
                            <ul className="space-y-1 text-sm text-muted-foreground">
                              {tender.profileScore.reasons.slice(0, 3).map((reason) => (
                                <li key={reason}>• {reason}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        <Textarea
                          className="min-h-[72px] resize-none text-sm"
                          onChange={(event) => setFeedbackComment(event.target.value)}
                          placeholder="Комментарий к ручной оценке. Необязательно, но полезно для уточнения правил профиля."
                          value={feedbackComment}
                        />

                        <div className="flex flex-wrap gap-2">
                          <Button
                            className="h-8 px-3 text-xs"
                            disabled={!effectiveScoreVerdict || isFeedbackSaving || isFeedbackApplying}
                            onClick={() => void submitScoreFeedback(false)}
                            size="sm"
                            type="button"
                            variant="secondary"
                          >
                            {isFeedbackSaving ? "Сохраняю оценку" : "Сохранить оценку"}
                          </Button>
                          <Button
                            className="h-8 px-3 text-xs"
                            disabled={!effectiveScoreVerdict || isFeedbackSaving || isFeedbackApplying}
                            onClick={() => void submitScoreFeedback(true)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            {isFeedbackApplying ? "Обновляю профиль" : "Учесть в профиле"}
                          </Button>
                        </div>

                        {feedbackMessage ? (
                          <p className="text-xs text-muted-foreground">{feedbackMessage}</p>
                        ) : null}
                      </div>
                    </Card>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {tender.number ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-muted-foreground">
                        <span># {tender.number}</span>
                      </span>
                    ) : null}
                    <a
                      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      href={tenderSourceUrl ?? tender.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Источник</span>
                    </a>
                    {tender.sourcePlatformName ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-muted-foreground">
                        <span>{getSourcePlatformLabel(tender)}</span>
                      </span>
                    ) : null}
                    {documents.length > 0 ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-muted-foreground">
                        <Paperclip className="h-3.5 w-3.5" />
                        <span>Документов: {documents.length}</span>
                      </span>
                    ) : null}
                  </div>

                  {documents.length > 0 ? (
                    <Card className="border-dashed px-3 py-3">
                      <div className="overflow-x-auto pb-1">
                        <div className="flex min-w-full gap-2">
                          {documents.map((attachment) => {
                            const isSelected = selectedDocumentUrls.includes(attachment.url);
                            const visual = getAttachmentVisual(attachment.name);
                            const Icon = visual.icon;

                            return (
                              <div
                                className={[
                                  "w-[160px] shrink-0 rounded-md border px-2 py-2 transition-colors",
                                  isSelected ? "border-primary bg-primary/5" : "bg-background",
                                ].join(" ")}
                                key={`${attachment.url}-${attachment.name}`}
                              >
                                <div className="flex items-start gap-2">
                                  <button
                                    className="flex min-w-0 flex-1 items-start gap-2 text-left"
                                    onClick={() => toggleAttachmentSelection(attachment.url)}
                                    title={attachment.name}
                                    type="button"
                                  >
                                    <span
                                      className={[
                                        "inline-flex h-7 min-w-[3.7rem] items-center justify-center gap-1 rounded-md border px-2 text-[10px] font-semibold",
                                        visual.className,
                                      ].join(" ")}
                                    >
                                      <Icon className="h-3 w-3" />
                                      {visual.label}
                                    </span>
                                    <span className="line-clamp-2 text-xs font-medium leading-4">
                                      {attachment.name}
                                    </span>
                                  </button>
                                  <a
                                    className="mt-0.5 inline-flex shrink-0 items-center text-muted-foreground transition-colors hover:text-foreground"
                                    href={attachment.url}
                                    rel="noreferrer"
                                    target="_blank"
                                    title="Открыть документ"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </Card>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      className="h-9 gap-2 px-3 text-sm"
                      disabled={isLoading || isDocumentsLoading || isQuickAnalysisRunning}
                      onClick={handleQuickAnalysis}
                      size="sm"
                      type="button"
                    >
                      <FileText className="h-4 w-4" />
                      <span>{isQuickAnalysisRunning ? "Анализирую" : "Проанализировать"}</span>
                    </Button>
                    {selectedAttachments.length > 0 ? (
                      <>
                        <Button
                          className="h-9 px-3 text-sm"
                          onClick={handleInsertSelectedDocuments}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          Вставить в вопрос
                        </Button>
                        <Button
                          className="h-9 px-3 text-sm"
                          onClick={() => setSelectedDocumentUrls([])}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Снять выбор
                        </Button>
                      </>
                    ) : null}
                  </div>

                  {isDocumentsLoading ? (
                    <p className="text-center text-xs text-muted-foreground">
                      Загружаю вложения тендера из Saby...
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : (
            <div>
              <p className="text-[11px] text-muted-foreground">Тендер не выбран</p>
              <h2 className="mt-1 text-lg font-semibold leading-tight">Выберите тендер</h2>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">
                Выберите запрос слева, при необходимости обновите данные из Saby, затем
                откройте нужный тендер.
              </p>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!tender ? (
          <div className="flex h-full items-center justify-center">
            <Card className="max-w-md p-6 text-center">
              <h2 className="text-lg font-semibold">Выберите тендер</h2>
              <p className="mt-2 text-sm text-muted-foreground text-pretty">
                После выбора тендера здесь появятся диалог с LLM, история сообщений и контекст
                закупки.
              </p>
            </Card>
          </div>
        ) : (
          <div className="mx-auto flex max-w-6xl flex-col gap-3">
            {documentsErrorMessage ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {documentsErrorMessage}
              </p>
            ) : null}

            {messages.map((message) => {
              const isUserMessage = message.role === "user";

              return (
                <div
                  className={[
                    "max-w-[88%] rounded-lg px-3 py-2 text-sm shadow-sm",
                    isUserMessage
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "border bg-card text-card-foreground",
                  ].join(" ")}
                  key={message.id}
                >
                  <p className="text-xs font-medium">{isUserMessage ? "Вы" : "AI Tender Bot"}</p>
                  <p className="mt-1 whitespace-pre-wrap opacity-90">{message.content}</p>
                </div>
              );
            })}

            {isHistoryLoading ? (
              <Card className="max-w-[88%] px-3 py-2 text-sm text-muted-foreground">
                Загружаю историю диалога...
              </Card>
            ) : null}

            {historyErrorMessage ? (
              <Card className="max-w-[88%] border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {historyErrorMessage}
              </Card>
            ) : null}

            {isLoading ? (
              <Card className="max-w-[88%] px-3 py-2 text-sm text-muted-foreground">
                AI Tender Bot анализирует тендер...
              </Card>
            ) : null}

            {error ? (
              <Card className="max-w-[88%] border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error.message.trim().length > 0
                  ? error.message
                  : "Не удалось получить ответ LLM. Проверьте настройки DeepSeek API и попробуйте снова."}
              </Card>
            ) : null}
          </div>
        )}
      </div>

      <form className="border-t bg-card px-4 py-3" onSubmit={handleChatSubmit}>
        <div className="mx-auto flex max-w-6xl items-end gap-3">
          <Textarea
            className="min-h-[72px] resize-none text-sm"
            disabled={!tender}
            name="message"
            onChange={handleInputChange}
            placeholder={
              tender
                ? "Задайте вопрос по текущему тендеру или запустите быстрый анализ..."
                : "Сначала выберите тендер слева..."
            }
            required
            value={input}
          />
          <Button
            className="h-10 w-10 shrink-0"
            disabled={!tender || isLoading || input.trim().length === 0}
            size="icon"
            type="submit"
          >
            <SendHorizontal className="h-4 w-4" />
            <span className="sr-only">Отправить вопрос</span>
          </Button>
        </div>
      </form>
    </section>
  );
}
