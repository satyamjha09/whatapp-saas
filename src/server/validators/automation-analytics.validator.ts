import { z } from "zod";

export const automationExecutionStatusSchema = z.enum([
  "RUNNING",
  "SUCCESS",
  "FAILED",
  "WAITING",
  "SKIPPED",
]);

export const automationTriggerTypeSchema = z.enum([
  "KEYWORD",
  "DEFAULT",
  "TEMPLATE_REPLY",
  "BUTTON_REPLY",
  "LIST_REPLY",
  "CAMPAIGN_REPLY",
  "MANUAL",
]);

const optionalDateSchema = z
  .string()
  .trim()
  .optional()
  .superRefine((value, context) => {
    if (!value) return;
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      context.addIssue({
        code: "custom",
        message: "Invalid date",
      });
    }
  })
  .transform((value) => (value ? new Date(value) : undefined));

export const automationExecutionListQuerySchema = z
  .object({
    contactSearch: z.string().trim().max(120).optional(),
    endDate: optionalDateSchema,
    flowId: z.string().trim().max(160).optional(),
    flowVersionId: z.string().trim().max(160).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    startDate: optionalDateSchema,
    status: automationExecutionStatusSchema.optional(),
    triggerType: automationTriggerTypeSchema.optional(),
  })
  .superRefine((input, context) => {
    if (input.startDate && input.endDate && input.startDate > input.endDate) {
      context.addIssue({
        code: "custom",
        message: "startDate must be before endDate",
        path: ["startDate"],
      });
    }
  });

export const automationExecutionDetailParamsSchema = z.object({
  executionId: z.string().trim().min(1).max(160),
});

export const automationAnalyticsRangeSchema = z.enum([
  "24h",
  "7d",
  "30d",
  "90d",
  "custom",
]);

export const automationFlowAnalyticsQuerySchema = z
  .object({
    endDate: optionalDateSchema,
    flowVersionId: z.string().trim().max(160).optional(),
    range: automationAnalyticsRangeSchema.default("30d"),
    startDate: optionalDateSchema,
  })
  .superRefine((input, context) => {
    if (input.range === "custom" && !input.startDate && !input.endDate) {
      context.addIssue({
        code: "custom",
        message: "Custom range requires startDate or endDate",
        path: ["range"],
      });
    }

    if (input.startDate && input.endDate && input.startDate > input.endDate) {
      context.addIssue({
        code: "custom",
        message: "startDate must be before endDate",
        path: ["startDate"],
      });
    }
  });

export type AutomationExecutionListQuery = z.infer<
  typeof automationExecutionListQuerySchema
>;

export type AutomationFlowAnalyticsQuery = z.infer<
  typeof automationFlowAnalyticsQuerySchema
>;
