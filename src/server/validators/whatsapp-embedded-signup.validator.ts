import { z } from "zod";

const optionalMetaIdSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "Meta ID must contain only digits")
  .optional()
  .nullable()
  .transform((value) => value || null);

export const completeWhatsAppEmbeddedSignupSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Authorization code is required")
    .max(4096, "Authorization code is invalid"),
  flowSessionId: z
    .string()
    .trim()
    .max(128, "Flow session ID is invalid")
    .optional()
    .nullable()
    .transform((value) => value || null),
  wabaId: optionalMetaIdSchema,
  phoneNumberId: optionalMetaIdSchema,
  redirectUri: z
    .string()
    .trim()
    .url("Redirect URI is invalid")
    .max(8192, "Redirect URI is too long")
    .optional()
    .nullable()
    .transform((value) => value || null),
});

export type CompleteWhatsAppEmbeddedSignupInput = z.infer<
  typeof completeWhatsAppEmbeddedSignupSchema
>;

export const saveWhatsAppEmbeddedSignupEventSchema = z.object({
  flowSessionId: z
    .string()
    .trim()
    .max(128, "Flow session ID is invalid")
    .optional()
    .nullable()
    .transform((value) => value || null),
  eventType: z
    .string()
    .trim()
    .min(1, "Event type is required")
    .max(80, "Event type is too long"),
  currentStep: z
    .string()
    .trim()
    .max(120, "Current step is too long")
    .optional()
    .nullable()
    .transform((value) => value || null),
  wabaId: optionalMetaIdSchema,
  phoneNumberId: optionalMetaIdSchema,
  payload: z.unknown().optional(),
});

export type SaveWhatsAppEmbeddedSignupEventInput = z.infer<
  typeof saveWhatsAppEmbeddedSignupEventSchema
>;
