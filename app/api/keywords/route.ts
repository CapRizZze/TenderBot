import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { updateKeywordsRequestSchema } from "@/types/keyword.dto";
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

    const keywords = await prisma.userKeyword.findMany({
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
      keywords: keywords.map((keyword) => ({
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

export async function PUT(request: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return createUnauthorizedResponse();
    }

    const body: unknown = await request.json();
    const { keywords } = updateKeywordsRequestSchema.parse(body);
    const normalizedKeywords = Array.from(
      new Set(
        keywords.map((keyword) => keyword.trim().toLocaleLowerCase("ru-RU")),
      ),
    );

    await prisma.$transaction([
      prisma.userKeyword.deleteMany({
        where: {
          userId: currentUser.id,
        },
      }),
      prisma.userKeyword.createMany({
        data: normalizedKeywords.map((keyword) => ({
          userId: currentUser.id,
          value: keyword,
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
