import { z } from "zod";

export const sendTemplateMessageSchema = z.object({
  contactId: z.string().min(1, "Contact is required"),
  templateId: z.string().min(1, "Template is required"),

  variables: z
    .array(z.string().trim().min(1, "Variable value cannot be empty"))
    .default([]),
});

export type SendTemplateMessageInput = z.infer<
  typeof sendTemplateMessageSchema
>;
