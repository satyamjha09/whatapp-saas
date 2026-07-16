import { z } from "zod";

export const partnerClientProvisioningSchema = z.object({
  partnerCompanyId: z.string().trim().min(1, "Partner company is required"),
  requestedCompanyName: z
    .string()
    .trim()
    .min(2, "Client company name is required")
    .max(120, "Client company name is too long"),
  requestedOwnerEmail: z
    .string()
    .trim()
    .email("Enter a valid owner email")
    .max(255, "Owner email is too long"),
  requestedOwnerName: z
    .string()
    .trim()
    .max(120, "Owner name is too long")
    .optional()
    .or(z.literal("")),
  requestedPlan: z
    .enum(["FREE", "STARTER", "GROWTH", "BUSINESS", "ENTERPRISE"])
    .default("FREE"),
  requestedPlanDays: z.coerce.number().int().min(1).max(3650).default(14),
  externalClientReference: z
    .string()
    .trim()
    .max(120, "External reference is too long")
    .optional()
    .or(z.literal("")),
  idempotencyKey: z
    .string()
    .trim()
    .max(160, "Idempotency key is too long")
    .optional()
    .or(z.literal("")),
});

export type PartnerClientProvisioningInput = z.infer<
  typeof partnerClientProvisioningSchema
>;
