import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, type CoreMessage } from "ai";
import { NextResponse } from "next/server";

import { buildTenderConversationTitle } from "@/lib/conversation-title";
import { getDeepSeekEnv } from "@/lib/env";
import {
  createConversationMessage,
  ensureConversation,
  updateConversationMessageContent,
} from "@/lib/repositories/conversationRepository";
import {
  findCachedTenderByExternalId,
  findStoredTenderByExternalId,
} from "@/lib/repositories/tenderRepository";
import {
  filterAllowedAttachments,
  limitAttachmentContentsForPrompt,
} from "@/lib/services/chatAttachmentPolicy";
import {
  buildChatSystemMessage,
  findLastUserMessage,
} from "@/lib/services/chatRoutePresentation";
import { getOrFetchTenderAttachmentContents } from "@/lib/services/tenderAttachmentContentService";
import { chatRequestDtoSchema } from "@/types/chat.dto";
import { createUnauthorizedResponse, getCurrentUser } from "@/utils/auth";
import { getApiErrorStatus, toApiErrorResponse } from "@/utils/errors";

export const runtime = "nodejs";

const ASSISTANT_PLACEHOLDER_TEXT =
  "Ответ формируется. Если генерация оборвется, запустите запрос повторно.";

const deepSeekEnv = getDeepSeekEnv();

const deepSeek = createOpenAICompatible({
  name: "deepseek",
  apiKey: deepSeekEnv.DEEPSEEK_API_KEY,
  baseURL: deepSeekEnv.DEEPSEEK_BASE_URL,
});

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return createUnauthorizedResponse();
    }

    const body: unknown = await request.json();
    const { clientMessageId, tender, selectedAttachments, messages } =
      chatRequestDtoSchema.parse(body);
    const lastUserMessage = findLastUserMessage(messages);

    if (!lastUserMessage) {
      return NextResponse.json(
        {
          error: {
            message: "User message is required",
          },
        },
        { status: 400 },
      );
    }

    const savedTender = await findCachedTenderByExternalId(tender.id, currentUser.id);
    const storedTender = await findStoredTenderByExternalId(tender.id, currentUser.id);

    if (!savedTender || !storedTender || storedTender.requestNames.length === 0) {
      return NextResponse.json(
        {
          error: {
            message:
              "Тендер не найден в локальной базе. Сначала обновите кэш и откройте тендер заново.",
          },
        },
        { status: 404 },
      );
    }

    const validatedSelectedAttachments = filterAllowedAttachments(
      savedTender.attachments,
      selectedAttachments,
    );

    const conversation = await ensureConversation({
      userId: currentUser.id,
      tenderId: storedTender.id,
      title: buildTenderConversationTitle(savedTender),
    });

    const selectedAttachmentContents = limitAttachmentContentsForPrompt(
      await getOrFetchTenderAttachmentContents(
        savedTender.id,
        validatedSelectedAttachments,
      ),
    );

    await createConversationMessage({
      conversationId: conversation.id,
      role: "user",
      content: lastUserMessage.content,
      clientMessageId,
    });

    const assistantMessage = await createConversationMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: ASSISTANT_PLACEHOLDER_TEXT,
      clientMessageId: clientMessageId ? `${clientMessageId}:assistant` : undefined,
    });

    const systemMessage: CoreMessage = buildChatSystemMessage(
      savedTender,
      validatedSelectedAttachments,
      selectedAttachmentContents,
    );

    const result = await streamText({
      model: deepSeek(deepSeekEnv.DEEPSEEK_MODEL),
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

        await updateConversationMessageContent({
          messageId: assistantMessage.id,
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
