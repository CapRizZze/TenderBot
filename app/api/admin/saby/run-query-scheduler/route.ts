import { NextResponse } from "next/server";

import { getParserEnv } from "@/lib/env";
import { queryRefreshSchedulerService } from "@/lib/services/queryRefreshSchedulerService";
import { createUnauthorizedResponse, getCurrentUser } from "@/utils/auth";
import { getApiErrorStatus, toApiErrorResponse } from "@/utils/errors";

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return createUnauthorizedResponse();
    }

    const parserEnv = getParserEnv();

    if (parserEnv.TENDER_PARSER_MODE !== "saby") {
      return NextResponse.json(
        {
          error: {
            message: "Query scheduler is available only in saby mode.",
          },
        },
        { status: 400 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as { limit?: number };
    const limit =
      typeof body.limit === "number" && Number.isInteger(body.limit) && body.limit > 0
        ? body.limit
        : 5;
    const refreshedCount = await queryRefreshSchedulerService.runScheduledRefresh(limit);

    return NextResponse.json({
      status: "ok",
      refreshedCount,
      limit,
    });
  } catch (error) {
    return NextResponse.json(toApiErrorResponse(error), {
      status: getApiErrorStatus(error),
    });
  }
}
