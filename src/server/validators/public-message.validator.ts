import { z } from "zod";

export const publicSendTemplateMessageSchema = z.object({
  to: z
    .string()
    .trim()
    .min(8, "Recipient phone number is required")
    .max(20, "Recipient phone number is too long")
    .regex(/^\d+$/, "Recipient phone number must contain only numbers"),

  contactName: z
    .string()
    .trim()
    .min(2, "Contact name must be at least 2 characters")
    .max(100, "Contact name must be less than 100 characters")
    .optional(),

  templateName: z.string().trim().min(1, "Template name is required"),

  language: z.string().trim().min(2, "Language is required"),

  variables: z
    .array(z.string().trim().min(1, "Variable value cannot be empty"))
    .default([]),
});

export type PublicSendTemplateMessageInput = z.infer<
  typeof publicSendTemplateMessageSchema
>;
