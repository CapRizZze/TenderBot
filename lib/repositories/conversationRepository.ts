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
