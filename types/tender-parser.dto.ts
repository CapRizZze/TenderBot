import { z } from "zod";

// DTO тендера, который приходит из внешнего REST-парсера.
export const tenderParserDtoSchema = z.object({
  id: z.string().min(1, "Идентификатор тендера обязателен"),
  title: z.string().min(1, "Название тендера обязательно"),
  description: z.string().min(1, "Описание тендера обязательно"),
  customer: z.string().min(1, "Заказчик обязателен"),
  deadline: z.string().datetime("Дедлайн должен быть ISO-датой"),
  budget: z.number().positive("Бюджет должен быть положительным").optional(),
  url: z.string().url("Ссылка на тендер должна быть валидным URL"),
});

export const tenderParserResponseSchema = z.array(tenderParserDtoSchema);

export const tenderKeywordsSchema = z
  .array(z.string().trim().min(1, "Ключевое слово не может быть пустым"))
  .min(1, "Нужно передать хотя бы одно ключевое слово");

export const tendersRequestSchema = z.object({
  keywords: tenderKeywordsSchema,
});

export type Tender = z.infer<typeof tenderParserDtoSchema>;

export type TenderParserResponseDto = z.infer<typeof tenderParserResponseSchema>;

export type TendersRequestDto = z.infer<typeof tendersRequestSchema>;
