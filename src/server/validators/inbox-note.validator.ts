import { z } from "zod";

export const createInboxNoteSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Note is required")
    .max(2000, "Note must be less than 2000 characters"),
});

export const updateInboxNoteSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Note is required")
    .max(2000, "Note must be less than 2000 characters"),
});

export type CreateInboxNoteInput = z.infer<typeof createInboxNoteSchema>;
export type UpdateInboxNoteInput = z.infer<typeof updateInboxNoteSchema>;
