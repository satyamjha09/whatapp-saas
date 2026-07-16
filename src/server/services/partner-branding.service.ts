import {
  CompanyType,
  PartnerBrandingStatus,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_BRAND_CONTEXT,
  type BrandContext,
} from "@/server/branding/brand-context";
import { resolvePartnerCustomDomainByHost } from "@/server/services/partner-custom-domain.service";
import { createPlatformAuditLog } from "@/server/services/platform-audit.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";
import type {
  PartnerBrandingApprovalInput,
  PartnerBrandingDraftInput,
} from "@/server/validators/partner-branding.validator";

export class PartnerBrandingError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PartnerBrandingError";
    this.status = status;
  }
}

function nullable(value?: string | null) {
  const text = value?.trim();
  return text ? text : null;
}

function brandFromRecord(
  record: Awaited<ReturnType<typeof getApprovedPartnerBrandingByCompanyId>>,
): BrandContext {
  if (!record) return DEFAULT_BRAND_CONTEXT;

  return {
    source: "partner",
    partnerCompanyId: record.partnerCompanyId,
    appName: record.appName,
    companyName: record.companyName ?? record.appName,
    logoUrl: record.logoUrl ?? DEFAULT_BRAND_CONTEXT.logoUrl,
    logoDarkUrl:
      record.logoDarkUrl ?? record.logoUrl ?? DEFAULT_BRAND_CONTEXT.logoDarkUrl,
    markUrl: record.markUrl ?? record.logoUrl ?? DEFAULT_BRAND_CONTEXT.markUrl,
    faviconUrl:
      record.faviconUrl ?? record.markUrl ?? DEFAULT_BRAND_CONTEXT.faviconUrl,
    primaryColor: record.primaryColor ?? DEFAULT_BRAND_CONTEXT.primaryColor,
    secondaryColor:
      record.secondaryColor ?? DEFAULT_BRAND_CONTEXT.secondaryColor,
    accentColor: record.accentColor ?? DEFAULT_BRAND_CONTEXT.accentColor,
    backgroundColor:
      record.backgroundColor ?? DEFAULT_BRAND_CONTEXT.backgroundColor,
    textColor: record.textColor ?? DEFAULT_BRAND_CONTEXT.textColor,
    supportName: record.supportName ?? `${record.appName} Support`,
    supportEmail: record.supportEmail,
    supportPhone: record.supportPhone,
    loginHeading: record.loginHeading ?? DEFAULT_BRAND_CONTEXT.loginHeading,
    loginDescription:
      record.loginDescription ?? DEFAULT_BRAND_CONTEXT.loginDescription,
    hideMetaWhatBranding: record.hideMetaWhatBranding,
  };
}

export function brandSnapshotForBilling(brand: BrandContext) {
  return {
    source: brand.source,
    partnerCompanyId: brand.partnerCompanyId,
    appName: brand.appName,
    companyName: brand.companyName,
    logoUrl: brand.logoUrl,
    markUrl: brand.markUrl,
    primaryColor: brand.primaryColor,
    secondaryColor: brand.secondaryColor,
    supportName: brand.supportName,
    supportEmail: brand.supportEmail,
    supportPhone: brand.supportPhone,
    hideMetaWhatBranding: brand.hideMetaWhatBranding,
  };
}

async function getApprovedPartnerBrandingByCompanyId(partnerCompanyId: string) {
  return prisma.partnerBranding.findFirst({
    where: {
      partnerCompanyId,
      status: PartnerBrandingStatus.APPROVED,
    },
  });
}

export async function resolveBrandContext(companyId?: string | null) {
  if (!companyId) return DEFAULT_BRAND_CONTEXT;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      type: true,
      parentCompanyId: true,
    },
  });

  if (!company) return DEFAULT_BRAND_CONTEXT;

  const partnerCompanyId =
    company.type === CompanyType.PARTNER
      ? company.id
      : company.type === CompanyType.PARTNER_CLIENT
        ? company.parentCompanyId
        : null;

  if (!partnerCompanyId) return DEFAULT_BRAND_CONTEXT;

  return brandFromRecord(
    await getApprovedPartnerBrandingByCompanyId(partnerCompanyId),
  );
}

export async function resolveBrandContextForHost(host?: string | null) {
  if (!host) return DEFAULT_BRAND_CONTEXT;

  const domain = await resolvePartnerCustomDomainByHost(host);
  if (!domain) return DEFAULT_BRAND_CONTEXT;

  return brandFromRecord(
    await getApprovedPartnerBrandingByCompanyId(domain.partnerCompanyId),
  );
}

