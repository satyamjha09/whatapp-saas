import { z } from "zod";

export const updateConversationSnoozeSchema = z.object({
  snoozedUntil: z.string().datetime().nullable(),
  snoozeReason: z.string().max(240).optional(),
});

export type UpdateConversationSnoozeInput = z.infer<
  typeof updateConversationSnoozeSchema
>;
