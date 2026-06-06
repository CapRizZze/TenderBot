import { z } from "zod";

export const searchProfileUpdateDtoSchema = z.object({
  name: z.string().trim().min(1, "Укажите название профиля."),
  description: z.string().trim().min(1, "Укажите описание профиля."),
  scoringPrompt: z.string().trim().min(1, "Укажите scoring prompt."),
  requestNames: z
    .array(z.string().trim().min(1))
    .min(1, "Выберите хотя бы один RequestName."),
  rules: z.object({
    positive: z.array(z.string().trim().min(1)).default([]),
    negative: z.array(z.string().trim().min(1)).default([]),
    hardExclude: z.array(z.string().trim().min(1)).default([]),
    instruction: z.array(z.string().trim().min(1)).default([]),
  }),
});

export type SearchProfileUpdateDto = z.infer<typeof searchProfileUpdateDtoSchema>;
