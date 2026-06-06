import type { Conversation, Message, MessageRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

interface EnsureConversationInput {
  userId: string;
  tenderId: string;
  title?: string;
}

interface CreateMessageInput {
  conversationId: string;
  role: MessageRole;
  content: string;
  clientMessageId?: string;
}

interface UpdateMessageContentInput {
  messageId: string;
  content: string;
}

export async function ensureConversation({
  userId,
  tenderId,
  title,
}: EnsureConversationInput): Promise<Conversation> {
  return prisma.conversation.upsert({
    where: {
      userId_tenderId: {
        userId,
        tenderId,
      },
    },
    create: {
      userId,
      tenderId,
      title,
    },
    update: {
      title,
    },
  });
}

export async function createConversationMessage({
  conversationId,
  role,
  content,
  clientMessageId,
}: CreateMessageInput): Promise<Message> {
  return prisma.$transaction(async (transaction) => {
    const message = clientMessageId
      ? await transaction.message.upsert({
          where: {
            conversationId_clientMessageId: {
              conversationId,
              clientMessageId,
            },
          },
          create: {
            conversationId,
            role,
            content,
            clientMessageId,
          },
          update: {},
        })
      : await transaction.message.create({
          data: {
            conversationId,
            role,
            content,
          },
        });

    await transaction.conversation.update({
      where: {
        id: conversationId,
      },
      data: {
        updatedAt: new Date(),
      },
    });

    return message;
  });
}

export async function updateConversationMessageContent({
  messageId,
  content,
}: UpdateMessageContentInput): Promise<Message> {
  return prisma.$transaction(async (transaction) => {
    const message = await transaction.message.update({
      where: {
        id: messageId,
      },
      data: {
        content,
      },
    });

    await transaction.conversation.update({
      where: {
        id: message.conversationId,
      },
      data: {
        updatedAt: new Date(),
      },
    });

    return message;
  });
}
