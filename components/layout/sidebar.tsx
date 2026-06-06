"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Paperclip,
  Settings,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { ConversationList } from "@/components/layout/conversation-list";
import { KeywordEditor } from "@/components/layout/keyword-editor";
import { RefreshTendersButton } from "@/components/layout/refresh-tenders-button";
import { SearchProfileEditor } from "@/components/layout/search-profile-editor";
import { SignOutButton } from "@/components/layout/sign-out-button";
import type { KeywordDto } from "@/types/keyword.dto";
import type { SabyApiCallLogEntry } from "@/types/saby-api-log.dto";
import type { SearchProfileDto } from "@/types/search-profile.dto";
import type {
  SabyDailyLimitStatistics,
  Tender,
} from "@/types/tender-parser.dto";

interface SidebarProps {
  tenders: Tender[];
  activeRequestName: string;
  activeSearchProfile?: SearchProfileDto;
  requestNames: string[];
  availableRequestNames: string[];
  searchProfiles: SearchProfileDto[];
  initialKeywords: KeywordDto[];
  recentSabyApiCalls: SabyApiCallLogEntry[];
  sabyDailyLimitStatistics?: SabyDailyLimitStatistics | null;
  tendersLoadError?: string | null;
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

const logTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const SIDEBAR_COLLAPSED_STORAGE_KEY = "tenderbot:sidebar-collapsed";

function shouldDisplayLogEntry(entry: SabyApiCallLogEntry) {
  return entry.operation === "refresh_tenders";
}

function formatLogStatus(status: string) {
  switch (status) {
    case "success":
      return "Успешно";
    case "empty":
      return "Без новых тендеров";
    case "blocked":
      return "Заблокировано";
    case "daily_limit":
      return "Достигнут лимит";
    case "error":
      return "Ошибка";
    default:
      return status;
  }
}

function formatScoreVerdict(verdict: string) {
  switch (verdict) {
    case "relevant":
      return "Релевантен";
    case "maybe":
      return "Под вопросом";
    case "irrelevant":
      return "Скрыт";
    default:
      return verdict;
  }
}

function formatVerdictFilterLabel(
  verdict: "all" | "relevant" | "maybe" | "irrelevant",
) {
  switch (verdict) {
    case "relevant":
      return "Релевантные";
    case "maybe":
      return "Под вопросом";
    case "irrelevant":
      return "Скрытые";
    default:
      return "Все";
  }
}

function getVerdictIndicatorClass(verdict?: string | null) {
  switch (verdict) {
    case "relevant":
      return "bg-emerald-500";
    case "maybe":
      return "bg-amber-400";
    case "irrelevant":
      return "bg-rose-500";
    default:
      return "bg-slate-300";
  }
}

function getVerdictFilterButtonClass(
  verdict: "all" | "relevant" | "maybe" | "irrelevant",
  isActive: boolean,
) {
  switch (verdict) {
    case "relevant":
      return isActive
        ? "border-emerald-600 bg-emerald-600 text-white"
        : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100";
    case "maybe":
      return isActive
        ? "border-amber-500 bg-amber-500 text-white"
        : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100";
    case "irrelevant":
      return isActive
        ? "border-rose-600 bg-rose-600 text-white"
        : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100";
    default:
      return isActive
        ? "border-slate-500 bg-slate-700 text-white"
        : "bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground";
  }
}

function formatVerdictFilterDisplayLabel(
  verdict: "all" | "relevant" | "maybe" | "irrelevant",
) {
  switch (verdict) {
    case "relevant":
      return "Подходят";
    case "maybe":
      return "Спорные";
    case "irrelevant":
      return "Не подходят";
    default:
      return "Все";
  }
}

export function Sidebar({
  tenders,
  activeRequestName,
  activeSearchProfile,
  requestNames,
  availableRequestNames,
  searchProfiles,
  initialKeywords,
  recentSabyApiCalls,
  sabyDailyLimitStatistics,
  tendersLoadError,
  activeTenderId,
}: SidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [verdictFilter, setVerdictFilter] = useState<
    "all" | "relevant" | "maybe" | "irrelevant"
  >("relevant");
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  const [settingsMenuPosition, setSettingsMenuPosition] = useState({
    top: 0,
    left: 0,
  });

  const visibleSabyApiCalls = recentSabyApiCalls
    .filter(shouldDisplayLogEntry)
    .slice(0, 12);

  const visibleTenders = useMemo(() => {
    const filtered = tenders.filter((tender) => {
      if (verdictFilter === "all") {
        return true;
      }

      return (
        (tender.profileScore?.userVerdict ?? tender.profileScore?.verdict) ===
        verdictFilter
      );
    });

    return [...filtered].sort((left, right) => {
      const rightScore = right.profileScore?.score ?? -1;
      const leftScore = left.profileScore?.score ?? -1;

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return left.title.localeCompare(right.title, "ru");
    });
  }, [tenders, verdictFilter]);

  useEffect(() => {
    const storedValue = window.localStorage.getItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
    );
    setIsCollapsed(storedValue === "1");
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_STORAGE_KEY,
      isCollapsed ? "1" : "0",
    );
  }, [isCollapsed]);

  useEffect(() => {
    if (!isSettingsOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!settingsRef.current?.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsSettingsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSettingsOpen]);

  useEffect(() => {
    if (!isSettingsOpen) {
      return;
    }

    function updateMenuPosition() {
      const buttonRect = settingsButtonRef.current?.getBoundingClientRect();
      const menuHeight = settingsMenuRef.current?.offsetHeight ?? 420;

      if (!buttonRect) {
        return;
      }

      const viewportPadding = 16;
      const menuWidth = 296;
      const maxLeft = Math.max(
        viewportPadding,
        window.innerWidth - menuWidth - viewportPadding,
      );
      const left = Math.min(
        Math.max(buttonRect.left, viewportPadding),
        maxLeft,
      );
      const maxTop = Math.max(
        viewportPadding,
        window.innerHeight - menuHeight - viewportPadding,
      );
      const top = Math.min(buttonRect.bottom + 8, maxTop);

      setSettingsMenuPosition({ top, left });
    }

    updateMenuPosition();
    const frameId = window.requestAnimationFrame(updateMenuPosition);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isSettingsOpen]);

  function openTender(tenderId: string) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tenderId", tenderId);
    nextParams.set("requestName", activeRequestName);

    if (activeSearchProfile) {
      nextParams.set("profileId", activeSearchProfile.id);
    }

    startTransition(() => {
      router.push(`/?${nextParams.toString()}`, { scroll: false });
    });
  }

  function changeRequestName(requestName: string) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("requestName", requestName);
    nextParams.delete("tenderId");

    if (activeSearchProfile) {
      nextParams.set("profileId", activeSearchProfile.id);
    }

    startTransition(() => {
      router.push(`/?${nextParams.toString()}`, { scroll: false });
    });
  }

  function changeSearchProfile(profileId: string) {
    const nextProfile = searchProfiles.find((profile) => profile.id === profileId);
    const nextParams = new URLSearchParams(searchParams.toString());

    nextParams.set("profileId", profileId);
    nextParams.delete("tenderId");

    if (nextProfile?.requestNames[0]) {
      nextParams.set("requestName", nextProfile.requestNames[0]);
    }

    startTransition(() => {
      router.push(`/?${nextParams.toString()}`, { scroll: false });
    });
  }

  function toggleSidebarCollapse() {
    setIsCollapsed((current) => {
      const next = !current;

      if (next) {
        setIsSettingsOpen(false);
      }

      return next;
    });
  }

  if (isCollapsed) {
    return (
      <aside className="flex h-full min-h-0 w-14 shrink-0 flex-col items-center border-r bg-background py-3">
        <button
          aria-label="Развернуть боковую панель"
          className="flex size-9 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={toggleSidebarCollapse}
          type="button"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden border-r bg-background md:w-[21rem]">
      <div className="border-b px-4 py-2.5">
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
              AI Tender Bot
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                aria-label="Свернуть боковую панель"
                className="flex size-9 items-center justify-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                onClick={toggleSidebarCollapse}
                type="button"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="relative shrink-0" ref={settingsRef}>
                <button
                  aria-expanded={isSettingsOpen}
                  aria-label="Открыть настройки Saby и RequestName"
                  className="flex h-9 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setIsSettingsOpen((value) => !value)}
                  ref={settingsButtonRef}
                  type="button"
                >
                  <Settings
                    className={[
                      "h-4 w-4 transition-transform duration-200",
                      isSettingsOpen ? "rotate-45" : "",
                    ].join(" ")}
                  />
                </button>

                {isSettingsOpen ? (
                  <div
                    className="fixed z-50 flex max-h-[calc(100dvh-2rem)] w-[56rem] max-w-[calc(100vw-2rem)] flex-col gap-3 overflow-y-auto rounded-lg border bg-background p-4 shadow-lg"
                    ref={settingsMenuRef}
                    style={{
                      top: `${settingsMenuPosition.top}px`,
                      left: `${settingsMenuPosition.left}px`,
                    }}
                  >
                    {sabyDailyLimitStatistics ? (
                      <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                        <div className="text-xs text-muted-foreground">Лимит Saby API</div>
                        <div className="mt-1 flex items-center justify-between gap-3">
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            Использовано сегодня: {sabyDailyLimitStatistics.dayCounter}
                          </span>
                          <span className="font-semibold tabular-nums">
                            {sabyDailyLimitStatistics.dayRemaining}/
                            {sabyDailyLimitStatistics.dayLimit}
                          </span>
                        </div>
                      </div>
                    ) : null}

                    <details className="hidden group">
                      <summary className="flex h-10 w-full cursor-pointer list-none items-center justify-between gap-2 rounded-md border bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
                        <span>Saby log</span>
                        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="mt-2 max-h-[40dvh] space-y-2 overflow-y-auto pr-1">
                        {visibleSabyApiCalls.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Запросов пока нет.</p>
                        ) : null}

                        {visibleSabyApiCalls.map((entry) => (
                          <div
                            className="rounded-md border bg-card px-3 py-2 text-xs"
                            key={entry.id}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-foreground">
                                {entry.requestName ?? "refresh"}
                              </span>
                              <span className="text-muted-foreground tabular-nums">
                                {entry.usedRequests ?? 0} req / {entry.durationMs} ms
                              </span>
                            </div>
                            <div className="mt-1 text-muted-foreground">{entry.method}</div>
                            <div className="mt-1 text-muted-foreground tabular-nums">
                              {entry.dayRemainingBefore ?? "?"} →{" "}
                              {entry.dayRemainingAfter ?? "?"} ·{" "}
                              {formatLogStatus(entry.status)}
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                              {logTimeFormatter.format(new Date(entry.createdAt))}
                            </div>
                            {entry.error ? (
                              <div className="mt-2 rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
                                {entry.error}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </details>

                    <details className="hidden group">
                      <summary className="flex h-10 w-full cursor-pointer list-none items-center justify-between gap-2 rounded-md border bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
                        <span>Настроить RequestName</span>
                        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="mt-2 rounded-lg border bg-card p-3">
                        <KeywordEditor
                          availableRequestNames={availableRequestNames}
                          initialKeywords={initialKeywords}
                        />
                      </div>
                    </details>
                    <details className="group">
                      <summary className="flex h-10 w-full cursor-pointer list-none items-center justify-between gap-2 rounded-md border bg-background px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground">
                        <span>SearchProfile</span>
                        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="mt-2 rounded-lg border bg-card p-3">
                        <SearchProfileEditor
                          availableRequestNames={availableRequestNames}
                          profile={activeSearchProfile}
                        />
                      </div>
                    </details>
                  </div>
                ) : null}
              </div>

              <div className="w-[118px]">
                <RefreshTendersButton
                  compact
                  label="Обновить"
                  requestName={activeRequestName}
                />
              </div>
              <SignOutButton />
            </div>
          </div>

          <div className="scrollbar-hidden overflow-x-auto pb-0.5">
            {searchProfiles.length > 0 ? (
              <div className="mb-2">
                <label className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">
                  Профиль поиска
                </label>
                <select
                  className="h-8 w-full rounded-md border bg-background px-2 text-xs font-medium"
                  disabled={isPending}
                  onChange={(event) => changeSearchProfile(event.target.value)}
                  value={activeSearchProfile?.id ?? searchProfiles[0]?.id}
                >
                  {searchProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
                {activeSearchProfile?.description ? (
                  <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                    {activeSearchProfile.description}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="flex min-w-max gap-2">
              {requestNames.map((requestName) => {
                const isActive = requestName === activeRequestName;

                return (
                  <button
                    className={[
                      "shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card hover:bg-accent hover:text-accent-foreground",
                    ].join(" ")}
                    disabled={isPending}
                    key={requestName}
                    onClick={() => changeRequestName(requestName)}
                    type="button"
                  >
                    {requestName}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {(["relevant", "maybe", "irrelevant", "all"] as const).map(
                (filterValue) => {
                  const isActive = verdictFilter === filterValue;

                  return (
                    <button
                      className={[
                        "rounded-md border px-2 py-0.5 text-[10px] font-medium leading-5 transition-colors",
                        getVerdictFilterButtonClass(filterValue, isActive),
                      ].join(" ")}
                      key={filterValue}
                      onClick={() => setVerdictFilter(filterValue)}
                      type="button"
                    >
                      {formatVerdictFilterDisplayLabel(filterValue)}
                    </button>
                  );
                },
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
        <details className="group w-full shrink-0" open>
          <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2">
            <span className="text-sm font-medium">Чаты по тендерам</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="max-h-[26dvh] overflow-y-auto pb-1 pr-1 pt-3 md:max-h-[30dvh]">
            <ConversationList />
          </div>
        </details>

        <details className="group mt-4 shrink-0" open>
          <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2">
            <span className="text-sm font-medium">Список тендеров</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="pt-3 pr-1">
            {tendersLoadError ? (
              <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {tendersLoadError}
              </div>
            ) : null}

            {tenders.length === 0 ? (
              <div className="rounded-lg border border-dashed px-3 py-5 text-sm text-muted-foreground">
                Тендеры по выбранному RequestName пока не найдены.
              </div>
            ) : (
              <div className="space-y-3 pb-3">
                <div className="hidden flex-wrap gap-2">
                  {(["all", "relevant", "maybe", "irrelevant"] as const).map(
                    (filterValue) => {
                      const isActive = verdictFilter === filterValue;

                      return (
                        <button
                          className={[
                            "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                            getVerdictFilterButtonClass(filterValue, isActive),
                          ].join(" ")}
                          key={filterValue}
                          onClick={() => setVerdictFilter(filterValue)}
                          type="button"
                        >
                          {formatVerdictFilterDisplayLabel(filterValue)}
                        </button>
                      );
                    },
                  )}
                </div>

                {visibleTenders.length === 0 ? (
                  <div className="rounded-lg border border-dashed px-3 py-5 text-sm text-muted-foreground">
                    По активному профилю нет тендеров в этой категории.
                  </div>
                ) : (
                  <nav aria-label="Список тендеров" className="w-full space-y-2">
                    {visibleTenders.map((tender) => {
                      const isActive = tender.id === activeTenderId;
                      const deadline = dateFormatter.format(
                        new Date(tender.deadline),
                      );
                      const effectiveVerdict =
                        tender.profileScore?.userVerdict ??
                        tender.profileScore?.verdict;

                      return (
                        <button
                          className={[
                            "block w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                            isActive
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-card hover:bg-accent hover:text-accent-foreground",
                          ].join(" ")}
                          disabled={isPending}
                          key={tender.id}
                          onMouseDown={(event) => {
                            // Prevent mouse focus from nudging the scroll container
                            // when the active tender changes. Keyboard focus still works.
                            event.preventDefault();
                          }}
                          onClick={() => openTender(tender.id)}
                          type="button"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h2 className="line-clamp-2 text-sm font-semibold">
                              {tender.title}
                            </h2>
                            <div className="flex shrink-0 items-center gap-2">
                              <span
                                aria-label={
                                  effectiveVerdict
                                    ? formatScoreVerdict(effectiveVerdict)
                                    : "Без скоринга"
                                }
                                className={[
                                  "inline-block h-2.5 w-2.5 rounded-full",
                                  getVerdictIndicatorClass(effectiveVerdict),
                                ].join(" ")}
                                title={
                                  effectiveVerdict
                                    ? formatScoreVerdict(effectiveVerdict)
                                    : "Без скоринга"
                                }
                              />
                              <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                                {deadline}
                              </span>
                            </div>
                          </div>
                          <p className="mt-1.5 line-clamp-2 text-xs opacity-80">
                            {tender.customer}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold tabular-nums">
                            {tender.number ? (
                              <span className="inline-flex items-center rounded-md bg-background/70 px-2 py-0.5 text-muted-foreground">
                                # {tender.number}
                              </span>
                            ) : null}
                            {typeof tender.budget === "number" ? (
                              <p>{currencyFormatter.format(tender.budget)}</p>
                            ) : null}
                            {tender.attachments.length > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-background/70 px-2 py-0.5 text-muted-foreground">
                                <Paperclip className="h-3 w-3" />
                                <span>{tender.attachments.length}</span>
                              </span>
                            ) : null}
                            {tender.profileScore ? (
                              <span className="inline-flex items-center rounded-md bg-background/70 px-2 py-0.5 text-muted-foreground">
                                {tender.profileScore.score}/100 ·{" "}
                                {formatScoreVerdict(
                                  tender.profileScore.userVerdict ??
                                    tender.profileScore.verdict,
                                )}
                              </span>
                            ) : null}
                          </div>
                          {tender.profileScore?.reasons[0] ? (
                            <p className="mt-1.5 line-clamp-1 text-[11px] opacity-75">
                              {tender.profileScore.reasons[0]}
                            </p>
                          ) : null}
                        </button>
                      );
                    })}
                  </nav>
                )}
              </div>
            )}
          </div>
        </details>
      </div>
    </aside>
  );
}
