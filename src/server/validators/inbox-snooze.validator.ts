import { z } from "zod";

export const updateConversationSnoozeSchema = z.object({
  snoozedUntil: z.string().datetime().nullable(),
});

export type UpdateConversationSnoozeInput = z.infer<
  typeof updateConversationSnoozeSchema
>;