export async function listPartnerBrandingRecords() {
  return prisma.company.findMany({
    where: {
      type: CompanyType.PARTNER,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      status: true,
      childCompanies: {
        select: { id: true },
      },
      partnerBranding: {
        include: {
          approvedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });
}

export async function getPartnerBrandingDraft(partnerCompanyId: string) {
  const partner = await prisma.company.findUnique({
    where: { id: partnerCompanyId },
    select: { id: true, name: true, type: true, partnerBranding: true },
  });

  if (!partner || partner.type !== CompanyType.PARTNER) {
    throw new PartnerBrandingError("Partner company not found.", 404);
  }

  return {
    partner,
    branding:
      partner.partnerBranding ??
      ({
        partnerCompanyId,
        appName: partner.name,
        companyName: partner.name,
        status: PartnerBrandingStatus.DRAFT,
        hideMetaWhatBranding: false,
      } as const),
  };
}

export async function upsertPartnerBrandingDraft({
  actorUserId,
  actorEmail,
  input,
}: {
  actorUserId?: string | null;
  actorEmail?: string | null;
  input: PartnerBrandingDraftInput;
}) {
  const partner = await prisma.company.findUnique({
    where: { id: input.partnerCompanyId },
    select: { id: true, type: true },
  });

  if (!partner || partner.type !== CompanyType.PARTNER) {
    throw new PartnerBrandingError("Partner company not found.", 404);
  }

  const data = {
    appName: input.appName.trim(),
    companyName: nullable(input.companyName),
    logoUrl: nullable(input.logoUrl),
    logoDarkUrl: nullable(input.logoDarkUrl),
    markUrl: nullable(input.markUrl),
    faviconUrl: nullable(input.faviconUrl),
    primaryColor: nullable(input.primaryColor),
    secondaryColor: nullable(input.secondaryColor),
    accentColor: nullable(input.accentColor),
    backgroundColor: nullable(input.backgroundColor),
    textColor: nullable(input.textColor),
    supportName: nullable(input.supportName),
    supportEmail: nullable(input.supportEmail),
    supportPhone: nullable(input.supportPhone),
    loginHeading: nullable(input.loginHeading),
    loginDescription: nullable(input.loginDescription),
    hideMetaWhatBranding: input.hideMetaWhatBranding,
    status: PartnerBrandingStatus.DRAFT,
    rejectionReason: null,
    disabledAt: null,
    metadata: redactSensitiveData({
      source: "partner-branding-draft",
    }) as Prisma.InputJsonValue,
  };

  const branding = await prisma.partnerBranding.upsert({
    where: { partnerCompanyId: input.partnerCompanyId },
    update: data,
    create: {
      partnerCompanyId: input.partnerCompanyId,
      ...data,
    },
  });

  await createPlatformAuditLog({
    actorUserId,
    actorEmail,
    action: "partner_branding.draft_saved",
    entityType: "PartnerBranding",
    entityId: branding.id,
    metadata: {
      partnerCompanyId: input.partnerCompanyId,
      status: branding.status,
    },
  }).catch(() => undefined);

  return branding;
}

export async function transitionPartnerBranding({
  actorUserId,
  actorEmail,
  input,
}: {
  actorUserId?: string | null;
  actorEmail?: string | null;
  input: PartnerBrandingApprovalInput;
}) {
  const existing = await prisma.partnerBranding.findUnique({
    where: { partnerCompanyId: input.partnerCompanyId },
  });

  if (!existing) {
    throw new PartnerBrandingError("Branding draft not found.", 404);
  }

  const now = new Date();
  const data: Prisma.PartnerBrandingUpdateInput =
    input.action === "submit"
      ? {
          status: PartnerBrandingStatus.PENDING_REVIEW,
          submittedAt: now,
          rejectionReason: null,
        }
      : input.action === "approve"
        ? {
            status: PartnerBrandingStatus.APPROVED,
            approvedAt: now,
            ...(actorUserId
              ? { approvedBy: { connect: { id: actorUserId } } }
              : {}),
            rejectionReason: null,
            disabledAt: null,
          }
        : input.action === "reject"
          ? {
              status: PartnerBrandingStatus.REJECTED,
              rejectionReason: input.rejectionReason ?? "Rejected by platform admin.",
            }
          : {
              status: PartnerBrandingStatus.DISABLED,
              disabledAt: now,
            };

  const branding = await prisma.partnerBranding.update({
    where: { id: existing.id },
    data,
  });

  await createPlatformAuditLog({
    actorUserId,
    actorEmail,
    action: `partner_branding.${input.action}`,
    entityType: "PartnerBranding",
    entityId: branding.id,
    metadata: {
      partnerCompanyId: input.partnerCompanyId,
      status: branding.status,
      rejectionReason: input.rejectionReason,
    },
  }).catch(() => undefined);

  return branding;
}
