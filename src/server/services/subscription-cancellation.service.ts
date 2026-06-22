import { prisma } from "@/lib/prisma";
import { getBillingPlanConfig } from "@/server/config/billing-plans";
import { addOneMonth } from "@/server/services/subscription.service";

export async function cancelSubscriptionAtPeriodEnd(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      billingPlan: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
    },
  });

  if (!company) throw new Error("Company not found");
  if (company.billingPlan === "FREE") {
    throw new Error("Free plan cannot be canceled");
  }
  if (company.subscriptionStatus !== "ACTIVE") {
    throw new Error("Only active paid subscriptions can be canceled");
  }
  if (company.cancelAtPeriodEnd) {
    throw new Error("Subscription cancellation is already scheduled");
  }
  if (!company.currentPeriodEnd) {
    throw new Error("Current billing period not found");
  }

  return prisma.company.update({
    where: { id: companyId },
    data: {
      cancelAtPeriodEnd: true,
      subscriptionCanceledAt: new Date(),
    },
  });
}

export async function resumeCanceledSubscription(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      billingPlan: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
    },
  });

  if (!company) throw new Error("Company not found");
  if (company.billingPlan === "FREE") {
    throw new Error("Free plan does not need resume");
  }
  if (!company.cancelAtPeriodEnd) {
    throw new Error("Subscription is not scheduled for cancellation");
  }
  if (!company.currentPeriodEnd || company.currentPeriodEnd <= new Date()) {
    throw new Error("Cancellation can no longer be resumed");
  }

  return prisma.company.update({
    where: { id: companyId },
    data: {
      cancelAtPeriodEnd: false,
      subscriptionCanceledAt: null,
      subscriptionStatus: "ACTIVE",
    },
  });
}

export async function applyDueSubscriptionCancellations({
  companyId,
  limit = 200,
}: {
  companyId?: string;
  limit?: number;
} = {}) {
  const now = new Date();
  const freePlan = getBillingPlanConfig("FREE");
  const companies = await prisma.company.findMany({
    where: {
      ...(companyId ? { id: companyId } : {}),
      billingPlan: { not: "FREE" },
      cancelAtPeriodEnd: true,
      currentPeriodEnd: { lt: now },
    },
    select: {
      id: true,
      name: true,
      billingPlan: true,
      currentPeriodEnd: true,
    },
    orderBy: { currentPeriodEnd: "asc" },
    take: limit,
  });
  const results: Array<{
    companyId: string;
    companyName: string;
    previousPlan: string;
    newPlan: "FREE";
    newStatus: "CANCELED";
  }> = [];

  for (const company of companies) {
    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.company.updateMany({
        where: {
          id: company.id,
          billingPlan: { not: "FREE" },
          cancelAtPeriodEnd: true,
          currentPeriodEnd: { lt: now },
        },
        data: {
          billingPlan: "FREE",
          subscriptionStatus: "CANCELED",
          monthlyMessageLimit: freePlan.monthlyMessageLimit,
          cancelAtPeriodEnd: false,
          currentPeriodStart: now,
          currentPeriodEnd: addOneMonth(now),
        },
      });

      if (claimed.count === 0) return false;

      await tx.auditLog.create({
        data: {
          companyId: company.id,
          action: "billing.subscription.canceled_at_period_end",
          entityType: "Company",
          entityId: company.id,
          metadata: {
            previousPlan: company.billingPlan,
            previousPeriodEnd: company.currentPeriodEnd?.toISOString() ?? null,
            newPlan: "FREE",
          },
        },
      });
      return true;
    });

    if (updated) {
      results.push({
        companyId: company.id,
        companyName: company.name,
        previousPlan: company.billingPlan,
        newPlan: "FREE",
        newStatus: "CANCELED",
      });
    }
  }

  return {
    checkedCount: companies.length,
    recoveredCount: results.length,
    results,
  };
}
