import { prisma } from "@/lib/prisma";
import { buildSabyQueryCacheKey, formatSabyQueryLabel } from "@/lib/saby-query";
import {
  createSabyApiCallLog,
  getSabyUsedRequests,
} from "@/lib/services/sabyApiCallLogService";
import { logSabyRequest } from "@/lib/services/sabyRequestLogService";
import { scoreTendersForRequestName } from "@/lib/services/tenderScoringService";
import { tenderSyncService } from "@/lib/services/tenderSyncService";
import { sabyQueryTenderService } from "@/lib/services/sabyQueryTenderService";
import {
  fetchTenderParserDailyLimitStatistics,
} from "@/lib/tender-parser/tenderParserService";

export interface ScheduledQueryRefresh {
  queryId: string;
  refreshPriority: "high" | "medium" | "low";
}

const REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

export class QueryRefreshSchedulerService {
  async pickQueriesForRefresh(limit = 10): Promise<ScheduledQueryRefresh[]> {
    const queries = await prisma.sabyQuery.findMany({
      where: {
        isActive: true,
        profiles: {
          some: {},
        },
      },
      include: {
        refreshRuns: {
          orderBy: {
            startedAt: "desc",
          },
          take: 1,
        },
        profiles: true,
      },
    });

    return queries
      .map((query) => {
        const lastRefreshAt = query.refreshRuns[0]?.startedAt?.getTime() ?? 0;
        const profileCount = query.profiles.length;
        const priority: ScheduledQueryRefresh["refreshPriority"] =
          profileCount >= 3 ? "high" : profileCount === 2 ? "medium" : "low";

        return {
          queryId: query.id,
          refreshPriority: priority,
          profileCount,
          lastRefreshAt,
        };
      })
      .sort((left, right) => {
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        const byPriority =
          priorityWeight[right.refreshPriority] - priorityWeight[left.refreshPriority];

        if (byPriority !== 0) {
          return byPriority;
        }

        if (left.lastRefreshAt !== right.lastRefreshAt) {
          return left.lastRefreshAt - right.lastRefreshAt;
        }

        return right.profileCount - left.profileCount;
      })
      .slice(0, limit)
      .map(({ queryId, refreshPriority }) => ({ queryId, refreshPriority }));
  }

