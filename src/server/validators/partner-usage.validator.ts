import { z } from "zod";

export const partnerUsageQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  partnerCompanyId: z.string().trim().min(1).optional(),
  format: z.enum(["json", "csv"]).optional(),
});

export const aggregatePartnerUsageSchema = z.object({
  action: z.literal("aggregate"),
  date: z.string().optional(),
  partnerCompanyId: z.string().trim().min(1).optional(),
});
