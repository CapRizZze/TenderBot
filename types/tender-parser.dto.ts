import { z } from "zod";

export const tenderAttachmentDtoSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1, "Название вложения обязательно"),
  url: z.string().url("Ссылка на вложение должна быть валидным URL"),
  mimeType: z.string().min(1).optional(),
  size: z.number().int().positive().optional(),
});

export const tenderParserDtoSchema = z.object({
  id: z.string().min(1, "Идентификатор тендера обязателен"),
  number: z.string().min(1).optional(),
  title: z.string().min(1, "Название тендера обязательно"),
  description: z.string().min(1, "Описание тендера обязательно"),
  customer: z.string().min(1, "Заказчик обязателен"),
  placedAt: z.string().datetime("Дата размещения должна быть в формате ISO").optional(),
  deadline: z.string().datetime("Срок подачи должен быть в формате ISO"),
  budget: z.number().positive("Цена контракта должна быть положительным числом").optional(),
  url: z.string().url("Ссылка на тендер должна быть валидным URL"),
  sourceUrl: z.string().url().optional(),
  sabyUrl: z.string().url().optional(),
  source: z.enum(["government", "commercial", "unknown"]).optional(),
  profileScore: z
    .object({
      score: z.number().int().min(0).max(100),
      verdict: z.enum(["relevant", "maybe", "irrelevant"]),
      userVerdict: z.enum(["relevant", "maybe", "irrelevant"]).optional(),
      userComment: z.string().optional(),
      reasons: z.array(z.string()),
      positiveSignals: z.array(z.string()).optional(),
      negativeSignals: z.array(z.string()).optional(),
      suggestedRules: z.array(z.string()).optional(),
    })
    .optional(),
  attachments: z.array(tenderAttachmentDtoSchema).optional().default([]),
});

export const tenderParserResponseSchema = z.array(tenderParserDtoSchema);

export const sabyDailyLimitStatisticsSchema = z.object({
  dayCounter: z.number().int().nonnegative(),
  dayLimit: z.number().int().nonnegative(),
  dayRemaining: z.number().int().nonnegative(),
});

export const tenderKeywordsSchema = z
  .array(z.string().trim().min(1, "RequestName не может быть пустым"))
  .min(1, "Нужно передать хотя бы один RequestName");

export const tendersRequestSchema = z.object({
  keywords: tenderKeywordsSchema,
});

export type Tender = z.infer<typeof tenderParserDtoSchema>;
export type TenderAttachment = z.infer<typeof tenderAttachmentDtoSchema>;
export type TenderParserResponseDto = z.infer<typeof tenderParserResponseSchema>;
export type TendersRequestDto = z.infer<typeof tendersRequestSchema>;
export type SabyDailyLimitStatistics = z.infer<typeof sabyDailyLimitStatisticsSchema>;
