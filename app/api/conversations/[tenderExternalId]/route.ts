import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { createUnauthorizedResponse, getCurrentUser } from "@/utils/auth";
import { getApiErrorStatus, toApiErrorResponse } from "@/utils/errors";

const routeParamsSchema = z.object({
  tenderExternalId: z.string().min(1, "Идентификатор тендера обязателен"),
});

interface ConversationRouteContext {
  params: {
    tenderExternalId: string;
  };
}

export async function GET(_request: Request, context: ConversationRouteContext) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return createUnauthorizedResponse();
    }

    const { tenderExternalId } = routeParamsSchema.parse(context.params);
    const tender = await prisma.tender.findUnique({
      where: {
        externalId: tenderExternalId,
      },
      select: {
        id: true,
      },
    });

    if (!tender) {
      return NextResponse.json({
        conversationId: null,
        messages: [],
      });
    }

    const conversation = await prisma.conversation.findUnique({
      where: {
        userId_tenderId: {
          userId: currentUser.id,
          tenderId: tender.id,
        },
      },
      select: {
        id: true,
        messages: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({
        conversationId: null,
        messages: [],
      });
    }

    return NextResponse.json({
      conversationId: conversation.id,
      messages: conversation.messages.map((message) => ({
        ...message,
        createdAt: message.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return NextResponse.json(toApiErrorResponse(error), {
      status: getApiErrorStatus(error),
    });
  }
}

export async function DELETE(_request: Request, context: ConversationRouteContext) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return createUnauthorizedResponse();
    }

    const { tenderExternalId } = routeParamsSchema.parse(context.params);
    const tender = await prisma.tender.findUnique({
      where: {
        externalId: tenderExternalId,
      },
      select: {
        id: true,
      },
    });

    if (!tender) {
      return NextResponse.json({ deleted: false });
    }

    await prisma.conversation.deleteMany({
      where: {
        userId: currentUser.id,
        tenderId: tender.id,
      },
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(toApiErrorResponse(error), {
      status: getApiErrorStatus(error),
    });
  }
}
