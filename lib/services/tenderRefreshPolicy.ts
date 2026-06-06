import type { SabyDailyLimitStatistics } from "../../types/tender-parser.dto.ts";

export interface SabyStatisticsSpent {
  usedRequests: number;
  remainingDelta: number;
}

export function buildRefreshKey(userId: string, requestName: string) {
  return `${userId}:${requestName}`;
}

export function getRefreshBlockMessage(input: {
  isInFlight: boolean;
  hasRecentRefresh: boolean;
}) {
  if (input.isInFlight) {
    return "Обновление по этому RequestName уже выполняется. Дождитесь завершения текущего запроса.";
  }

  if (input.hasRecentRefresh) {
    return "Повторное обновление по этому RequestName временно заблокировано на 5 минут, чтобы не расходовать лимит Saby API.";
  }

  return null;
}

export function getDailyLimitBlockedMessage() {
  return "Сегодня уже достигнут суточный лимит Saby API по этому RequestName. Повторный запрос заблокирован, чтобы не расходовать лимит.";
}

export function getSabyStatisticsSpent(
  before: SabyDailyLimitStatistics | null | undefined,
  after: SabyDailyLimitStatistics | null | undefined,
): SabyStatisticsSpent | undefined {
  if (!before || !after) {
    return undefined;
  }

  return {
    usedRequests: Math.max(after.dayCounter - before.dayCounter, 0),
    remainingDelta: Math.max(before.dayRemaining - after.dayRemaining, 0),
  };
}
