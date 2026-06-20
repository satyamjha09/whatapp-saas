import { z } from "zod";

export const metaBusinessVerificationStatuses = [
  "NOT_STARTED",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
] as const;

export const updateProductionChecklistSettingsSchema = z.object({
  metaPaymentMethodAdded: z.boolean(),
  metaBusinessVerificationStatus: z.enum(
    metaBusinessVerificationStatuses,
  ),
  productionChecklistNotes: z.string().trim().max(1000).optional(),
});

export type UpdateProductionChecklistSettingsInput = z.infer<
  typeof updateProductionChecklistSettingsSchema
>;
