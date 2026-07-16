import { promises as dns } from "node:dns";
import {
  CompanyType,
  PartnerEmailBrandingStatus,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  brandSnapshotForBilling,
  resolveBrandContext,
} from "@/server/services/partner-branding.service";
import { createPlatformAuditLog } from "@/server/services/platform-audit.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";
import type {
  PartnerEmailBrandingActionInput,
  PartnerEmailBrandingDraftInput,
} from "@/server/validators/partner-email-branding.validator";

export class PartnerEmailBrandingError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PartnerEmailBrandingError";
    this.status = status;
  }
}

function nullable(value?: string | null) {
  const text = value?.trim();
  return text ? text : null;
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function defaultFromEmail() {
  const from = process.env.SMTP_FROM || "MetaWhat <no-reply@metawhat.in>";
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] ?? from).trim();
}

function defaultFromName() {
  const from = process.env.SMTP_FROM || "MetaWhat <no-reply@metawhat.in>";
  const match = from.match(/^(.+?)\s*</);
  return (match?.[1] ?? "MetaWhat").trim().replace(/^"|"$/g, "");
}

function formatAddress({ email, name }: { email: string; name?: string | null }) {
  const safeName = name?.trim();
  return safeName ? `${safeName} <${email}>` : email;
}

function domainFromEmail(email?: string | null) {
  return email?.split("@")[1]?.toLowerCase() ?? null;
}

function expectedSpfValue() {
  return (
    process.env.WHITE_LABEL_EMAIL_SPF_VALUE ||
    "v=spf1 include:metawhat.in ~all"
  );
}

function expectedDkimValue() {
  return (
    process.env.WHITE_LABEL_EMAIL_DKIM_VALUE ||
    "metawhat-domain-key=provider-pending"
  );
}

function expectedDmarcValue() {
  return (
    process.env.WHITE_LABEL_EMAIL_DMARC_VALUE ||
    "v=DMARC1; p=none; rua=mailto:postmaster@metawhat.in"
  );
}

function buildDnsRecords(domain?: string | null) {
  if (!domain) {
    return {
      spfHost: null,
      spfValue: null,
      dkimHost: null,
      dkimValue: null,
      dmarcHost: null,
      dmarcValue: null,
    };
  }

  return {
    spfHost: domain,
    spfValue: expectedSpfValue(),
    dkimHost: `mw._domainkey.${domain}`,
    dkimValue: expectedDkimValue(),
    dmarcHost: `_dmarc.${domain}`,
    dmarcValue: expectedDmarcValue(),
  };
}

async function resolveTxtValues(host?: string | null) {
  if (!host) return [];

  try {
    const records = await dns.resolveTxt(host);
    return records.map((record) => record.join(""));
  } catch {
    return [];
  }
}

async function assertPartnerCompany(partnerCompanyId: string) {
  const partner = await prisma.company.findUnique({
    where: { id: partnerCompanyId },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      supportEmail: true,
    },
  });

  if (!partner || partner.type !== CompanyType.PARTNER) {
    throw new PartnerEmailBrandingError("Partner company not found.", 404);
  }

  return partner;
}

async function resolvePartnerCompanyId(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      type: true,
      parentCompanyId: true,
    },
  });

  if (!company) return null;

  if (company.type === CompanyType.PARTNER) return company.id;
  if (company.type === CompanyType.PARTNER_CLIENT) return company.parentCompanyId;

  return null;
}

export async function getPartnerEmailBrandingDraft(partnerCompanyId: string) {
  const partner = await assertPartnerCompany(partnerCompanyId);
  const existing = await prisma.partnerEmailBranding.findUnique({
    where: { partnerCompanyId: partner.id },
  });

  if (existing) {
    return {
      partner,
      emailBranding: existing,
    };
  }

  const domain = domainFromEmail(partner.supportEmail);
  const records = buildDnsRecords(domain);
  const emailBranding = await prisma.partnerEmailBranding.create({
    data: {
      partnerCompanyId: partner.id,
      fromName: partner.name,
      fromAddress: partner.supportEmail,
      replyTo: partner.supportEmail,
      sendingDomain: domain,
      ...records,
      metadata: safeJson({ createdFromPartnerSupportEmail: Boolean(domain) }),
    },
  });

  return {
    partner,
    emailBranding,
  };
}

export async function listPartnerEmailBrandingRecords() {
  return prisma.company.findMany({
    where: { type: CompanyType.PARTNER },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      status: true,
      childCompanies: {
        select: { id: true },
      },
      partnerEmailBranding: true,
    },
  });
}

