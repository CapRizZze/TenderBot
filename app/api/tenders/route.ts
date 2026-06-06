import { NextResponse } from "next/server";

import { getParserEnv } from "@/lib/env";
import { deleteLegacyCachedTendersByKeyword } from "@/lib/repositories/tenderRepository";
import {
  createSabyApiCallLog,
  findLatestSabyApiCall,
  getSabyUsedRequests,
} from "@/lib/services/sabyApiCallLogService";
import {
  buildRefreshKey,
  getDailyLimitBlockedMessage,
  getRefreshBlockMessage,
  getSabyStatisticsSpent,
} from "@/lib/services/tenderRefreshPolicy";
import { buildTendersResponsePayload } from "@/lib/services/tendersRoutePresentation";
import { logSabyRequest } from "@/lib/services/sabyRequestLogService";
import { scoreTendersForRequestName } from "@/lib/services/tenderScoringService";
import { tenderSyncService } from "@/lib/services/tenderSyncService";
import {
  fetchTenderParserDailyLimitStatistics,
  SabyDailyLimitError,
  tenderParserService,
} from "@/lib/tender-parser/tenderParserService";
import { tendersRequestSchema } from "@/types/tender-parser.dto";
import { createUnauthorizedResponse, getCurrentUser } from "@/utils/auth";
import { getApiErrorStatus, toApiErrorResponse } from "@/utils/errors";

