import { z } from "zod";

export const conversationMessageDtoSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  createdAt: z.string().datetime(),
});

export const conversationHistoryResponseSchema = z.object({
  conversationId: z.string().nullable(),
  messages: z.array(conversationMessageDtoSchema),
});

export const conversationListItemDtoSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  updatedAt: z.string().datetime(),
  tender: z.object({
    id: z.string(),
    externalId: z.string(),
    title: z.string(),
    customer: z.string(),
    deadline: z.string().datetime(),
    budget: z.number().nullable(),
    url: z.string().url(),
  }),
  lastMessage: conversationMessageDtoSchema.nullable(),
});

export const conversationListResponseSchema = z.object({
  conversations: z.array(conversationListItemDtoSchema),
});

export type ConversationMessageDto = z.infer<typeof conversationMessageDtoSchema>;
export type ConversationHistoryResponseDto = z.infer<typeof conversationHistoryResponseSchema>;
export type ConversationListItemDto = z.infer<typeof conversationListItemDtoSchema>;
export type ConversationListResponseDto = z.infer<typeof conversationListResponseSchema>;
