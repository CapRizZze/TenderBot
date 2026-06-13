import { NextResponse } from "next/server";

import { getParserEnv } from "@/lib/env";
import { searchProfileMigrationService } from "@/lib/services/searchProfileMigrationService";
import { createUnauthorizedResponse, getCurrentUser } from "@/utils/auth";
import { getApiErrorStatus, toApiErrorResponse } from "@/utils/errors";

export async function POST() {
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
            message: "Search profile migration is available only in saby mode.",
          },
        },
        { status: 400 },
      );
    }

    const result = await searchProfileMigrationService.migrateAllProfilesToQueries();

    return NextResponse.json({
      status: "ok",
      ...result,
    });
  } catch (error) {
    return NextResponse.json(toApiErrorResponse(error), {
      status: getApiErrorStatus(error),
    });
  }
}
