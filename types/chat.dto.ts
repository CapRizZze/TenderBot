import { z } from "zod";

import {
  tenderAttachmentDtoSchema,
  tenderParserDtoSchema,
} from "./tender-parser.dto.ts";

export const chatMessageRoleSchema = z.enum(["user", "assistant", "system"]);

export const chatMessageDtoSchema = z.object({
  role: chatMessageRoleSchema,
  content: z.string().trim().min(1, "Сообщение не может быть пустым"),
});

export const chatRequestDtoSchema = z.object({
  conversationId: z.string().min(1).optional(),
  clientMessageId: z.string().min(1).optional(),
  tender: tenderParserDtoSchema,
  selectedAttachments: z.array(tenderAttachmentDtoSchema).optional().default([]),
  messages: z
    .array(chatMessageDtoSchema)
    .min(1, "Нужно передать хотя бы одно сообщение"),
});

export type ChatMessageRole = z.infer<typeof chatMessageRoleSchema>;
export type ChatMessageDto = z.infer<typeof chatMessageDtoSchema>;
export type ChatRequestDto = z.infer<typeof chatRequestDtoSchema>;
