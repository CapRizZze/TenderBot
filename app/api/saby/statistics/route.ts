import { NextResponse } from "next/server";

import { fetchTenderParserDailyLimitStatistics } from "@/lib/tender-parser/tenderParserService";
import { createUnauthorizedResponse, getCurrentUser } from "@/utils/auth";
import {
  getApiErrorStatus,
  toApiErrorResponse,
} from "@/utils/errors";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return createUnauthorizedResponse();
    }

    const statistics = await fetchTenderParserDailyLimitStatistics();

    return NextResponse.json({ statistics });
  } catch (error) {
    return NextResponse.json(toApiErrorResponse(error), {
      status: getApiErrorStatus(error),
    });
  }
}
