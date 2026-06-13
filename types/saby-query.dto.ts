import { z } from "zod";

export const sabyQueryDtoSchema = z.object({
  id: z.string().min(1),
  sabyQueryId: z.number().int(),
  folderId: z.string().min(1).nullable().optional(),
  folderName: z.string().nullable().optional(),
  name: z.string().min(1),
  parentFolderName: z.string().nullable().optional(),
  ftsString: z.string(),
  ftsStringExclude: z.string(),
  isActive: z.boolean(),
  lastSyncedAt: z.string().datetime().nullable().optional(),
});

export type SabyQueryDto = z.infer<typeof sabyQueryDtoSchema>;
