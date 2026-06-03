import { z } from "zod";

export const updateConversationStatusSchema = z.object({
  status: z.enum(["OPEN", "CLOSED"]),
});

export type UpdateConversationStatusInput = z.infer<
  typeof updateConversationStatusSchema
>;