export async function upsertPartnerEmailBrandingDraft({
  actorEmail,
  actorUserId,
  input,
}: {
  actorUserId?: string | null;
  actorEmail?: string | null;
  input: PartnerEmailBrandingDraftInput & { partnerCompanyId: string };
}) {
  const partner = await assertPartnerCompany(input.partnerCompanyId);
  const fromDomain = domainFromEmail(input.fromAddress);
  const sendingDomain = input.sendingDomain ?? fromDomain;

  if (input.fromAddress && sendingDomain && fromDomain !== sendingDomain) {
    throw new PartnerEmailBrandingError(
      "From address must belong to the verified sending domain.",
    );
  }

  const records = buildDnsRecords(sendingDomain);
  const emailBranding = await prisma.partnerEmailBranding.upsert({
    where: { partnerCompanyId: partner.id },
    create: {
      partnerCompanyId: partner.id,
      fromName: nullable(input.fromName) ?? partner.name,
      fromAddress: nullable(input.fromAddress),
      replyTo: nullable(input.replyTo),
      sendingDomain: nullable(sendingDomain),
      footerText: nullable(input.footerText),
      logoUrl: nullable(input.logoUrl),
      ...records,
    },
    update: {
      fromName: nullable(input.fromName) ?? partner.name,
      fromAddress: nullable(input.fromAddress),
      replyTo: nullable(input.replyTo),
      sendingDomain: nullable(sendingDomain),
      footerText: nullable(input.footerText),
      logoUrl: nullable(input.logoUrl),
      ...records,
      status: PartnerEmailBrandingStatus.DRAFT,
      verifiedAt: null,
      failureReason: null,
      spfVerified: false,
      dkimVerified: false,
      dmarcVerified: false,
    },
  });

  await createPlatformAuditLog({
    actorUserId,
    actorEmail,
    action: "partner_email_branding.saved",
    entityType: "PartnerEmailBranding",
    entityId: emailBranding.id,
    metadata: {
      partnerCompanyId: partner.id,
      sendingDomain: emailBranding.sendingDomain,
      fromAddress: emailBranding.fromAddress,
    },
  }).catch(() => undefined);

  return emailBranding;
}

export async function checkPartnerEmailBrandingDns({
  actorEmail,
  actorUserId,
  partnerCompanyId,
}: {
  actorUserId?: string | null;
  actorEmail?: string | null;
  partnerCompanyId: string;
}) {
  await assertPartnerCompany(partnerCompanyId);
  const existing = await prisma.partnerEmailBranding.findUnique({
    where: { partnerCompanyId },
  });

  if (!existing) {
    throw new PartnerEmailBrandingError("Email branding is not configured.", 404);
  }

  if (!existing.sendingDomain) {
    throw new PartnerEmailBrandingError("Sender domain is required.");
  }

  const [spfValues, dkimValues, dmarcValues] = await Promise.all([
    resolveTxtValues(existing.spfHost),
    resolveTxtValues(existing.dkimHost),
    resolveTxtValues(existing.dmarcHost),
  ]);

  const spfVerified = existing.spfValue
    ? spfValues.includes(existing.spfValue)
    : false;
  const dkimVerified = existing.dkimValue
    ? dkimValues.includes(existing.dkimValue)
    : false;
  const dmarcVerified = existing.dmarcValue
    ? dmarcValues.includes(existing.dmarcValue)
    : false;
  const verified = spfVerified && dkimVerified && dmarcVerified;

  const emailBranding = await prisma.partnerEmailBranding.update({
    where: { id: existing.id },
    data: {
      spfVerified,
      dkimVerified,
      dmarcVerified,
      status: verified
        ? PartnerEmailBrandingStatus.VERIFIED
        : PartnerEmailBrandingStatus.PENDING_DNS,
      verifiedAt: verified ? new Date() : null,
      lastCheckedAt: new Date(),
      failureReason: verified
        ? null
        : "SPF, DKIM, and DMARC records must all match before this sender can be used.",
      metadata: safeJson({
        spfValues,
        dkimValues,
        dmarcValues,
      }),
    },
  });

  await createPlatformAuditLog({
    actorUserId,
    actorEmail,
    action: "partner_email_branding.dns_checked",
    entityType: "PartnerEmailBranding",
    entityId: emailBranding.id,
    metadata: {
      partnerCompanyId,
      status: emailBranding.status,
      spfVerified,
      dkimVerified,
      dmarcVerified,
    },
  }).catch(() => undefined);

  return emailBranding;
}

