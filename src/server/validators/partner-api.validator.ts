import { z } from "zod";

export const partnerApiCreateClientSchema = z.object({
  requestedCompanyName: z.string().trim().min(2).max(120),
  requestedOwnerEmail: z.string().trim().email().max(255),
  requestedOwnerName: z.string().trim().max(120).optional().or(z.literal("")),
  requestedPlan: z
    .enum(["FREE", "STARTER", "GROWTH", "BUSINESS", "ENTERPRISE"])
    .default("FREE"),
  requestedPlanDays: z.coerce.number().int().min(1).max(3650).default(14),
  externalClientReference: z.string().trim().max(120).optional().or(z.literal("")),
});

export const partnerApiUpdateClientSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  externalClientReference: z.string().trim().max(120).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export type PartnerApiCreateClientInput = z.infer<
  typeof partnerApiCreateClientSchema
>;
export type PartnerApiUpdateClientInput = z.infer<
  typeof partnerApiUpdateClientSchema
>;
