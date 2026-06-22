import { prisma } from "@/lib/prisma";
import {
  BILLING_PLANS,
  getBillingPlanConfig,
} from "@/server/config/billing-plans";
import { getCompanyMessageQuota } from "@/server/services/message-quota.service";
import { expireCompanySubscriptionIfNeeded } from "@/server/services/subscription-expiry.service";
import type { ChangeSubscriptionPlanInput } from "@/server/validators/subscription.validator";

export function getSubscriptionRenewalState({
  billingPlan,
  currentPeriodEnd,
  subscriptionStatus,
}: {
  billingPlan: string;
  currentPeriodEnd: Date | null;
  subscriptionStatus: string;
}) {
  const now = new Date();
  const daysUntilExpiry = currentPeriodEnd
    ? Math.ceil(
        (currentPeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
      )
    : null;
  const isPaidPlan = billingPlan !== "FREE";
  const isPastDue =
    subscriptionStatus === "PAST_DUE" ||
    subscriptionStatus === "CANCELED" ||
    Boolean(currentPeriodEnd && currentPeriodEnd < now);
  const isExpiringSoon =
    isPaidPlan &&
    !isPastDue &&
    typeof daysUntilExpiry === "number" &&
    daysUntilExpiry <= 7;

  return {
    isPaidPlan,
    isPastDue,
    isExpiringSoon,
    daysUntilExpiry,
    canRenew: isPaidPlan && (isPastDue || isExpiringSoon),
  };
}

export function addOneMonth(date: Date) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
}

export async function getSubscriptionOverview(companyId: string) {
  await expireCompanySubscriptionIfNeeded(companyId);
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      billingPlan: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      monthlyMessageLimit: true,
      cancelAtPeriodEnd: true,
      subscriptionCanceledAt: true,
    },
  });

  if (!company) throw new Error("Company not found");

  const quota = await getCompanyMessageQuota(companyId);

  const renewal = getSubscriptionRenewalState({
    billingPlan: company.billingPlan,
    subscriptionStatus: company.subscriptionStatus,
    currentPeriodEnd: company.currentPeriodEnd,
  });

  return {
    company,
    currentPlan: getBillingPlanConfig(company.billingPlan),
    quota,
    plans: BILLING_PLANS,
    renewal,
  };
}

export async function changeSubscriptionPlan({
  companyId,
  input,
}: {
  companyId: string;
  input: ChangeSubscriptionPlanInput;
}) {
  const plan = getBillingPlanConfig(input.plan);
  const now = new Date();
  const company = await prisma.company.update({
    where: { id: companyId },
    data: {
      billingPlan: plan.id,
      subscriptionStatus: plan.id === "FREE" ? "TRIALING" : "ACTIVE",
      monthlyMessageLimit: plan.monthlyMessageLimit,
      currentPeriodStart: now,
      currentPeriodEnd: addOneMonth(now),
      cancelAtPeriodEnd: false,
      subscriptionCanceledAt: null,
    },
  });

  return { company, plan };
}
