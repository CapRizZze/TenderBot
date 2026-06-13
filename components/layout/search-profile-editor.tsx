"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { SabyQueryDto } from "@/types/saby-query.dto";
import type { SearchProfileDto } from "@/types/search-profile.dto";
import { getErrorMessageFromResponse } from "@/utils/api-client";

interface SearchProfileEditorProps {
  profile?: SearchProfileDto;
  availableQueries: SabyQueryDto[];
}

type RuleBuckets = {
  positive: string;
  negative: string;
  hardExclude: string;
  instruction: string;
};

interface QueryGroup {
  title: string;
  queries: SabyQueryDto[];
}

function toRuleBuckets(profile?: SearchProfileDto): RuleBuckets {
  const byType = {
    positive: [] as string[],
    negative: [] as string[],
    hardExclude: [] as string[],
    instruction: [] as string[],
  };

  profile?.rules.forEach((rule) => {
    if (rule.type === "hard_exclude") {
      byType.hardExclude.push(rule.value);
      return;
    }

    byType[rule.type].push(rule.value);
  });

  return {
    positive: byType.positive.join("\n"),
    negative: byType.negative.join("\n"),
    hardExclude: byType.hardExclude.join("\n"),
    instruction: byType.instruction.join("\n"),
  };
}

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function groupQueriesByFolder(queries: SabyQueryDto[]): QueryGroup[] {
  const grouped = new Map<string, SabyQueryDto[]>();

  for (const query of queries) {
    const groupTitle =
      query.folderName?.trim() ||
      query.parentFolderName?.trim() ||
      "Без папки";
    const items = grouped.get(groupTitle) ?? [];
    items.push(query);
    grouped.set(groupTitle, items);
  }

  return [...grouped.entries()]
    .map(([title, items]) => ({
      title,
      queries: [...items].sort((left, right) => left.name.localeCompare(right.name, "ru")),
    }))
    .sort((left, right) => {
      if (left.title === "Без папки") {
        return 1;
      }

      if (right.title === "Без папки") {
        return -1;
      }

      return left.title.localeCompare(right.title, "ru");
    });
}

