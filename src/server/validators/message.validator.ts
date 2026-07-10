import { z } from "zod";

export const sendTemplateMessageSchema = z.object({
  contactId: z.string().min(1, "Contact is required"),
  idempotencyKey: z
    .string()
    .trim()
    .min(8, "Idempotency key must be at least 8 characters")
    .max(160, "Idempotency key is too long")
    .optional(),
  templateId: z.string().min(1, "Template is required"),

  variables: z
    .array(z.string().trim().min(1, "Variable value cannot be empty"))
    .default([]),
});

export type SendTemplateMessageInput = z.infer<
  typeof sendTemplateMessageSchema
>;
