import { z } from "zod";

export const createInboxReplySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Reply cannot be empty")
    .max(4096, "Reply cannot exceed 4096 characters"),
});

export type CreateInboxReplyInput = z.infer<typeof createInboxReplySchema>;
