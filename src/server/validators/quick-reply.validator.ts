import { z } from "zod";

export const createQuickReplySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(80, "Title must be less than 80 characters"),
  body: z
    .string()
    .trim()
    .min(1, "Reply body is required")
    .max(4096, "Reply body must be less than 4096 characters"),
});

export const updateQuickReplySchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(80, "Title must be less than 80 characters"),
  body: z
    .string()
    .trim()
    .min(1, "Reply body is required")
    .max(4096, "Reply body must be less than 4096 characters"),
});

export type CreateQuickReplyInput = z.infer<typeof createQuickReplySchema>;
export type UpdateQuickReplyInput = z.infer<typeof updateQuickReplySchema>;
