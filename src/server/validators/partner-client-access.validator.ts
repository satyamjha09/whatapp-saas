import { z } from "zod";

export const partnerClientAccessPermissionSchema = z.enum([
  "CLIENT_VIEW",
  "CLIENT_SUPPORT",
  "CLIENT_BILLING_VIEW",
  "CLIENT_BILLING_MANAGE",
  "CLIENT_TEAM_MANAGE",
  "CLIENT_WHATSAPP_MANAGE",
  "CLIENT_CAMPAIGN_MANAGE",
  "CLIENT_SETTINGS_MANAGE",
]);

export const grantPartnerClientAccessSchema = z.object({
  partnerCompanyId: z.string().min(1),
  clientCompanyId: z.string().min(1),
  userId: z.string().min(1),
  permissions: z
    .array(partnerClientAccessPermissionSchema)
    .min(1)
    .default(["CLIENT_VIEW", "CLIENT_SUPPORT"]),
  expiresAt: z.string().datetime().optional().nullable(),
});

export const startPartnerClientAccessSessionSchema = z.object({
  clientCompanyId: z.string().min(1),
  reason: z.string().trim().max(500).optional().nullable(),
});

export const revokePartnerClientAccessSchema = z.object({
  grantId: z.string().min(1),
});

export type GrantPartnerClientAccessInput = z.infer<
  typeof grantPartnerClientAccessSchema
>;
export type StartPartnerClientAccessSessionInput = z.infer<
  typeof startPartnerClientAccessSessionSchema
>;
