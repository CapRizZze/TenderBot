"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { SabyDailyLimitStatistics } from "@/types/tender-parser.dto";
import { getErrorMessageFromResponse } from "@/utils/api-client";

interface RefreshTendersButtonProps {
  requestName: string;
  queryId?: number;
  compact?: boolean;
  label?: string;
}

interface RefreshTendersResponse {
  tenders?: unknown[];
  warning?: string;
  statistics?: SabyDailyLimitStatistics;
  statisticsSpent?: {
    usedRequests: number;
    remainingDelta: number;
  };
  cleanup?: {
    deletedLegacyCount: number;
  };
}

const REFRESH_COOLDOWN_MS = 5 * 60 * 1000;
const MESSAGE_AUTOHIDE_MS = 6000;

export function RefreshTendersButton({
  requestName,
  queryId,
  compact = false,
  label = "Обновить из Saby",
}: RefreshTendersButtonProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownNow, setCooldownNow] = useState(() => Date.now());
  const storageKey = useMemo(
    () => `saby-refresh-cooldown:${queryId ?? requestName}`,
    [queryId, requestName],
  );

  useEffect(() => {
    const storedValue = window.localStorage.getItem(storageKey);
    const parsed = storedValue ? Number(storedValue) : Number.NaN;

    if (Number.isFinite(parsed) && parsed > Date.now()) {
      setCooldownUntil(parsed);
    } else {
      window.localStorage.removeItem(storageKey);
      setCooldownUntil(null);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!cooldownUntil) {
      return;
    }

    const timer = window.setInterval(() => {
      const now = Date.now();
      setCooldownNow(now);

      if (cooldownUntil <= now) {
        setCooldownUntil(null);
        window.localStorage.removeItem(storageKey);
        window.clearInterval(timer);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldownUntil, storageKey]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timer = window.setTimeout(() => {
      setMessage(null);
      setIsError(false);
    }, MESSAGE_AUTOHIDE_MS);

    return () => window.clearTimeout(timer);
  }, [message]);

  const cooldownRemainingMs =
    cooldownUntil && cooldownUntil > cooldownNow ? cooldownUntil - cooldownNow : 0;
  const isCooldownActive = cooldownRemainingMs > 0;

  async function refreshTenders() {
    if (isRefreshing || isCooldownActive) {
      return;
    }

    const nextCooldownUntil = Date.now() + REFRESH_COOLDOWN_MS;
    setCooldownUntil(nextCooldownUntil);
    setCooldownNow(Date.now());
    window.localStorage.setItem(storageKey, String(nextCooldownUntil));
    setIsRefreshing(true);
    setMessage(null);
    setIsError(false);

    try {
      const response = await fetch("/api/tenders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          queryId
            ? {
                keywords: [requestName],
                queryId,
              }
            : {
                keywords: [requestName],
              },
        ),
      });

      if (!response.ok) {
        throw new Error(
          await getErrorMessageFromResponse(response, "Не удалось обновить тендеры из Saby"),
        );
      }

      const data = (await response.json()) as RefreshTendersResponse;
      const count = Array.isArray(data.tenders) ? data.tenders.length : 0;
      const spentSuffix = data.statisticsSpent
        ? ` Потрачено запросов: ${data.statisticsSpent.usedRequests}.`
        : "";
      const statsSuffix = data.statistics
        ? ` Остаток: ${data.statistics.dayRemaining}/${data.statistics.dayLimit}.`
        : "";

      setMessage(
        count === 0
          ? data.warning ??
              `Новых тендеров не пришло. В кэше остались сохранённые записи.${spentSuffix}${statsSuffix}`
          : `Получено тендеров: ${count}.${spentSuffix}${statsSuffix}`,
      );

      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "Не удалось обновить тендеры из Saby",
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  const messageElement = message ? (
    <p
      className={[
        "rounded-md border px-3 py-2 text-xs shadow-sm",
        isError
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-border bg-background text-muted-foreground",
      ].join(" ")}
    >
      {message}
    </p>
  ) : null;

  return (
    <div className={compact ? "relative" : "mt-4 space-y-2"}>
      <Button
        className={[
          compact ? "h-9 w-full justify-center gap-2 px-3 text-sm" : "w-full gap-2",
          isCooldownActive
            ? "border-muted bg-muted text-muted-foreground hover:bg-muted hover:text-muted-foreground"
            : "",
        ].join(" ")}
        disabled={isRefreshing || isCooldownActive}
        onClick={refreshTenders}
        size="sm"
        type="button"
        variant="outline"
      >
        <RefreshCw className={["h-4 w-4", isRefreshing ? "animate-spin" : ""].join(" ")} />
        <span>
          {isRefreshing
            ? "Обновляю"
            : isCooldownActive
              ? `Повтор через ${formatCooldown(cooldownRemainingMs)}`
              : label}
        </span>
      </Button>

      {!compact ? (
        <>
          <p className="text-xs text-muted-foreground">
            Запрос расходует суточный лимит Saby. Навигация по интерфейсу использует
            локальный кэш.
          </p>
          {isCooldownActive ? (
            <p className="text-xs text-muted-foreground">
              Кнопка временно заблокирована на 5 минут после запуска запроса.
            </p>
          ) : null}
          {messageElement}
        </>
      ) : null}

      {compact && messageElement ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-2">{messageElement}</div>
      ) : null}
    </div>
  );
}

function formatCooldown(valueMs: number): string {
  const totalSeconds = Math.max(Math.ceil(valueMs / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
