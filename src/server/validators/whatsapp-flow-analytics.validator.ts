import { z } from "zod";

const MAX_CUSTOM_RANGE_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDateInput(value: unknown, endOfDay: boolean) {
  if (typeof value !== "string" || !value.trim()) return undefined;

  const trimmed = value.trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`)
    : new Date(trimmed);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

export const whatsAppFlowAnalyticsQuerySchema = z
  .object({
    endDate: z
      .preprocess((value) => parseDateInput(value, true), z.date().optional()),
    flowAssetId: z.string().trim().optional(),
    range: z.enum(["7d", "30d", "90d", "custom"]).default("30d"),
    source: z.enum(["ALL", "MANUAL", "AUTOMATION"]).default("ALL"),
    startDate: z
      .preprocess((value) => parseDateInput(value, false), z.date().optional()),
    templateId: z.string().trim().optional(),
  })
  .superRefine((value, context) => {
    if (value.range !== "custom") return;

    if (!value.startDate || !value.endDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Custom analytics range requires start and end dates.",
        path: ["startDate"],
      });
      return;
    }

    if (value.startDate > value.endDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Start date must be before end date.",
        path: ["startDate"],
      });
      return;
    }

    const rangeDays =
      (value.endDate.getTime() - value.startDate.getTime()) / DAY_MS;

    if (rangeDays > MAX_CUSTOM_RANGE_DAYS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Custom analytics range cannot exceed ${MAX_CUSTOM_RANGE_DAYS} days.`,
        path: ["endDate"],
      });
    }
  });

export type WhatsAppFlowAnalyticsQuery = z.infer<
  typeof whatsAppFlowAnalyticsQuerySchema
>;
