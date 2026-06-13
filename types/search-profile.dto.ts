import { z } from "zod";

import { sabyQueryDtoSchema } from "@/types/saby-query.dto";

export const searchProfileRuleDtoSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["positive", "negative", "hard_exclude", "instruction"]),
  value: z.string().min(1),
  weight: z.number().int(),
});

export const searchProfileDtoSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  scoringPrompt: z.string().min(1),
  isDefault: z.boolean(),
  queries: z.array(sabyQueryDtoSchema).default([]),
  rules: z.array(searchProfileRuleDtoSchema),
});

export type SearchProfileDto = z.infer<typeof searchProfileDtoSchema>;
export type SearchProfileRuleDto = z.infer<typeof searchProfileRuleDtoSchema>;
