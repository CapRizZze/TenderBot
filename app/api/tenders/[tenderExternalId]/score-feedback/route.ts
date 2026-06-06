import { NextResponse } from "next/server";

import { saveTenderScoreFeedback } from "@/lib/services/tenderScoringService";
import { tenderScoreFeedbackSchema } from "@/types/tender-score-feedback.dto";
import { createUnauthorizedResponse, getCurrentUser } from "@/utils/auth";
import { getApiErrorStatus, toApiErrorResponse } from "@/utils/errors";

interface RouteContext {
  params: {
    tenderExternalId: string;
  };
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return createUnauthorizedResponse();
    }

    const body: unknown = await request.json();
    const parsed = tenderScoreFeedbackSchema.parse(body);

    const result = await saveTenderScoreFeedback({
      userId: currentUser.id,
      tenderExternalId: context.params.tenderExternalId,
      searchProfileId: parsed.searchProfileId,
      verdict: parsed.verdict,
      comment: parsed.comment,
      applyToProfile: parsed.applyToProfile,
    });

    return NextResponse.json({
      success: true,
      verdict: result.verdict,
      comment: result.comment,
      createdRules: result.createdRules,
    });
  } catch (error) {
    return NextResponse.json(toApiErrorResponse(error), {
      status: getApiErrorStatus(error),
    });
  }
}
