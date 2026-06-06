import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { SabyDailyLimitStatistics } from "@/types/tender-parser.dto";
import type { SabyApiCallLogEntry } from "@/types/saby-api-log.dto";

interface CreateSabyApiCallLogInput {
  userId?: string;
  operation: string;
  method: string;
  endpoint: string;
  requestName?: string;
  tenderExternalId?: string;
  tenderNumber?: string;
  status: string;
  httpStatus?: number;
  durationMs: number;
  usedRequests?: number;
  dayCounterBefore?: number;
  dayCounterAfter?: number;
  dayRemainingBefore?: number;
  dayRemainingAfter?: number;
  payloadSummary?: Prisma.InputJsonValue;
  responseSummary?: Prisma.InputJsonValue;
  error?: string;
}

export async function createSabyApiCallLog(input: CreateSabyApiCallLogInput) {
  return prisma.sabyApiCallLog.create({
    data: {
      userId: input.userId,
      operation: input.operation,
      method: input.method,
      endpoint: input.endpoint,
      requestName: input.requestName,
      tenderExternalId: input.tenderExternalId,
      tenderNumber: input.tenderNumber,
      status: input.status,
      httpStatus: input.httpStatus,
      durationMs: input.durationMs,
      usedRequests: input.usedRequests,
      dayCounterBefore: input.dayCounterBefore,
      dayCounterAfter: input.dayCounterAfter,
      dayRemainingBefore: input.dayRemainingBefore,
      dayRemainingAfter: input.dayRemainingAfter,
      payloadSummary: input.payloadSummary,
      responseSummary: input.responseSummary,
      error: input.error,
    },
  });
}

export async function findRecentSabyApiCallLogs(
  limit = 15,
): Promise<SabyApiCallLogEntry[]> {
  const logs = await prisma.sabyApiCallLog.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });

  return logs.map((log) => ({
    id: log.id,
    operation: log.operation,
    method: log.method,
    endpoint: log.endpoint,
    requestName: log.requestName,
    tenderExternalId: log.tenderExternalId,
    tenderNumber: log.tenderNumber,
    status: log.status,
    httpStatus: log.httpStatus,
    durationMs: log.durationMs,
    usedRequests: log.usedRequests,
    dayCounterBefore: log.dayCounterBefore,
    dayCounterAfter: log.dayCounterAfter,
    dayRemainingBefore: log.dayRemainingBefore,
    dayRemainingAfter: log.dayRemainingAfter,
    error: log.error,
    createdAt: log.createdAt.toISOString(),
  }));
}

interface FindRecentSabyApiCallInput {
  userId?: string;
  operation: string;
  requestName?: string;
  since: Date;
}

export async function findLatestSabyApiCall({
  userId,
  operation,
  requestName,
  since,
}: FindRecentSabyApiCallInput) {
  return prisma.sabyApiCallLog.findFirst({
    where: {
      operation,
      createdAt: {
        gte: since,
      },
      ...(userId ? { userId } : {}),
      ...(requestName ? { requestName } : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export function getSabyUsedRequests(
  before: SabyDailyLimitStatistics | null | undefined,
  after: SabyDailyLimitStatistics | null | undefined,
) {
  if (!before || !after) {
    return undefined;
  }

  return Math.max(after.dayCounter - before.dayCounter, 0);
}
