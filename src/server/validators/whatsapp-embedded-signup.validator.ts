import { z } from "zod";

export const completeWhatsAppEmbeddedSignupSchema = z.object({
  code: z.string().trim().min(1, "Authorization code is required"),
  wabaId: z.string().trim().min(1, "WABA ID is required"),
  phoneNumberId: z.string().trim().min(1, "Phone Number ID is required"),
});

export type CompleteWhatsAppEmbeddedSignupInput = z.infer<
  typeof completeWhatsAppEmbeddedSignupSchema
>;