const REFRESH_COOLDOWN_MS = 5 * 60 * 1000;
const inFlightRefreshes = new Map<string, number>();

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return createUnauthorizedResponse();
    }

    const body: unknown = await request.json();
    const { keywords } = tendersRequestSchema.parse(body);
    const requestName = keywords[0];
    const parserEnv = getParserEnv();
    const startedAt = Date.now();
    const refreshKey = buildRefreshKey(currentUser.id, requestName);

    if (inFlightRefreshes.has(refreshKey)) {
      return NextResponse.json(
        {
          error: {
            message: getRefreshBlockMessage({
              isInFlight: true,
              hasRecentRefresh: false,
            }),
          },
        },
        { status: 429 },
      );
    }

    const recentRefresh = await findLatestSabyApiCall({
      userId: currentUser.id,
      operation: "refresh_tenders",
      requestName,
      since: new Date(Date.now() - REFRESH_COOLDOWN_MS),
    });

    if (recentRefresh) {
      return NextResponse.json(
        {
          error: {
            message: getRefreshBlockMessage({
              isInFlight: false,
              hasRecentRefresh: true,
            }),
          },
        },
        { status: 429 },
      );
    }

    inFlightRefreshes.set(refreshKey, startedAt);

    try {
      const sabyDailyLimitStatisticsBefore =
        parserEnv.TENDER_PARSER_MODE === "saby"
          ? await fetchTenderParserDailyLimitStatistics()
          : null;

      if (
        parserEnv.TENDER_PARSER_MODE === "saby" &&
        sabyDailyLimitStatisticsBefore &&
        sabyDailyLimitStatisticsBefore.dayRemaining <= 0
      ) {
        await logSabyRequest({
          userId: currentUser.id,
          requestName,
          method: parserEnv.SABY_TENDER_METHODS ?? "SbisTenderAPI.GetTenderList",
          status: "blocked",
          error: "Saby API request blocked because daily limit is already exhausted.",
        });
        await createSabyApiCallLog({
          userId: currentUser.id,
          operation: "refresh_tenders",
          method: parserEnv.SABY_TENDER_METHODS ?? "SbisTenderAPI.GetTenderList",
          endpoint: parserEnv.SABY_TENDER_API_URL ?? "unknown",
          requestName,
          status: "blocked",
          durationMs: Date.now() - startedAt,
          dayCounterBefore: sabyDailyLimitStatisticsBefore.dayCounter,
          dayCounterAfter: sabyDailyLimitStatisticsBefore.dayCounter,
          dayRemainingBefore: sabyDailyLimitStatisticsBefore.dayRemaining,
          dayRemainingAfter: sabyDailyLimitStatisticsBefore.dayRemaining,
          payloadSummary: {
            keywords,
            pageSize: parserEnv.SABY_PAGE_SIZE ?? 10,
          },
          error: "Daily limit exhausted before refresh started.",
        });

        return NextResponse.json(
          {
            error: {
              message: getDailyLimitBlockedMessage(),
            },
          },
          { status: 429 },
        );
      }

      let parsedTenders;
      let sabyDailyLimitStatisticsAfter = sabyDailyLimitStatisticsBefore;
      let sabyStatisticsSpent: ReturnType<typeof getSabyStatisticsSpent>;

      try {
        parsedTenders = await tenderParserService.fetchTendersByKeywords(keywords);

        if (parserEnv.TENDER_PARSER_MODE === "saby") {
          sabyDailyLimitStatisticsAfter =
            await fetchTenderParserDailyLimitStatistics();
          sabyStatisticsSpent = getSabyStatisticsSpent(
            sabyDailyLimitStatisticsBefore,
            sabyDailyLimitStatisticsAfter,
          );

          await logSabyRequest({
            userId: currentUser.id,
            requestName,
            method: parserEnv.SABY_TENDER_METHODS ?? "SbisTenderAPI.GetTenderList",
            status: parsedTenders.length > 0 ? "success" : "empty",
            tenderCount: parsedTenders.length,
          });
          await createSabyApiCallLog({
            userId: currentUser.id,
            operation: "refresh_tenders",
            method: parserEnv.SABY_TENDER_METHODS ?? "SbisTenderAPI.GetTenderList",
            endpoint: parserEnv.SABY_TENDER_API_URL ?? "unknown",
            requestName,
            status: parsedTenders.length > 0 ? "success" : "empty",
            durationMs: Date.now() - startedAt,
            usedRequests: getSabyUsedRequests(
              sabyDailyLimitStatisticsBefore,
              sabyDailyLimitStatisticsAfter,
            ),
            dayCounterBefore: sabyDailyLimitStatisticsBefore?.dayCounter,
            dayCounterAfter: sabyDailyLimitStatisticsAfter?.dayCounter,
            dayRemainingBefore: sabyDailyLimitStatisticsBefore?.dayRemaining,
            dayRemainingAfter: sabyDailyLimitStatisticsAfter?.dayRemaining,
            payloadSummary: {
              keywords,
              pageSize: parserEnv.SABY_PAGE_SIZE ?? 10,
            },
            responseSummary: {
              tenderCount: parsedTenders.length,
            },
          });
        }
      } catch (error) {
        if (parserEnv.TENDER_PARSER_MODE === "saby") {
          try {
            sabyDailyLimitStatisticsAfter =
              await fetchTenderParserDailyLimitStatistics();
          } catch {
            sabyDailyLimitStatisticsAfter = sabyDailyLimitStatisticsBefore;
          }

          await logSabyRequest({
            userId: currentUser.id,
            requestName,
            method: parserEnv.SABY_TENDER_METHODS ?? "SbisTenderAPI.GetTenderList",
            status: error instanceof SabyDailyLimitError ? "daily_limit" : "error",
            error:
              error instanceof Error ? error.message : "Unknown Saby API error",
          });
          await createSabyApiCallLog({
            userId: currentUser.id,
            operation: "refresh_tenders",
            method: parserEnv.SABY_TENDER_METHODS ?? "SbisTenderAPI.GetTenderList",
            endpoint: parserEnv.SABY_TENDER_API_URL ?? "unknown",
            requestName,
            status: error instanceof SabyDailyLimitError ? "daily_limit" : "error",
            durationMs: Date.now() - startedAt,
            usedRequests: getSabyUsedRequests(
              sabyDailyLimitStatisticsBefore,
              sabyDailyLimitStatisticsAfter,
            ),
            dayCounterBefore: sabyDailyLimitStatisticsBefore?.dayCounter,
            dayCounterAfter: sabyDailyLimitStatisticsAfter?.dayCounter,
            dayRemainingBefore: sabyDailyLimitStatisticsBefore?.dayRemaining,
            dayRemainingAfter: sabyDailyLimitStatisticsAfter?.dayRemaining,
            payloadSummary: {
              keywords,
              pageSize: parserEnv.SABY_PAGE_SIZE ?? 10,
            },
            error:
              error instanceof Error ? error.message : "Unknown Saby refresh error",
          });
        }

        throw error;
      }

      let syncWarning: string | undefined;
      let cleanupDeletedCount = 0;

      try {
        await tenderSyncService.syncParsedTenders(
          currentUser.id,
          requestName,
          parsedTenders,
        );

        if (parsedTenders.length > 0) {
          void scoreTendersForRequestName({
            userId: currentUser.id,
            requestName,
            tenders: parsedTenders,
          }).catch((scoringError) => {
            console.error("Failed to score tenders with DeepSeek", scoringError);
          });

          syncWarning =
            "Тендеры сохранены. Скоринг карточек DeepSeek выполняется в фоне и появится после следующего обновления страницы.";
        }

        if (parserEnv.TENDER_PARSER_MODE === "saby") {
          cleanupDeletedCount = await deleteLegacyCachedTendersByKeyword(
            currentUser.id,
            requestName,
            parsedTenders.map((tender) => tender.id),
          );
        }
      } catch (syncError) {
        console.error("Failed to sync tenders with database", syncError);
        syncWarning =
          "Тендеры загружены, но сохранить их в БД не удалось. Проверьте подключение к PostgreSQL.";
      }

      return NextResponse.json(
        buildTendersResponsePayload({
          tenders: parsedTenders,
          statistics: sabyDailyLimitStatisticsAfter,
          statisticsBefore: sabyDailyLimitStatisticsBefore,
          statisticsSpent: sabyStatisticsSpent,
          cleanupDeletedCount,
          warning: syncWarning,
        }),
      );
    } finally {
      inFlightRefreshes.delete(refreshKey);
    }
  } catch (error) {
    return NextResponse.json(toApiErrorResponse(error), {
      status: getApiErrorStatus(error),
    });
  }
}
