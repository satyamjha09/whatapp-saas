import { z } from "zod";

export const partnerSupportTicketStatusSchema = z.enum([
  "OPEN",
  "PENDING_PARTNER",
  "PENDING_METAWHAT",
  "RESOLVED",
  "CLOSED",
]);

export const partnerSupportTicketPrioritySchema = z.enum([
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
]);

export const partnerSupportTicketCategorySchema = z.enum([
  "GENERAL",
  "BILLING",
  "TECHNICAL",
  "WHATSAPP",
  "API",
  "CLIENT_ACCESS",
  "FEATURE_REQUEST",
]);

export const partnerSupportCommentVisibilitySchema = z.enum([
  "PARTNER",
  "INTERNAL",
]);

export const createPartnerSupportTicketSchema = z.object({
  clientCompanyId: z.string().trim().min(1).optional().or(z.literal("")),
  subject: z.string().trim().min(4).max(180),
  description: z.string().trim().min(10).max(5000),
  category: partnerSupportTicketCategorySchema.default("GENERAL"),
  priority: partnerSupportTicketPrioritySchema.default("NORMAL"),
});

export const updatePartnerSupportTicketSchema = z.object({
  status: partnerSupportTicketStatusSchema.optional(),
  priority: partnerSupportTicketPrioritySchema.optional(),
  assignedPlatformUserId: z.string().trim().min(1).optional().nullable(),
  csatScore: z.coerce.number().int().min(1).max(5).optional(),
  csatComment: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const createPartnerSupportCommentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  visibility: partnerSupportCommentVisibilitySchema.default("PARTNER"),
});

export type CreatePartnerSupportTicketInput = z.infer<
  typeof createPartnerSupportTicketSchema
>;
export type UpdatePartnerSupportTicketInput = z.infer<
  typeof updatePartnerSupportTicketSchema
>;
export type CreatePartnerSupportCommentInput = z.infer<
  typeof createPartnerSupportCommentSchema
>;
