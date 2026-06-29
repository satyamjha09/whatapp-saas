import { z } from "zod";

export const updateConversationAssigneeSchema = z.object({
  assignedToUserId: z.string().trim().min(1).nullable(),
});

export type UpdateConversationAssigneeInput = z.infer<
  typeof updateConversationAssigneeSchema
>;
