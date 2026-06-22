import { BillingPlan } from "@/generated/prisma/client";
import { z } from "zod";

export const changeSubscriptionPlanSchema = z.object({
  plan: z.enum(BillingPlan),
});

export type ChangeSubscriptionPlanInput = z.infer<
  typeof changeSubscriptionPlanSchema
>;
