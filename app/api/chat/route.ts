import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, type CoreMessage } from "ai";
import { NextResponse } from "next/server";

import { getQwenEnv } from "@/lib/env";
import {
  createConversationMessage,
  ensureConversation,
} from "@/lib/repositories/conversationRepository";
import { upsertTenderFromParserDto } from "@/lib/repositories/tenderRepository";
import { chatRequestDtoSchema } from "@/types/chat.dto";
import { createUnauthorizedResponse, getCurrentUser } from "@/utils/auth";
import {
  getApiErrorStatus,
  toApiErrorResponse,
} from "@/utils/errors";

export const runtime = "nodejs";

const qwenEnv = getQwenEnv();

const qwen = createOpenAICompatible({
  name: "qwen",
  apiKey: qwenEnv.QWEN_API_KEY,
  baseURL: qwenEnv.QWEN_BASE_URL,
});

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return createUnauthorizedResponse();
    }

    const body: unknown = await request.json();
    const { clientMessageId, tender, messages } =
      chatRequestDtoSchema.parse(body);
    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");

    if (!lastUserMessage) {
      return NextResponse.json(
        {
          error: {
            message: "В запросе нет пользовательского сообщения",
          },
        },
        { status: 400 },
      );
    }

    const savedTender = await upsertTenderFromParserDto(tender);
    const conversation = await ensureConversation({
      userId: currentUser.id,
      tenderId: savedTender.id,
      title: tender.title,
    });

    await createConversationMessage({
      conversationId: conversation.id,
      role: "user",
      content: lastUserMessage.content,
      clientMessageId,
    });

    const systemMessage: CoreMessage = {
      role: "system",
      content: [
        "Ты AI Tender Bot, эксперт по анализу государственных и коммерческих торгов.",
        "Отвечай на русском языке, структурно и практично.",
        "Анализируй требования, риски, сроки, бюджет, заказчика и вероятность соответствия участника.",
        "Не выдумывай факты: если данных тендера недостаточно, явно укажи, что нужно уточнить.",
        "",
        "Контекст тендера:",
        `Название: ${tender.title}`,
        `Заказчик: ${tender.customer}`,
        `Описание: ${tender.description}`,
        `Дедлайн: ${tender.deadline}`,
        `Бюджет: ${typeof tender.budget === "number" ? tender.budget : "не указан"}`,
        `Ссылка: ${tender.url}`,
      ].join("\n"),
    };

    const result = await streamText({
      model: qwen(qwenEnv.QWEN_MODEL),
      messages: [
        systemMessage,
        ...messages.map(
          (message): CoreMessage => ({
            role: message.role,
            content: message.content,
          }),
        ),
      ],
      onFinish: async ({ text }) => {
        const content = text.trim();

        if (content.length === 0) {
          return;
        }

        await createConversationMessage({
          conversationId: conversation.id,
          role: "assistant",
          content,
        });
      },
    });

    return result.toDataStreamResponse();
  } catch (error) {
    return NextResponse.json(toApiErrorResponse(error), {
      status: getApiErrorStatus(error),
    });
  }
}
