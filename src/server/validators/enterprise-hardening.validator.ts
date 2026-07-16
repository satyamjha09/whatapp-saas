import { z } from "zod";

export const createPlatformApprovalRequestSchema = z.object({
  type: z.enum([
    "PARTNER_PAYOUT",
    "PARTNER_DOMAIN",
    "PARTNER_OFFBOARDING",
    "PARTNER_CLIENT_TRANSFER",
    "PLATFORM_SETTING",
    "HIGH_RISK_ACTION",
  ]),
  companyId: z.string().cuid().optional(),
  entityType: z.string().trim().min(2).max(80),
  entityId: z.string().trim().min(2).max(120),
  action: z.string().trim().min(2).max(120),
  reason: z.string().trim().min(10).max(2000),
  riskLevel: z.number().int().min(1).max(5).default(3),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const platformApprovalDecisionSchema = z.object({
  decision: z.enum(["approve", "reject", "cancel"]),
  reason: z.string().trim().min(5).max(2000),
});

export const createPartnerOffboardingRunSchema = z.object({
  partnerCompanyId: z.string().cuid(),
  reason: z.string().trim().min(10).max(2000),
  clientPolicy: z
    .enum(["KEEP_WITH_METAWHAT", "TRANSFER_TO_PARTNER", "SUSPEND_CLIENTS"])
    .default("KEEP_WITH_METAWHAT"),
  transferTargets: z.record(z.string(), z.string().cuid()).optional(),
  checklist: z.record(z.string(), z.unknown()).optional(),
});

export const createPartnerClientTransferRequestSchema = z.object({
  fromPartnerCompanyId: z.string().cuid(),
  toPartnerCompanyId: z.string().cuid().optional(),
  clientCompanyId: z.string().cuid(),
  reason: z.string().trim().min(10).max(2000),
  transferMode: z
    .enum(["MOVE_TO_METAWHAT", "MOVE_TO_PARTNER", "DETACH_FROM_PARTNER"])
    .default("MOVE_TO_METAWHAT"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const verifyPartnerDomainChallengeSchema = z.object({
  domainId: z.string().cuid(),
});

export type CreatePlatformApprovalRequestInput = z.infer<
  typeof createPlatformApprovalRequestSchema
>;
export type PlatformApprovalDecisionInput = z.infer<
  typeof platformApprovalDecisionSchema
>;
export type CreatePartnerOffboardingRunInput = z.infer<
  typeof createPartnerOffboardingRunSchema
>;
export type CreatePartnerClientTransferRequestInput = z.infer<
  typeof createPartnerClientTransferRequestSchema
>;
