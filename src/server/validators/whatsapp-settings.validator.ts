import { z } from "zod";
import {
  META_NUMERIC_ID_PATTERN,
  NUMERIC_PHONE_NUMBER_ID_MESSAGE,
  NUMERIC_WABA_ID_MESSAGE,
} from "@/server/whatsapp/meta-ids";

export const updateWhatsAppSettingsSchema = z.object({
  wabaId: z
    .string()
    .trim()
    .min(1, "WABA ID is required")
    .regex(META_NUMERIC_ID_PATTERN, NUMERIC_WABA_ID_MESSAGE),
  phoneNumberId: z
    .string()
    .trim()
    .min(1, "Phone Number ID is required")
    .regex(META_NUMERIC_ID_PATTERN, NUMERIC_PHONE_NUMBER_ID_MESSAGE),
  displayPhoneNumber: z.string().trim().optional().default(""),
  accessToken: z.string().trim().min(1, "Access token cannot be empty").optional(),
});

export type UpdateWhatsAppSettingsInput = z.infer<
  typeof updateWhatsAppSettingsSchema
>;
