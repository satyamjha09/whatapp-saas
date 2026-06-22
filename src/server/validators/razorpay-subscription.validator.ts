import { BillingPlan } from "@/generated/prisma/client";
import { z } from "zod";

export const createRazorpaySubscriptionOrderSchema = z.object({
  plan: z.enum(BillingPlan),
});

export const verifyRazorpaySubscriptionPaymentSchema = z.object({
  razorpayOrderId: z.string().trim().min(1),
  razorpayPaymentId: z.string().trim().min(1),
  razorpaySignature: z.string().trim().regex(/^[a-f\d]{64}$/i),
});

export type CreateRazorpaySubscriptionOrderInput = z.infer<
  typeof createRazorpaySubscriptionOrderSchema
>;
export type VerifyRazorpaySubscriptionPaymentInput = z.infer<
  typeof verifyRazorpaySubscriptionPaymentSchema
>;
