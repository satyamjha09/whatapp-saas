import { z } from "zod";
import {
  META_NUMERIC_ID_PATTERN,
  NUMERIC_PHONE_NUMBER_ID_MESSAGE,
  NUMERIC_WABA_ID_MESSAGE,
} from "@/server/whatsapp/meta-ids";

export const createWhatsAppAccountSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(2, "Business name must be at least 2 characters")
    .max(100, "Business name must be less than 100 characters"),
});

export type CreateWhatsAppAccountInput = z.infer<
  typeof createWhatsAppAccountSchema
>;

export const saveWhatsAppCredentialsSchema = z.object({
  wabaId: z
    .string()
    .trim()
    .min(1, "WABA ID is required")
    .regex(META_NUMERIC_ID_PATTERN, NUMERIC_WABA_ID_MESSAGE),

  phoneNumberId: z
    .string()
    .trim()
    .min(1, "Phone number ID is required")
    .regex(META_NUMERIC_ID_PATTERN, NUMERIC_PHONE_NUMBER_ID_MESSAGE),

  displayPhoneNumber: z
    .string()
    .trim()
    .min(5, "Display phone number is required"),

  verifiedName: z.string().trim().min(2, "Verified name is required"),

  accessToken: z.string().trim().min(1, "Access token is required"),
});

export type SaveWhatsAppCredentialsInput = z.infer<
  typeof saveWhatsAppCredentialsSchema
>;
