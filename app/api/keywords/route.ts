import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  getConfiguredSabyRequestNames,
  userKeywordService,
} from "@/lib/services/userKeywordService";
import { updateKeywordsRequestSchema } from "@/types/keyword.dto";
import { createUnauthorizedResponse, getCurrentUser } from "@/utils/auth";
import { getApiErrorStatus, toApiErrorResponse } from "@/utils/errors";

function normalizeRequestName(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU");
}

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return createUnauthorizedResponse();
    }

    const keywords = await userKeywordService.getOrCreateUserKeywords(currentUser.id);

    return NextResponse.json({ keywords });
  } catch (error) {
    return NextResponse.json(toApiErrorResponse(error), {
      status: getApiErrorStatus(error),
    });
  }
}

export async function PUT(request: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return createUnauthorizedResponse();
    }

    const configuredRequestNames = getConfiguredSabyRequestNames();

    if (configuredRequestNames.length === 0) {
      return NextResponse.json(
        {
          error: {
            message:
              "Список SABY_TENDER_REQUEST_NAMES пуст. Сначала заполните конфигурацию сервиса.",
          },
        },
        { status: 400 },
      );
    }

    const body: unknown = await request.json();
    const { keywords } = updateKeywordsRequestSchema.parse(body);
    const configuredMap = new Map(
      configuredRequestNames.map((requestName) => [
        normalizeRequestName(requestName),
        requestName,
      ]),
    );

    const invalidKeywords = keywords.filter(
      (keyword) => !configuredMap.has(normalizeRequestName(keyword)),
    );

    if (invalidKeywords.length > 0) {
      return NextResponse.json(
        {
          error: {
            message: `Допустимы только RequestName из конфигурации Saby: ${configuredRequestNames.join(", ")}`,
          },
        },
        { status: 400 },
      );
    }

    const normalizedKeywords = Array.from(
      new Set(
        keywords
          .map((keyword) => configuredMap.get(normalizeRequestName(keyword)))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    await prisma.$transaction([
      prisma.userKeyword.deleteMany({
        where: {
          userId: currentUser.id,
        },
      }),
      prisma.userKeyword.createMany({
        data: normalizedKeywords.map((requestName) => ({
          userId: currentUser.id,
          value: requestName,
        })),
      }),
    ]);

    const savedKeywords = await prisma.userKeyword.findMany({
      where: {
        userId: currentUser.id,
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        value: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      keywords: savedKeywords.map((keyword) => ({
        ...keyword,
        createdAt: keyword.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return NextResponse.json(toApiErrorResponse(error), {
      status: getApiErrorStatus(error),
    });
  }
}
