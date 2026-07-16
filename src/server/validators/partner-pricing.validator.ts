import { z } from "zod";

const billingPlanSchema = z.enum([
  "FREE",
  "STARTER",
  "GROWTH",
  "BUSINESS",
  "ENTERPRISE",
]);

const subscriptionStatusSchema = z.enum([
  "ACTIVE",
  "TRIALING",
  "PAST_DUE",
  "CANCELED",
  "SUSPENDED",
  "EXPIRED",
]);

const paiseSchema = z
  .number()
  .int()
  .min(0)
  .max(100_00_00_000, "Amount is too large");

const optionalPaiseSchema = paiseSchema.optional().nullable();

const optionalDateStringSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .refine((value) => !value || !Number.isNaN(new Date(value).getTime()), {
    message: "Invalid date",
  });

export const partnerPriceBookSchema = z.object({
  priceBookId: z.string().trim().min(1).optional(),
  partnerCompanyId: z.string().trim().min(1, "Partner company is required"),
  name: z.string().trim().min(2, "Price book name is required").max(120),
  currency: z
    .string()
    .trim()
    .min(3)
    .max(3)
    .regex(/^[A-Za-z]{3}$/, "Currency must be a 3-letter code")
    .optional(),
  active: z.boolean().optional(),
});

export const partnerPriceBookItemSchema = z
  .object({
    platformPlanCode: billingPlanSchema,
    wholesaleMonthlyPaise: paiseSchema,
    minimumRetailPaise: paiseSchema,
    suggestedRetailPaise: optionalPaiseSchema,
    includedMessages: z.number().int().min(0).optional().nullable(),
    extraMessagePaise: optionalPaiseSchema,
    active: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.suggestedRetailPaise !== undefined &&
      value.suggestedRetailPaise !== null &&
      value.suggestedRetailPaise < value.minimumRetailPaise
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["suggestedRetailPaise"],
        message: "Suggested retail must be at or above the retail floor",
      });
    }
  });

export const assignPartnerClientSubscriptionSchema = z
  .object({
    clientCompanyId: z.string().trim().min(1, "Client company is required"),
    priceBookItemId: z.string().trim().min(1, "Price book item is required"),
    retailAmountPaise: optionalPaiseSchema,
    billingDays: z.number().int().min(1).max(730).optional(),
    startsAt: optionalDateStringSchema,
    currentPeriodEnd: optionalDateStringSchema,
    status: subscriptionStatusSchema.optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.startsAt && value.currentPeriodEnd) {
      const startsAt = new Date(value.startsAt);
      const currentPeriodEnd = new Date(value.currentPeriodEnd);

      if (currentPeriodEnd <= startsAt) {
        ctx.addIssue({
          code: "custom",
          path: ["currentPeriodEnd"],
          message: "Current period end must be after start date",
        });
      }
    }
  });

export const cancelPartnerClientSubscriptionSchema = z.object({
  subscriptionId: z.string().trim().min(1),
  cancellationNote: z.string().trim().max(500).optional().nullable(),
});

export type PartnerPriceBookInput = z.infer<typeof partnerPriceBookSchema>;
export type PartnerPriceBookItemInput = z.infer<
  typeof partnerPriceBookItemSchema
>;
export type AssignPartnerClientSubscriptionInput = z.infer<
  typeof assignPartnerClientSubscriptionSchema
>;
export type CancelPartnerClientSubscriptionInput = z.infer<
  typeof cancelPartnerClientSubscriptionSchema
>;
