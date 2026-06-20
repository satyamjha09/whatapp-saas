import { z } from "zod";

export const updateWhatsAppSettingsSchema = z.object({
  wabaId: z.string().trim().min(1, "WABA ID is required"),
  phoneNumberId: z.string().trim().min(1, "Phone Number ID is required"),
  displayPhoneNumber: z
    .string()
    .trim()
    .min(1, "Display phone number is required"),
  accessToken: z.string().trim().min(1, "Access token cannot be empty").optional(),
});

export type UpdateWhatsAppSettingsInput = z.infer<
  typeof updateWhatsAppSettingsSchema
>;
