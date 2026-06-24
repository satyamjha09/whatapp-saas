import { prisma } from "@/lib/prisma";
import {
  type BillingFeature,
  getBillingPlanConfig,
} from "@/server/config/billing-plans";
import type { FeatureEntitlementKey } from "@/generated/prisma/client";
import {
  assertCompanyFeatureAccess,
  getCompanyEntitlement,
} from "@/server/services/feature-entitlement.service";

const FEATURE_MAP: Record<BillingFeature, FeatureEntitlementKey> = {
  SINGLE_MESSAGES: "INBOX",
  BULK_CAMPAIGNS: "BULK_MESSAGING",
  CONTACT_GROUPS: "CONTACTS",
  DEVELOPER_API: "DEVELOPER_API",
  DEVELOPER_WEBHOOKS: "DEVELOPER_WEBHOOKS",
  ADVANCED_REPORTS: "ANALYTICS",
};
const ALL_BILLING_FEATURES = Object.keys(FEATURE_MAP) as BillingFeature[];

export async function getCompanyFeatureAccess(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      billingPlan: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
    },
  });

  if (!company) throw new Error("Company not found");

  const plan = getBillingPlanConfig(company.billingPlan);
  const subscriptionActive =
    ["TRIALING", "ACTIVE"].includes(company.subscriptionStatus) &&
    (!company.currentPeriodEnd || company.currentPeriodEnd >= new Date());

  const resolvedFeatures = await Promise.all(
    ALL_BILLING_FEATURES.map(async (feature) => ({
      feature,
      entitlement: await getCompanyEntitlement({
        companyId,
        featureKey: FEATURE_MAP[feature],
      }),
    })),
  );

  return {
    plan,
    subscriptionActive,
    enabledFeatures: subscriptionActive
      ? resolvedFeatures.filter(({ entitlement }) => entitlement.enabled).map(({ feature }) => feature)
      : [],
  };
}

export async function hasCompanyFeature(
  companyId: string,
  feature: BillingFeature,
) {
  const access = await getCompanyFeatureAccess(companyId);
  return access.enabledFeatures.includes(feature);
}

export async function assertCompanyFeature(
  companyId: string,
  feature: BillingFeature,
) {
  const access = await getCompanyFeatureAccess(companyId);
  try {
    await assertCompanyFeatureAccess({ companyId, featureKey: FEATURE_MAP[feature] });
  } catch {
    if (!access.subscriptionActive) throw new Error("Subscription is past due");
    throw new Error(`${feature} is not available on the ${access.plan.name} plan`);
  }

  return access;
}
