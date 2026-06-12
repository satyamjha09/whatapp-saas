import { z } from "zod";

export const createInboxTagSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Tag name is required")
    .max(40, "Tag name must be less than 40 characters"),
  color: z
    .enum(["gray", "red", "orange", "yellow", "green", "blue", "purple", "pink"])
    .default("gray"),
});

export const addConversationTagSchema = z.object({
  tagId: z.string().min(1, "Tag is required"),
});

export type CreateInboxTagInput = z.infer<typeof createInboxTagSchema>;
export type AddConversationTagInput = z.infer<typeof addConversationTagSchema>;