export async function transitionPartnerEmailBranding({
  actorEmail,
  actorUserId,
  input,
  partnerCompanyId,
}: {
  actorUserId?: string | null;
  actorEmail?: string | null;
  partnerCompanyId?: string | null;
  input: PartnerEmailBrandingActionInput;
}) {
  const resolvedPartnerCompanyId =
    partnerCompanyId ?? input.partnerCompanyId ?? null;

  if (!resolvedPartnerCompanyId) {
    throw new PartnerEmailBrandingError("Partner company is required.");
  }

  if (input.action === "check_dns" || input.action === "verify") {
    return checkPartnerEmailBrandingDns({
      actorEmail,
      actorUserId,
      partnerCompanyId: resolvedPartnerCompanyId,
    });
  }

  const existing = await prisma.partnerEmailBranding.findUnique({
    where: { partnerCompanyId: resolvedPartnerCompanyId },
  });

  if (!existing) {
    throw new PartnerEmailBrandingError("Email branding is not configured.", 404);
  }

  const emailBranding = await prisma.partnerEmailBranding.update({
    where: { id: existing.id },
    data: {
      status: PartnerEmailBrandingStatus.DISABLED,
      failureReason: "Disabled by administrator.",
    },
  });

  await createPlatformAuditLog({
    actorUserId,
    actorEmail,
    action: "partner_email_branding.disabled",
    entityType: "PartnerEmailBranding",
    entityId: emailBranding.id,
    metadata: {
      partnerCompanyId: resolvedPartnerCompanyId,
    },
  }).catch(() => undefined);

  return emailBranding;
}

export async function resolveEmailBrandingForCompany(companyId: string) {
  const brand = await resolveBrandContext(companyId);
  const partnerCompanyId = await resolvePartnerCompanyId(companyId);
  const emailBranding = partnerCompanyId
    ? await prisma.partnerEmailBranding.findFirst({
        where: {
          partnerCompanyId,
          status: PartnerEmailBrandingStatus.VERIFIED,
        },
      })
    : null;

  const fromEmail = emailBranding?.fromAddress ?? defaultFromEmail();
  const fromName = emailBranding?.fromName ?? brand.appName ?? defaultFromName();
  const replyToEmail = emailBranding?.replyTo ?? brand.supportEmail ?? undefined;
  const usingVerifiedPartnerSender = Boolean(emailBranding?.fromAddress);

  return {
    from: formatAddress({ email: fromEmail, name: fromName }),
    fromName,
    fromEmail,
    replyTo: replyToEmail,
    usingVerifiedPartnerSender,
    brandSnapshot: {
      ...brandSnapshotForBilling(brand),
      emailBrandingStatus: emailBranding?.status ?? "FALLBACK",
      fromName,
      fromEmail,
      replyToEmail: replyToEmail ?? null,
      sendingDomain: emailBranding?.sendingDomain ?? null,
      footerText: emailBranding?.footerText ?? null,
      logoUrl: emailBranding?.logoUrl ?? brand.logoUrl ?? null,
    },
  };
}

export async function getPartnerEmailDeliveryAnalytics(partnerCompanyId: string) {
  await assertPartnerCompany(partnerCompanyId);
  const clientIds = await prisma.company.findMany({
    where: {
      OR: [{ id: partnerCompanyId }, { parentCompanyId: partnerCompanyId }],
    },
    select: { id: true },
  });
  const companyIds = clientIds.map((company) => company.id);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    notificationSent,
    notificationFailed,
    notificationPending,
    billingSent,
    billingFailed,
    billingQueued,
  ] = await Promise.all([
    prisma.companyNotificationEmailDelivery.count({
      where: { companyId: { in: companyIds }, status: "SENT", sentAt: { gte: since } },
    }),
    prisma.companyNotificationEmailDelivery.count({
      where: { companyId: { in: companyIds }, status: "FAILED" },
    }),
    prisma.companyNotificationEmailDelivery.count({
      where: { companyId: { in: companyIds }, status: "PENDING" },
    }),
    prisma.billingDocumentEmailDelivery.count({
      where: { companyId: { in: companyIds }, status: "SENT", sentAt: { gte: since } },
    }),
    prisma.billingDocumentEmailDelivery.count({
      where: { companyId: { in: companyIds }, status: "FAILED" },
    }),
    prisma.billingDocumentEmailDelivery.count({
      where: { companyId: { in: companyIds }, status: "QUEUED" },
    }),
  ]);

  return {
    since,
    notificationSent,
    notificationFailed,
    notificationPending,
    billingSent,
    billingFailed,
    billingQueued,
    sent30d: notificationSent + billingSent,
    failed: notificationFailed + billingFailed,
    queued: notificationPending + billingQueued,
  };
}
