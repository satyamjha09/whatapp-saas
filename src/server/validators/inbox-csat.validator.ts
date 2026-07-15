import { z } from "zod";

export const inboxCsatSettingsSchema = z.object({
  enabled: z.coerce.boolean().default(false),
  delayMinutes: z.coerce.number().int().min(0).max(7 * 24 * 60).default(0),
  expirationHours: z.coerce.number().int().min(1).max(30 * 24).default(72),
  lowScoreThreshold: z.coerce.number().int().min(1).max(5).default(2),
  surveyMessage: z.string().trim().min(10).max(1000),
  followUpQuestion: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((value) => (value ? value : null)),
});

export const inboxCsatScoreSchema = z.object({
  score: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export type InboxCsatSettingsInput = z.infer<typeof inboxCsatSettingsSchema>;
export type InboxCsatScoreInput = z.infer<typeof inboxCsatScoreSchema>;
