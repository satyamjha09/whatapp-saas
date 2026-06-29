import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { companyOnboardingStateCacheTag } from "@/server/cache-tags";
import { createAuditLog } from "@/server/services/audit.service";

export type CompanyOnboardingStepKey = "profile" | "whatsapp" | "billing";

export type CompanyOnboardingStep = {
  key: CompanyOnboardingStepKey;
  title: string;
  description: string;
  complete: boolean;
  required: boolean;
  href: string;
};

export type CompanyOnboardingState = {
  company: {
    id: string;
    name: string;
    status: string;
    businessCategory: string | null;
    city: string | null;
    pinCode: string | null;
    employeeCode: string | null;
    onboardingCompletedAt: Date | null;
  };
  steps: CompanyOnboardingStep[];
  requiredStepsComplete: boolean;
  shouldShowGate: boolean;
};

export class CompanyOnboardingStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompanyOnboardingStateError";
  }
}

function envFlag(name: string, defaultValue: boolean) {
  const value = process.env[name];

  if (value === undefined) return defaultValue;

  return value.toLowerCase() === "true";
}

function isFilled(value: string | null | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function isOnboardingGateEnabled() {
  return envFlag("COMPANY_ONBOARDING_GATE_ENABLED", true);
}

function isProfileRequired() {
  return envFlag("COMPANY_ONBOARDING_REQUIRE_PROFILE", true);
}

function isWhatsAppConnectRequired() {
  return envFlag("COMPANY_ONBOARDING_REQUIRE_WHATSAPP_CONNECT", false);
}

function isBillingRequired() {
  return envFlag("COMPANY_ONBOARDING_REQUIRE_BILLING", false);
}

function revalidateCompanyOnboardingStateCache(companyId: string) {
  revalidateTag(companyOnboardingStateCacheTag(companyId), "max");
}

async function getCompanyOnboardingStateUncached(
  companyId: string,
): Promise<CompanyOnboardingState> {
  const company = await prisma.company.findUnique({
    where: {
      id: companyId,
    },
    select: {
      id: true,
      name: true,
      status: true,
      businessCategory: true,
      city: true,
      pinCode: true,
      employeeCode: true,
      onboardingCompletedAt: true,
      wallet: {
        select: {
          id: true,
        },
      },
      whatsAppPhoneNumbers: {
        where: {
          phoneNumberId: {
            not: null,
          },
        },
        select: {
          id: true,
        },
        take: 1,
      },
    },
  });

  if (!company) {
    throw new CompanyOnboardingStateError("Company not found.");
  }

  const profileRequired = isProfileRequired();
  const whatsappRequired = isWhatsAppConnectRequired();
  const billingRequired = isBillingRequired();

  const profileComplete =
    !profileRequired ||
    [company.name, company.businessCategory, company.city, company.pinCode].every(
      isFilled,
    );
  const whatsappComplete =
    !whatsappRequired || company.whatsAppPhoneNumbers.length > 0;
  const billingComplete = !billingRequired || Boolean(company.wallet);

  const steps: CompanyOnboardingStep[] = [
    {
      key: "profile",
      title: "Company profile",
      description: "Add business name, category, city, and pin code.",
      complete: profileComplete,
      required: profileRequired,
      href: "/dashboard/onboarding",
    },
    {
      key: "whatsapp",
      title: "Connect WhatsApp",
      description: "Attach a verified WhatsApp phone number to this workspace.",
      complete: whatsappComplete,
      required: whatsappRequired,
      href: "/dashboard/whatsapp/connect",
    },
    {
      key: "billing",
      title: "Billing setup",
      description: "Create the workspace wallet or billing account.",
      complete: billingComplete,
      required: billingRequired,
      href: "/dashboard/billing",
    },
  ];

  const requiredStepsComplete = steps.every(
    (step) => !step.required || step.complete,
  );

  return {
    company: {
      id: company.id,
      name: company.name,
      status: company.status,
      businessCategory: company.businessCategory,
      city: company.city,
      pinCode: company.pinCode,
      employeeCode: company.employeeCode,
      onboardingCompletedAt: company.onboardingCompletedAt,
    },
    steps,
    requiredStepsComplete,
    shouldShowGate:
      isOnboardingGateEnabled() && company.status === "PENDING_ONBOARDING",
  };
}

export function getCompanyOnboardingState(companyId: string) {
  return unstable_cache(
    async () => getCompanyOnboardingStateUncached(companyId),
    ["company-onboarding-state", companyId],
    {
      revalidate: 60,
      tags: [companyOnboardingStateCacheTag(companyId)],
    },
  )();
}

export async function updateCompanyOnboardingProfile({
  actorUserId,
  businessCategory,
  city,
  companyId,
  employeeCode,
  name,
  pinCode,
}: {
  actorUserId: string;
  companyId: string;
  name: string;
  businessCategory: string;
  city: string;
  pinCode: string;
  employeeCode?: string | null;
}) {
  const company = await prisma.company.update({
    where: {
      id: companyId,
    },
    data: {
      name: name.trim(),
      businessCategory: businessCategory.trim(),
      city: city.trim(),
      pinCode: pinCode.trim(),
      employeeCode: employeeCode?.trim() || null,
    },
  });

  await createAuditLog({
    companyId,
    actorUserId,
    action: "company.onboarding_profile_updated",
    entityType: "Company",
    entityId: companyId,
    metadata: {
      name: company.name,
      businessCategory: company.businessCategory,
      city: company.city,
      pinCode: company.pinCode,
    },
  }).catch(() => undefined);

  revalidateCompanyOnboardingStateCache(companyId);

  return company;
}

export async function completeCompanyOnboardingIfReady({
  actorUserId,
  companyId,
}: {
  actorUserId: string;
  companyId: string;
}) {
  const state = await getCompanyOnboardingState(companyId);

  if (!state.requiredStepsComplete) {
    throw new CompanyOnboardingStateError(
      "Complete all required onboarding steps before activating this workspace.",
    );
  }

  const company = await prisma.company.update({
    where: {
      id: companyId,
    },
    data: {
      status: "ACTIVE",
      onboardingCompletedAt:
        state.company.onboardingCompletedAt ?? new Date(),
    },
  });

  await createAuditLog({
    companyId,
    actorUserId,
    action: "company.onboarding_completed",
    entityType: "Company",
    entityId: companyId,
    metadata: {
      status: company.status,
    },
  }).catch(() => undefined);

  revalidateCompanyOnboardingStateCache(companyId);

  return company;
}
