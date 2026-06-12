import { z } from "zod";

export const updateConversationPrioritySchema = z.object({
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
});

export type UpdateConversationPriorityInput = z.infer<
  typeof updateConversationPrioritySchema
>;
