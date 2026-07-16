import { z } from "zod";

const cuidSchema = z.string().cuid();

export const createPartnerCommissionRuleSchema = z
  .object({
    partnerCompanyId: cuidSchema,
    planCode: z
      .enum(["FREE", "STARTER", "GROWTH", "BUSINESS", "ENTERPRISE"])
      .optional(),
    percentageBps: z.coerce.number().int().min(0).max(10_000).optional(),
    fixedAmountPaise: z.coerce.number().int().min(0).optional(),
    holdDays: z.coerce.number().int().min(0).max(365).default(14),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
  })
  .refine(
    (input) =>
      (input.percentageBps ?? 0) > 0 || (input.fixedAmountPaise ?? 0) > 0,
    {
      message: "A commission rule needs a percentage or a fixed amount.",
      path: ["percentageBps"],
    },
  )
  .refine(
    (input) =>
      !input.endsAt ||
      !input.startsAt ||
      input.endsAt.getTime() > input.startsAt.getTime(),
    {
      message: "End date must be after start date.",
      path: ["endsAt"],
    },
  );

export const accruePartnerCommissionSchema = z.object({
  partnerBillingInvoiceId: cuidSchema,
});

export const reversePartnerCommissionSchema = z.object({
  accrualId: cuidSchema,
  reason: z.string().trim().min(3).max(500),
});

export const markPartnerCommissionsAvailableSchema = z.object({
  asOf: z.coerce.date().optional(),
});

export const requestPartnerPayoutSchema = z.object({
  partnerCompanyId: cuidSchema,
  amountPaise: z.coerce.number().int().positive(),
  notes: z.string().trim().max(500).optional(),
});

export const approvePartnerPayoutSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export const updatePartnerPayoutPaymentSchema = z.object({
  status: z.enum(["PAID", "FAILED", "CANCELED"]),
  bankReference: z.string().trim().max(160).optional(),
  failureReason: z.string().trim().max(500).optional(),
  note: z.string().trim().max(500).optional(),
});

export type CreatePartnerCommissionRuleInput = z.infer<
  typeof createPartnerCommissionRuleSchema
>;
export type AccruePartnerCommissionInput = z.infer<
  typeof accruePartnerCommissionSchema
>;
export type ReversePartnerCommissionInput = z.infer<
  typeof reversePartnerCommissionSchema
>;
export type MarkPartnerCommissionsAvailableInput = z.infer<
  typeof markPartnerCommissionsAvailableSchema
>;
export type RequestPartnerPayoutInput = z.infer<
  typeof requestPartnerPayoutSchema
>;
export type ApprovePartnerPayoutInput = z.infer<
  typeof approvePartnerPayoutSchema
>;
export type UpdatePartnerPayoutPaymentInput = z.infer<
  typeof updatePartnerPayoutPaymentSchema
>;
