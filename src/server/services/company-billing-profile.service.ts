import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

export class BillingProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BillingProfileError";
  }
}

function isEnabled() {
  return process.env.BILLING_PROFILE_ENABLED !== "false";
}

function requireBillingEmail() {
  return process.env.BILLING_PROFILE_REQUIRE_BILLING_EMAIL !== "false";
}

function requireLegalName() {
  return process.env.BILLING_PROFILE_REQUIRE_LEGAL_NAME !== "false";
}

function taxIdLabel() {
  return process.env.BILLING_PROFILE_TAX_ID_LABEL || "Tax ID";
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function assertEnabled() {
  if (!isEnabled()) {
    throw new BillingProfileError("Billing profile is disabled.");
  }
}

export async function getOrCreateCompanyBillingProfile({
  companyId,
}: {
  companyId: string;
}) {
  assertEnabled();

  const existing = await prisma.companyBillingProfile.findUnique({
    where: {
      companyId,
    },
  });

  if (existing) return existing;

  const company = await prisma.company.findUnique({
    where: {
      id: companyId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!company) {
    throw new BillingProfileError("Company not found.");
  }

  return prisma.companyBillingProfile.create({
    data: {
      companyId,
      legalName: company.name,
      taxIdLabel: taxIdLabel(),
      lastUpdatedSource: "SYSTEM",
    },
  });
}

export async function updateCompanyBillingProfile({
  companyId,
  actorUserId,
  source = "CUSTOMER",
  data,
  reason,
}: {
  companyId: string;
  actorUserId?: string | null;
  source?: "CUSTOMER" | "ADMIN" | "SYSTEM";
  reason?: string | null;
  data: {
    legalName?: string | null;
    billingEmail?: string | null;
    billingPhone?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
    taxIdLabel?: string | null;
    taxId?: string | null;
    invoiceNotes?: string | null;
  };
}) {
  assertEnabled();

  if (requireLegalName() && !data.legalName?.trim()) {
    throw new BillingProfileError("Billing legal name is required.");
  }

  if (requireBillingEmail() && !data.billingEmail?.trim()) {
    throw new BillingProfileError("Billing email is required.");
  }

  const existing = await getOrCreateCompanyBillingProfile({
    companyId,
  });

  const updated = await prisma.$transaction(async (tx) => {
    const profile = await tx.companyBillingProfile.update({
      where: {
        companyId,
      },
      data: {
        legalName: data.legalName?.trim() || null,
        billingEmail: data.billingEmail?.trim() || null,
        billingPhone: data.billingPhone?.trim() || null,

        addressLine1: data.addressLine1?.trim() || null,
        addressLine2: data.addressLine2?.trim() || null,
        city: data.city?.trim() || null,
        state: data.state?.trim() || null,
        postalCode: data.postalCode?.trim() || null,
        country: data.country?.trim() || null,

        taxIdLabel: data.taxIdLabel?.trim() || taxIdLabel(),
        taxId: data.taxId?.trim() || null,

        invoiceNotes: data.invoiceNotes?.trim() || null,

        lastUpdatedByUserId: actorUserId ?? null,
        lastUpdatedSource: source,
        verificationStatus: source === "ADMIN" ? "VERIFIED" : "UNVERIFIED",
      },
    });

    await tx.billingProfileUpdateEvent.create({
      data: {
        companyId,
        profileId: profile.id,
        actorUserId: actorUserId ?? null,
        source,
        previousData: safeJson(existing),
        newData: safeJson(profile),
        reason: reason ?? null,
      },
    });

    return profile;
  });

  await createAuditLog({
    companyId,
    actorUserId: actorUserId ?? undefined,
    action: "billing.profile_updated",
    entityType: "CompanyBillingProfile",
    entityId: updated.id,
    metadata: {
      source,
      verificationStatus: updated.verificationStatus,
      billingEmail: updated.billingEmail,
      hasTaxId: Boolean(updated.taxId),
    },
  }).catch(() => undefined);

  return updated;
}

export async function getInvoiceBillingSnapshot({
  companyId,
}: {
  companyId: string;
}) {
  const profile = await prisma.companyBillingProfile.findUnique({
    where: {
      companyId,
    },
  });

  const company = await prisma.company.findUnique({
    where: {
      id: companyId,
    },
    select: {
      name: true,
    },
  });

  return {
    billingName: profile?.legalName ?? company?.name ?? null,
    billingEmail: profile?.billingEmail ?? null,
    billingAddress: [
      profile?.addressLine1,
      profile?.addressLine2,
      profile?.city,
      profile?.state,
      profile?.postalCode,
      profile?.country,
    ]
      .filter(Boolean)
      .join(", "),
    billingTaxId: profile?.taxId ?? null,
    billingTaxIdLabel: profile?.taxIdLabel ?? taxIdLabel(),
    invoiceNotes: profile?.invoiceNotes ?? null,
  };
}

export async function listBillingProfileUpdateEvents({
  companyId,
}: {
  companyId: string;
}) {
  return prisma.billingProfileUpdateEvent.findMany({
    where: {
      companyId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function getBillingProfileHealth() {
  const [profiles, missingLegalName, missingBillingEmail, verified] =
    await Promise.all([
      prisma.companyBillingProfile.count(),
      prisma.companyBillingProfile.count({
        where: {
          OR: [{ legalName: null }, { legalName: "" }],
        },
      }),
      prisma.companyBillingProfile.count({
        where: {
          OR: [{ billingEmail: null }, { billingEmail: "" }],
        },
      }),
      prisma.companyBillingProfile.count({
        where: {
          verificationStatus: "VERIFIED",
        },
      }),
    ]);

  return {
    enabled: isEnabled(),
    profiles,
    missingLegalName,
    missingBillingEmail,
    verified,
    isHealthy:
      isEnabled() &&
      (!requireLegalName() || missingLegalName === 0) &&
      (!requireBillingEmail() || missingBillingEmail === 0),
  };
}