export function SearchProfileEditor({
  profile,
  availableQueries,
}: SearchProfileEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(profile?.name ?? "");
  const [description, setDescription] = useState(profile?.description ?? "");
  const [scoringPrompt, setScoringPrompt] = useState(profile?.scoringPrompt ?? "");
  const [selectedQueryIds, setSelectedQueryIds] = useState<string[]>(
    profile?.queries.map((query) => query.id) ?? [],
  );
  const [ruleBuckets, setRuleBuckets] = useState<RuleBuckets>(() =>
    toRuleBuckets(profile),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setName(profile?.name ?? "");
    setDescription(profile?.description ?? "");
    setScoringPrompt(profile?.scoringPrompt ?? "");
    setSelectedQueryIds(profile?.queries.map((query) => query.id) ?? []);
    setRuleBuckets(toRuleBuckets(profile));
    setMessage(null);
    setErrorMessage(null);
  }, [profile]);

  const hasProfile = Boolean(profile);
  const queryIdSet = useMemo(() => new Set(selectedQueryIds), [selectedQueryIds]);
  const queryGroups = useMemo(
    () => groupQueriesByFolder(availableQueries),
    [availableQueries],
  );

  function toggleQuery(queryId: string) {
    setSelectedQueryIds((current) =>
      current.includes(queryId)
        ? current.filter((value) => value !== queryId)
        : [...current, queryId],
    );
  }

  async function handleSave() {
    if (!profile) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/search-profiles/${profile.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
          scoringPrompt,
          queryIds: selectedQueryIds,
          rules: {
            positive: splitLines(ruleBuckets.positive),
            negative: splitLines(ruleBuckets.negative),
            hardExclude: splitLines(ruleBuckets.hardExclude),
            instruction: splitLines(ruleBuckets.instruction),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(
          await getErrorMessageFromResponse(
            response,
            "Не удалось сохранить профиль поиска.",
          ),
        );
      }

      setMessage("Профиль поиска сохранён.");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Не удалось сохранить профиль.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {!hasProfile ? (
        <p className="text-xs text-muted-foreground">
          Активный профиль поиска не выбран.
        </p>
      ) : null}

      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground">
          Название профиля
        </label>
        <input
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          disabled={!hasProfile || isSaving}
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label className="text-[11px] font-medium text-muted-foreground">
            Запросы Saby
          </label>
          <span className="text-[11px] text-muted-foreground">
            Выбрано: {selectedQueryIds.length}
          </span>
        </div>

        <div className="max-h-64 space-y-3 overflow-y-auto rounded-md border bg-background p-3">
          {availableQueries.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Сначала выполните синхронизацию структуры Saby, затем здесь
              появятся папки и запросы.
            </p>
          ) : null}

          {queryGroups.map((group) => (
            <div
              className="rounded-md border bg-muted/20 p-2.5"
              key={group.title}
            >
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.title}
              </div>
              <div className="flex flex-wrap gap-2">
                {group.queries.map((query) => {
                  const isActive = queryIdSet.has(query.id);

                  return (
                    <button
                      className={[
                        "rounded-md border px-2.5 py-1 text-xs transition-colors",
                        isActive
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      ].join(" ")}
                      disabled={!hasProfile || isSaving}
                      key={query.id}
                      onClick={() => toggleQuery(query.id)}
                      title={`${group.title} / ${query.name}`}
                      type="button"
                    >
                      {query.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground">
          Описание профиля
        </label>
        <textarea
          className="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm"
          disabled={!hasProfile || isSaving}
          onChange={(event) => setDescription(event.target.value)}
          value={description}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-muted-foreground">
          Scoring prompt
        </label>
        <textarea
          className="min-h-[140px] w-full rounded-md border bg-background px-3 py-2 text-sm"
          disabled={!hasProfile || isSaving}
          onChange={(event) => setScoringPrompt(event.target.value)}
          value={scoringPrompt}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground">
            Положительные сигналы
          </label>
          <textarea
            className="min-h-[88px] w-full rounded-md border bg-background px-3 py-2 text-sm"
            disabled={!hasProfile || isSaving}
            onChange={(event) =>
              setRuleBuckets((current) => ({
                ...current,
                positive: event.target.value,
              }))
            }
            placeholder="Одна фраза на строку"
            value={ruleBuckets.positive}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground">
            Отрицательные сигналы
          </label>
          <textarea
            className="min-h-[88px] w-full rounded-md border bg-background px-3 py-2 text-sm"
            disabled={!hasProfile || isSaving}
            onChange={(event) =>
              setRuleBuckets((current) => ({
                ...current,
                negative: event.target.value,
              }))
            }
            placeholder="Одна фраза на строку"
            value={ruleBuckets.negative}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground">
            Жёсткие исключения
          </label>
          <textarea
            className="min-h-[88px] w-full rounded-md border bg-background px-3 py-2 text-sm"
            disabled={!hasProfile || isSaving}
            onChange={(event) =>
              setRuleBuckets((current) => ({
                ...current,
                hardExclude: event.target.value,
              }))
            }
            placeholder="Одна фраза на строку"
            value={ruleBuckets.hardExclude}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-muted-foreground">
            Дополнительные инструкции
          </label>
          <textarea
            className="min-h-[88px] w-full rounded-md border bg-background px-3 py-2 text-sm"
            disabled={!hasProfile || isSaving}
            onChange={(event) =>
              setRuleBuckets((current) => ({
                ...current,
                instruction: event.target.value,
              }))
            }
            placeholder="Одна фраза на строку"
            value={ruleBuckets.instruction}
          />
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {errorMessage}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {message}
        </div>
      ) : null}

      <button
        className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60"
        disabled={!hasProfile || isSaving}
        onClick={handleSave}
        type="button"
      >
        {isSaving ? "Сохраняю..." : "Сохранить профиль"}
      </button>
    </div>
  );
}
