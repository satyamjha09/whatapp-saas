import { BillingPlan } from "@/generated/prisma/client";
import { z } from "zod";

export const createCashfreeSubscriptionOrderSchema = z.object({
  plan: z.enum(BillingPlan),
});

export const verifyCashfreeSubscriptionPaymentSchema = z.object({
  cashfreeOrderId: z.string().trim().min(1),
});

export type CreateCashfreeSubscriptionOrderInput = z.infer<
  typeof createCashfreeSubscriptionOrderSchema
>;
export type VerifyCashfreeSubscriptionPaymentInput = z.infer<
  typeof verifyCashfreeSubscriptionPaymentSchema
>;
