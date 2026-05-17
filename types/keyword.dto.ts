import { z } from "zod";

export const keywordValueSchema = z
  .string()
  .trim()
  .min(2, "Ключевое слово должно содержать минимум 2 символа")
  .max(80, "Ключевое слово должно быть короче 80 символов");

export const updateKeywordsRequestSchema = z.object({
  keywords: z
    .array(keywordValueSchema)
    .min(1, "Добавьте хотя бы одно ключевое слово")
    .max(20, "Для MVP доступно не более 20 ключевых слов"),
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

export type UpdateKeywordsRequestDto = z.infer<
  typeof updateKeywordsRequestSchema
>;

export type KeywordsResponseDto = z.infer<typeof keywordsResponseSchema>;
