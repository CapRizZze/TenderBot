import { z } from "zod";

export const sabySourceDtoSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  requestName: z.string().min(1),
  description: z.string(),
  includeKeywordsText: z.string(),
  excludeKeywordsText: z.string(),
  refreshPriority: z.enum(["high", "medium", "low"]),
  refreshIntervalMin: z.number().int().positive(),
  isActive: z.boolean(),
});

export type SabySourceDto = z.infer<typeof sabySourceDtoSchema>;
