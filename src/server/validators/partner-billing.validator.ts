import { z } from "zod";

const dateStringSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "Invalid date",
  });

const optionalDateStringSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), {
    message: "Invalid date",
  });

export const generatePartnerBillingInvoiceSchema = z
  .object({
    subscriptionId: z.string().trim().min(1, "Subscription is required"),
    periodStart: optionalDateStringSchema,
    periodEnd: optionalDateStringSchema,
    dueAt: optionalDateStringSchema,
    issueImmediately: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.periodStart && value.periodEnd) {
      const start = new Date(value.periodStart);
      const end = new Date(value.periodEnd);

      if (end <= start) {
        ctx.addIssue({
          code: "custom",
          path: ["periodEnd"],
          message: "Period end must be after period start",
        });
      }
    }
  });

export const updatePartnerBillingPaymentSchema = z.object({
  paymentStatus: z.enum(["PAID", "FAILED", "CANCELED"]),
  paymentProvider: z.string().trim().max(80).optional().nullable(),
  paymentReference: z.string().trim().max(160).optional().nullable(),
  paymentUrl: z.string().trim().url().optional().nullable(),
  paidAt: optionalDateStringSchema,
  note: z.string().trim().max(500).optional().nullable(),
});

export const updatePartnerBillingOwnerSchema = z.object({
  billingOwnerType: z.enum(["SELF", "PARENT_PARTNER"]),
  note: z.string().trim().max(500).optional().nullable(),
});

export const markPartnerBillingOverdueSchema = z.object({
  asOf: dateStringSchema.optional(),
});

export type GeneratePartnerBillingInvoiceInput = z.infer<
  typeof generatePartnerBillingInvoiceSchema
>;
export type UpdatePartnerBillingPaymentInput = z.infer<
  typeof updatePartnerBillingPaymentSchema
>;
export type UpdatePartnerBillingOwnerInput = z.infer<
  typeof updatePartnerBillingOwnerSchema
>;
export type MarkPartnerBillingOverdueInput = z.infer<
  typeof markPartnerBillingOverdueSchema
>;
