import { z } from "zod";

export const keywordValueSchema = z
  .string()
  .trim()
  .min(2, "RequestName должен содержать минимум 2 символа")
  .max(80, "RequestName должен быть короче 80 символов");

export const updateKeywordsRequestSchema = z.object({
  keywords: z
    .array(keywordValueSchema)
    .min(1, "Добавьте хотя бы один RequestName")
    .max(20, "Для MVP доступно не более 20 RequestName"),
});

export const keywordDtoSchema = z.object({
  id: z.string(),
  value: keywordValueSchema,
  createdAt: z.string().datetime(),
});

export const keywordsResponseSchema = z.object({
  keywords: z.array(keywordDtoSchema),
});

export type KeywordDto = z.infer<typeof keywordDtoSchema>;
export type UpdateKeywordsRequestDto = z.infer<typeof updateKeywordsRequestSchema>;
export type KeywordsResponseDto = z.infer<typeof keywordsResponseSchema>;
