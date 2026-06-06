import type { SabyRequestStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

interface LogSabyRequestInput {
  userId?: string;
  requestName: string;
  method: string;
  status: SabyRequestStatus;
  tenderCount?: number;
  error?: string;
}

export async function logSabyRequest({
  userId,
  requestName,
  method,
  status,
  tenderCount = 0,
  error,
}: LogSabyRequestInput) {
  return prisma.sabyRequestLog.create({
    data: {
      userId,
      requestName,
      method,
      status,
      tenderCount,
      error,
    },
  });
}

export async function findTodaysSabyDailyLimit(requestName: string) {
  return prisma.sabyRequestLog.findFirst({
    where: {
      requestName,
      status: "daily_limit",
      createdAt: {
        gte: getLocalDayStart(),
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function hasTodaysSabyDailyLimit(requestName: string) {
  const dailyLimitLog = await findTodaysSabyDailyLimit(requestName);

  return Boolean(dailyLimitLog);
}

function getLocalDayStart() {
  const now = new Date();

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );
}
