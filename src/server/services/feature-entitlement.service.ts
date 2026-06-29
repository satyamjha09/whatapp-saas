import { revalidateTag } from "next/cache";
import {
  BillingPlan,
  FeatureEntitlementKey,
  Prisma,
  SubscriptionStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { companyFeatureAccessCacheTag } from "@/server/cache-tags";
import { redactSensitiveData } from "@/server/utils/safe-logger";

export class FeatureEntitlementError extends Error {
  code = "FEATURE_NOT_AVAILABLE";
  constructor(message: string) {
    super(message);
    this.name = "FeatureEntitlementError";
  }
}

function isEnabled() {
  return process.env.FEATURE_ENTITLEMENTS_ENABLED !== "false";
}
function isStrictMode() {
  return process.env.FEATURE_ENTITLEMENTS_STRICT_MODE !== "false";
}
function blockPastDue() {
  return process.env.FEATURE_ENTITLEMENTS_BLOCK_PAST_DUE !== "false";
}
function logAllowedChecks() {
  return process.env.FEATURE_ENTITLEMENTS_LOG_ALLOWED === "true";
}
function intEnv(key: string, fallback: number) {
  const value = Number(process.env[key] ?? fallback);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}
function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

export const ALL_ENTITLEMENT_FEATURES = Object.values(FeatureEntitlementKey);
type FeatureConfig = { enabled: boolean; limitValue?: number };
type PlanConfig = Partial<Record<FeatureEntitlementKey, FeatureConfig>>;

const common: PlanConfig = {
  INBOX: { enabled: true }, CONTACTS: { enabled: true }, CRM: { enabled: true },
  TEMPLATES: { enabled: true }, WHATSAPP_SETTINGS: { enabled: true }, BILLING: { enabled: true },
  WALLET: { enabled: true }, PRIVACY_CENTER: { enabled: true }, CONSENT_CENTER: { enabled: true },
};

export const PLAN_ENTITLEMENT_MATRIX: Record<BillingPlan, PlanConfig> = {
  FREE: {
    ...common,
    CONTACTS: { enabled: true, limitValue: 500 }, TEMPLATES: { enabled: true, limitValue: 5 },
    CAMPAIGNS: { enabled: false }, BULK_MESSAGING: { enabled: false }, ANALYTICS: { enabled: false },
    DEVELOPER_API: { enabled: false }, DEVELOPER_WEBHOOKS: { enabled: false },
    TEAM: { enabled: false, limitValue: 1 }, RBAC: { enabled: false }, TRUST_CENTER: { enabled: false },
    STATUS_PAGE: { enabled: false }, COMPLIANCE_EXPORTS: { enabled: false }, SYSTEM_OPERATIONS: { enabled: false },
  },
  STARTER: {
    ...common,
    CONTACTS: { enabled: true, limitValue: 5_000 }, CAMPAIGNS: { enabled: true, limitValue: 10 },
    BULK_MESSAGING: { enabled: true }, TEMPLATES: { enabled: true, limitValue: 25 }, ANALYTICS: { enabled: true },
    DEVELOPER_API: { enabled: false }, DEVELOPER_WEBHOOKS: { enabled: false },
    TEAM: { enabled: true, limitValue: 3 }, RBAC: { enabled: false }, TRUST_CENTER: { enabled: true },
    STATUS_PAGE: { enabled: false }, COMPLIANCE_EXPORTS: { enabled: false }, SYSTEM_OPERATIONS: { enabled: false },
  },
  GROWTH: {
    ...common,
    CONTACTS: { enabled: true, limitValue: 50_000 }, CAMPAIGNS: { enabled: true, limitValue: 100 },
    BULK_MESSAGING: { enabled: true }, TEMPLATES: { enabled: true, limitValue: 100 }, ANALYTICS: { enabled: true },
    DEVELOPER_API: { enabled: true }, DEVELOPER_WEBHOOKS: { enabled: true },
    TEAM: { enabled: true, limitValue: 10 }, RBAC: { enabled: true }, TRUST_CENTER: { enabled: true },
    STATUS_PAGE: { enabled: true }, COMPLIANCE_EXPORTS: { enabled: true, limitValue: 10 }, SYSTEM_OPERATIONS: { enabled: false },
  },
  BUSINESS: Object.fromEntries(
    ALL_ENTITLEMENT_FEATURES.map((featureKey) => [featureKey, { enabled: true }]),
  ) as PlanConfig,
};

const MONTHLY_MESSAGE_LIMIT_BY_PLAN: Record<BillingPlan, number> = {
  FREE: intEnv("FEATURE_ENTITLEMENTS_FREE_MONTHLY_MESSAGES", 100),
  STARTER: intEnv("FEATURE_ENTITLEMENTS_STARTER_MONTHLY_MESSAGES", 1_000),
  GROWTH: intEnv("FEATURE_ENTITLEMENTS_GROWTH_MONTHLY_MESSAGES", 10_000),
  BUSINESS: intEnv("FEATURE_ENTITLEMENTS_BUSINESS_MONTHLY_MESSAGES", 50_000),
};

export async function seedPlanEntitlements() {
  const results = [];
  for (const billingPlan of Object.values(BillingPlan)) {
    for (const featureKey of ALL_ENTITLEMENT_FEATURES) {
      const config = PLAN_ENTITLEMENT_MATRIX[billingPlan][featureKey] ?? { enabled: false };
      results.push(
        await prisma.planEntitlement.upsert({
          where: { billingPlan_featureKey: { billingPlan, featureKey } },
          create: {
            billingPlan, featureKey, enabled: config.enabled,
            limitValue: config.limitValue ?? null, metadata: safeJson({ seeded: true }),
          },
          update: { enabled: config.enabled, limitValue: config.limitValue ?? null },
        }),
      );
    }
  }
  return results;
}

async function recordCheck(input: {
  companyId: string; userId?: string | null; featureKey: FeatureEntitlementKey;
  result: "ALLOWED" | "BLOCKED"; billingPlan?: BillingPlan | null;
  routePath?: string | null; method?: string | null; reason?: string | null; metadata?: unknown;
}) {
  if (input.result === "ALLOWED" && !logAllowedChecks()) return;
  await prisma.featureEntitlementCheckLog.create({
    data: {
      companyId: input.companyId, userId: input.userId ?? null, featureKey: input.featureKey,
      result: input.result, billingPlan: input.billingPlan ?? null, routePath: input.routePath ?? null,
      method: input.method ?? null, reason: input.reason ?? null,
      metadata: input.metadata === undefined ? undefined : safeJson(input.metadata),
    },
  }).catch(() => undefined);
}

function isSubscriptionAllowed(status: SubscriptionStatus) {
  return status === "TRIALING" || status === "ACTIVE";
}

export async function getCompanyEntitlement({
  companyId,
  featureKey,
}: {
  companyId: string;
  featureKey: FeatureEntitlementKey;
}) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, billingPlan: true, subscriptionStatus: true, monthlyMessageLimit: true },
  });
  if (!company) throw new Error("Company not found");

  const [planEntitlement, override] = await Promise.all([
    prisma.planEntitlement.findUnique({
      where: { billingPlan_featureKey: { billingPlan: company.billingPlan, featureKey } },
    }),
    prisma.companyEntitlementOverride.findFirst({
      where: {
        companyId, featureKey, status: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const enabled = override?.enabledOverride ?? planEntitlement?.enabled ?? !isStrictMode();
  const limitValue = override?.limitOverride ?? planEntitlement?.limitValue ?? null;
  return { company, featureKey, enabled, limitValue, planEntitlement, override };
}

export async function assertCompanyFeatureAccess({
  companyId,
  userId,
  featureKey,
  routePath,
  method,
}: {
  companyId: string; userId?: string | null; featureKey: FeatureEntitlementKey;
  routePath?: string | null; method?: string | null;
}) {
  if (!isEnabled()) return;
  const entitlement = await getCompanyEntitlement({ companyId, featureKey });

  if (blockPastDue() && !isSubscriptionAllowed(entitlement.company.subscriptionStatus)) {
    const reason = `Subscription status is ${entitlement.company.subscriptionStatus}`;
    await recordCheck({ companyId, userId, featureKey, result: "BLOCKED", billingPlan: entitlement.company.billingPlan, routePath, method, reason });
    throw new FeatureEntitlementError("Your subscription is not active. Please update billing to use this feature.");
  }
  if (!entitlement.enabled) {
    await recordCheck({
      companyId, userId, featureKey, result: "BLOCKED", billingPlan: entitlement.company.billingPlan,
      routePath, method, reason: "Feature is not enabled for this plan", metadata: { overrideId: entitlement.override?.id },
    });
    throw new FeatureEntitlementError(`This feature is not available on the ${entitlement.company.billingPlan} plan.`);
  }
  await recordCheck({ companyId, userId, featureKey, result: "ALLOWED", billingPlan: entitlement.company.billingPlan, routePath, method });
  return entitlement;
}

export async function getCompanyMonthlyMessageLimit({ companyId }: { companyId: string }) {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { billingPlan: true, monthlyMessageLimit: true } });
  if (!company) throw new Error("Company not found");
  return company.monthlyMessageLimit || MONTHLY_MESSAGE_LIMIT_BY_PLAN[company.billingPlan];
}

export async function createCompanyEntitlementOverride(input: {
  companyId: string; featureKey: FeatureEntitlementKey; enabledOverride?: boolean | null;
  limitOverride?: number | null; reason?: string | null; expiresAt?: Date | null; createdByUserId?: string | null;
}) {
  const override = await prisma.companyEntitlementOverride.create({
    data: {
      companyId: input.companyId, featureKey: input.featureKey,
      enabledOverride: input.enabledOverride ?? null, limitOverride: input.limitOverride ?? null,
      reason: input.reason ?? null, expiresAt: input.expiresAt ?? null,
      createdByUserId: input.createdByUserId ?? null,
    },
  });

  revalidateTag(companyFeatureAccessCacheTag(input.companyId), "max");

  return override;
}

export async function listPlanEntitlements() {
  return prisma.planEntitlement.findMany({ orderBy: [{ billingPlan: "asc" }, { featureKey: "asc" }] });
}

export async function listCompanyEntitlementOverrides({ companyId }: { companyId: string }) {
  return prisma.companyEntitlementOverride.findMany({
    where: { companyId }, orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
}

export async function getFeatureEntitlementHealth() {
  const expectedPlanEntitlements = Object.values(BillingPlan).length * ALL_ENTITLEMENT_FEATURES.length;
  const [planEntitlements, activeOverrides, blocked24h] = await Promise.all([
    prisma.planEntitlement.count(),
    prisma.companyEntitlementOverride.count({ where: { status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }),
    prisma.featureEntitlementCheckLog.count({ where: { result: "BLOCKED", createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
  ]);
  return {
    enabled: isEnabled(), strictMode: isStrictMode(), planEntitlements, expectedPlanEntitlements,
    activeOverrides, blocked24h, isHealthy: isEnabled() && planEntitlements === expectedPlanEntitlements,
  };
}