  async runScheduledRefresh(limit = 5): Promise<number> {
    const scheduledQueries = await this.pickQueriesForRefresh(limit);
    let successCount = 0;

    for (const scheduledQuery of scheduledQueries) {
      const query = await prisma.sabyQuery.findUnique({
        where: {
          id: scheduledQuery.queryId,
        },
        include: {
          refreshRuns: {
            orderBy: {
              startedAt: "desc",
            },
            take: 1,
          },
          profiles: {
            include: {
              searchProfile: {
                select: {
                  userId: true,
                },
              },
            },
          },
        },
      });

      if (!query) {
        continue;
      }

      const lastRefreshRun = query.refreshRuns[0];
      if (
        lastRefreshRun?.startedAt &&
        Date.now() - lastRefreshRun.startedAt.getTime() < REFRESH_COOLDOWN_MS
      ) {
        continue;
      }

      const requestCacheKey = buildSabyQueryCacheKey(query.id);
      const requestLogLabel = formatSabyQueryLabel(query);
      const refreshRun = await prisma.sabyQueryRefreshRun.create({
        data: {
          sabyQueryId: scheduledQuery.queryId,
          status: "running",
          startedAt: new Date(),
          metaJson: {
            refreshPriority: scheduledQuery.refreshPriority,
            trigger: "scheduler",
          },
        },
      });

      const startedAt = Date.now();

      try {
        const statisticsBefore = await fetchTenderParserDailyLimitStatistics();

        if (!statisticsBefore) {
          throw new Error("Saby statistics are unavailable for scheduler refresh.");
        }

        if (statisticsBefore.dayRemaining <= 0) {
          await logSabyRequest({
            requestName: requestLogLabel,
            method: "Tender.GetList",
            status: "blocked",
            error: "Scheduler stopped because Saby daily limit is exhausted.",
          });
          await createSabyApiCallLog({
            operation: "scheduled_query_refresh",
            method: "Tender.GetList",
            endpoint: "saby-rpc",
            requestName: requestCacheKey,
            status: "blocked",
            durationMs: Date.now() - startedAt,
            dayCounterBefore: statisticsBefore.dayCounter,
            dayCounterAfter: statisticsBefore.dayCounter,
            dayRemainingBefore: statisticsBefore.dayRemaining,
            dayRemainingAfter: statisticsBefore.dayRemaining,
            payloadSummary: {
              queryId: query.sabyQueryId,
              queryLabel: requestLogLabel,
            },
            error: "Daily limit exhausted before scheduler refresh.",
          });
          await prisma.sabyQueryRefreshRun.update({
            where: {
              id: refreshRun.id,
            },
            data: {
              status: "blocked",
              finishedAt: new Date(),
              error: "Daily limit exhausted before refresh.",
            },
          });
          break;
        }

        const tenders = await sabyQueryTenderService.getTendersForQuery(query.sabyQueryId);
        const statisticsAfter = await fetchTenderParserDailyLimitStatistics();

        if (!statisticsAfter) {
          throw new Error("Saby statistics are unavailable after scheduler refresh.");
        }
        const userIds = [...new Set(query.profiles.map((link) => link.searchProfile.userId))];

        for (const userId of userIds) {
          await tenderSyncService.syncParsedTenders(userId, requestCacheKey, tenders);

          if (tenders.length > 0) {
            await scoreTendersForRequestName({
              userId,
              requestName: query.name,
              sabyQueryId: query.id,
              tenders,
            });
          }
        }

        await logSabyRequest({
          requestName: requestLogLabel,
          method: "Tender.GetList",
          status: tenders.length > 0 ? "success" : "empty",
          tenderCount: tenders.length,
        });
        await createSabyApiCallLog({
          operation: "scheduled_query_refresh",
          method: "Tender.GetList",
          endpoint: "saby-rpc",
          requestName: requestCacheKey,
          status: tenders.length > 0 ? "success" : "empty",
          durationMs: Date.now() - startedAt,
          usedRequests: getSabyUsedRequests(statisticsBefore, statisticsAfter),
          dayCounterBefore: statisticsBefore.dayCounter,
          dayCounterAfter: statisticsAfter.dayCounter,
          dayRemainingBefore: statisticsBefore.dayRemaining,
          dayRemainingAfter: statisticsAfter.dayRemaining,
          payloadSummary: {
            queryId: query.sabyQueryId,
            queryLabel: requestLogLabel,
            refreshPriority: scheduledQuery.refreshPriority,
          },
          responseSummary: {
            tenderCount: tenders.length,
            profilesCount: query.profiles.length,
          },
        });

        await prisma.sabyQueryRefreshRun.update({
          where: {
            id: refreshRun.id,
          },
          data: {
            status: "success",
            finishedAt: new Date(),
            tendersCount: tenders.length,
          },
        });

        successCount += 1;
      } catch (error) {
        await logSabyRequest({
          requestName: requestLogLabel,
          method: "Tender.GetList",
          status: "error",
          error: error instanceof Error ? error.message : "Unknown scheduler error",
        });
        await createSabyApiCallLog({
          operation: "scheduled_query_refresh",
          method: "Tender.GetList",
          endpoint: "saby-rpc",
          requestName: requestCacheKey,
          status: "error",
          durationMs: Date.now() - startedAt,
          payloadSummary: {
            queryId: query.sabyQueryId,
            queryLabel: requestLogLabel,
            refreshPriority: scheduledQuery.refreshPriority,
          },
          error: error instanceof Error ? error.message : "Unknown scheduler error",
        });
        await prisma.sabyQueryRefreshRun.update({
          where: {
            id: refreshRun.id,
          },
          data: {
            status: "error",
            finishedAt: new Date(),
            error: error instanceof Error ? error.message : "Unknown scheduler error",
          },
        });
      }
    }

    return successCount;
  }

  async recordRefreshRun(queryId: string, status: string): Promise<void> {
    await prisma.sabyQueryRefreshRun.create({
      data: {
        sabyQueryId: queryId,
        status,
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    });
  }
}

export const queryRefreshSchedulerService = new QueryRefreshSchedulerService();
