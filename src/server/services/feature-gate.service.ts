import { prisma } from "@/lib/prisma";
import {
  type BillingFeature,
  getBillingPlanConfig,
} from "@/server/config/billing-plans";

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
    company.billingPlan === "FREE" ||
    (!["PAST_DUE", "CANCELED"].includes(company.subscriptionStatus) &&
      (!company.currentPeriodEnd || company.currentPeriodEnd >= new Date()));

  return {
    plan,
    subscriptionActive,
    enabledFeatures: subscriptionActive ? plan.enabledFeatures : [],
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

  if (!access.subscriptionActive) throw new Error("Subscription is past due");
  if (!access.enabledFeatures.includes(feature)) {
    throw new Error(
      `${feature} is not available on the ${access.plan.name} plan`,
    );
  }

  return access;
}
