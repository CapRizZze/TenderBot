import type { Tender, SabyDailyLimitStatistics } from "../../types/tender-parser.dto.ts";
import type { SabyStatisticsSpent } from "./tenderRefreshPolicy.ts";

interface BuildTendersResponsePayloadInput {
  tenders: Tender[];
  statistics?: SabyDailyLimitStatistics | null;
  statisticsBefore?: SabyDailyLimitStatistics | null;
  statisticsSpent?: SabyStatisticsSpent;
  cleanupDeletedCount?: number;
  warning?: string;
}

export function buildTendersResponsePayload(
  input: BuildTendersResponsePayloadInput,
) {
  return {
    tenders: input.tenders,
    ...(input.statistics ? { statistics: input.statistics } : {}),
    ...(input.statisticsBefore ? { statisticsBefore: input.statisticsBefore } : {}),
    ...(input.statisticsSpent ? { statisticsSpent: input.statisticsSpent } : {}),
    ...(input.cleanupDeletedCount && input.cleanupDeletedCount > 0
      ? {
          cleanup: {
            deletedLegacyCount: input.cleanupDeletedCount,
          },
        }
      : {}),
    ...(input.warning ? { warning: input.warning } : {}),
  };
}
