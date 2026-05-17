import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
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

    const conversations = await prisma.conversation.findMany({
      where: {
        userId: currentUser.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        tender: {
          select: {
            id: true,
            externalId: true,
            title: true,
            customer: true,
            deadline: true,
            budget: true,
            url: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });

    return NextResponse.json({
      conversations: conversations.map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        updatedAt: conversation.updatedAt.toISOString(),
        tender: {
          ...conversation.tender,
          deadline: conversation.tender.deadline.toISOString(),
          budget: conversation.tender.budget?.toNumber() ?? null,
        },
        lastMessage: conversation.messages[0]
          ? {
              ...conversation.messages[0],
              createdAt: conversation.messages[0].createdAt.toISOString(),
            }
          : null,
      })),
    });
  } catch (error) {
    return NextResponse.json(toApiErrorResponse(error), {
      status: getApiErrorStatus(error),
    });
  }
}
