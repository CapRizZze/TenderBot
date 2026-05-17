import { NextResponse } from "next/server";

import { tenderSyncService } from "@/lib/services/tenderSyncService";
import { tenderParserService } from "@/lib/tender-parser/tenderParserService";
import { tendersRequestSchema } from "@/types/tender-parser.dto";
import { createUnauthorizedResponse, getCurrentUser } from "@/utils/auth";
import {
  getApiErrorStatus,
  toApiErrorResponse,
} from "@/utils/errors";

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return createUnauthorizedResponse();
    }

    const body: unknown = await request.json();
    const { keywords } = tendersRequestSchema.parse(body);
    const parsedTenders =
      await tenderParserService.fetchTendersByKeywords(keywords);
    const tenders = await tenderSyncService.syncParsedTenders(parsedTenders);

    return NextResponse.json({ tenders });
  } catch (error) {
    return NextResponse.json(toApiErrorResponse(error), {
      status: getApiErrorStatus(error),
    });
  }
}
