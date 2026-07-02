import { z } from "zod";

export const automationTemplateStatusSchema = z.enum([
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "PAUSED",
  "IN_APPEAL",
  "PENDING_DELETION",
  "DELETED",
  "DISABLED",
  "LIMIT_EXCEEDED",
]);

export const automationTemplateCategorySchema = z.enum([
  "MARKETING",
  "UTILITY",
  "AUTHENTICATION",
]);

export const automationTemplateQuerySchema = z.object({
  category: automationTemplateCategorySchema.optional(),
  languageCode: z.string().trim().min(1).max(20).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(120).optional(),
  status: automationTemplateStatusSchema.default("APPROVED"),
});

export const automationTemplateParamsSchema = z.object({
  templateId: z.string().trim().min(1).max(160),
});

export type AutomationTemplateQuery = z.infer<
  typeof automationTemplateQuerySchema
>;
export type AutomationTemplateParams = z.infer<
  typeof automationTemplateParamsSchema
>;
