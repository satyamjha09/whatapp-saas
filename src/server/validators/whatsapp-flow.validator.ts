import { z } from "zod";

export const whatsAppFlowUseCaseSchema = z.enum([
  "LEAD_CAPTURE",
  "APPOINTMENT_BOOKING",
  "FEEDBACK_SURVEY",
  "PAYMENT_COLLECTION",
  "CUSTOMER_SUPPORT",
  "KYC",
  "ORDER_ENQUIRY",
  "CUSTOM",
]);

export const whatsAppFlowStatusSchema = z.enum([
  "DRAFT",
  "PUBLISHED",
  "DEPRECATED",
  "DISABLED",
]);

export const createWhatsAppFlowSchema = z.object({
  dataApiEndpoint: z.string().trim().url().optional().nullable(),
  defaultCta: z.string().trim().min(1).max(30).default("Open form"),
  defaultScreen: z.string().trim().max(120).optional().nullable(),
  description: z.string().trim().max(1024).optional().nullable(),
  metaFlowId: z.string().trim().min(1).max(200),
  name: z.string().trim().min(2).max(120),
  schema: z.unknown().optional().nullable(),
  status: whatsAppFlowStatusSchema.default("PUBLISHED"),
  useCase: whatsAppFlowUseCaseSchema.default("CUSTOM"),
});

export const updateWhatsAppFlowSchema = createWhatsAppFlowSchema.partial();

export const sendTestWhatsAppFlowSchema = z.object({
  countryCode: z.string().trim().min(1).max(5).default("91"),
  phoneNumber: z.string().trim().min(6).max(20),
});

export type CreateWhatsAppFlowInput = z.infer<
  typeof createWhatsAppFlowSchema
>;

export type UpdateWhatsAppFlowInput = z.infer<
  typeof updateWhatsAppFlowSchema
>;

export type SendTestWhatsAppFlowInput = z.infer<
  typeof sendTestWhatsAppFlowSchema
>;
