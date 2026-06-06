import { z } from "zod";

export const tenderScoreFeedbackSchema = z.object({
  searchProfileId: z.string().min(1),
  verdict: z.enum(["relevant", "maybe", "irrelevant"]),
  comment: z.string().trim().max(1000).optional().default(""),
  applyToProfile: z.boolean().optional().default(false),
});

export type TenderScoreFeedbackDto = z.infer<typeof tenderScoreFeedbackSchema>;
