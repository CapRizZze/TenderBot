import { NextResponse } from "next/server";
import { z } from "zod";

import { getParserEnv } from "@/lib/env";
import {
  findCachedTenderByExternalId,
  replaceTenderAttachments,
} from "@/lib/repositories/tenderRepository";
import {
  createSabyApiCallLog,
  getSabyUsedRequests,
} from "@/lib/services/sabyApiCallLogService";
import { fetchTenderParserDailyLimitStatistics } from "@/lib/tender-parser/tenderParserService";
import { fetchTenderParserDocuments } from "@/lib/tender-parser/tenderParserService";
import { createUnauthorizedResponse, getCurrentUser } from "@/utils/auth";
import {
  getApiErrorStatus,
  toApiErrorResponse,
} from "@/utils/errors";

const routeParamsSchema = z.object({
  tenderExternalId: z.string().min(1),
});

interface TenderDocumentsRouteContext {
  params: {
    tenderExternalId: string;
  };
}

export async function GET(
  _request: Request,
  context: TenderDocumentsRouteContext,
) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return createUnauthorizedResponse();
    }

    const { tenderExternalId } = routeParamsSchema.parse(context.params);
    const cachedTender = await findCachedTenderByExternalId(
      tenderExternalId,
      currentUser.id,
    );
    const parserEnv = getParserEnv();

    if (!cachedTender) {
      return NextResponse.json(
        {
          error: {
            message: "Тендер не найден в выдаче текущего пользователя.",
          },
        },
        { status: 404 },
      );
    }

    if (cachedTender?.attachments.length) {
      return NextResponse.json({
        documents: cachedTender.attachments,
        source: "cache",
      });
    }

    const startedAt = Date.now();
    const before =
      parserEnv.TENDER_PARSER_MODE === "saby"
        ? await fetchTenderParserDailyLimitStatistics()
        : null;
    const fetchedDocuments = await fetchTenderParserDocuments({
      externalId: tenderExternalId,
      ...(cachedTender?.number ? { number: cachedTender.number } : {}),
    });
    const after =
      parserEnv.TENDER_PARSER_MODE === "saby"
        ? await fetchTenderParserDailyLimitStatistics()
        : null;
    const documents = fetchedDocuments.length
      ? await replaceTenderAttachments(tenderExternalId, fetchedDocuments)
      : [];

    if (parserEnv.TENDER_PARSER_MODE === "saby") {
      await createSabyApiCallLog({
        userId: currentUser.id,
        operation: "fetch_tender_documents",
        method: cachedTender?.number
          ? "SbisTenderAPI.GetTenderListByID/GetTenderListByNumber"
          : "SbisTenderAPI.GetTenderListByID",
        endpoint: parserEnv.SABY_TENDER_API_URL ?? "unknown",
        tenderExternalId,
        tenderNumber: cachedTender?.number,
        status: fetchedDocuments.length > 0 ? "success" : "empty",
        durationMs: Date.now() - startedAt,
        usedRequests: getSabyUsedRequests(before, after),
        dayCounterBefore: before?.dayCounter,
        dayCounterAfter: after?.dayCounter,
        dayRemainingBefore: before?.dayRemaining,
        dayRemainingAfter: after?.dayRemaining,
        payloadSummary: {
          externalId: tenderExternalId,
          number: cachedTender?.number ?? null,
        },
        responseSummary: {
          documentsCount: fetchedDocuments.length,
          source: fetchedDocuments.length > 0 ? "saby" : "none",
        },
      });
    }

    return NextResponse.json({
      documents,
      source: fetchedDocuments.length ? "saby" : "none",
    });
  } catch (error) {
    return NextResponse.json(toApiErrorResponse(error), {
      status: getApiErrorStatus(error),
    });
  }
}
