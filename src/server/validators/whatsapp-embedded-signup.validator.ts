import { z } from "zod";

export const completeWhatsAppEmbeddedSignupSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Authorization code is required")
    .max(4096, "Authorization code is invalid"),
  wabaId: z
    .string()
    .trim()
    .regex(/^\d+$/, "WABA ID must contain only digits"),
  phoneNumberId: z
    .string()
    .trim()
    .regex(/^\d+$/, "Phone Number ID must contain only digits"),
});

export type CompleteWhatsAppEmbeddedSignupInput = z.infer<
  typeof completeWhatsAppEmbeddedSignupSchema
>;
