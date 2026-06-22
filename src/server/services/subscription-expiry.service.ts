import { prisma } from "@/lib/prisma";

export const SUBSCRIPTION_EXPIRY_JOB = "subscription-expiry-check";

export async function expireCompanySubscriptionIfNeeded(companyId: string) {
  const now = new Date();
  const result = await prisma.company.updateMany({
    where: {
      id: companyId,
      billingPlan: { not: "FREE" },
      subscriptionStatus: "ACTIVE",
      currentPeriodEnd: { lt: now },
    },
    data: { subscriptionStatus: "PAST_DUE" },
  });

  return result.count === 1;
}

export async function expirePastDueSubscriptions({
  companyId,
  limit = 200,
}: {
  companyId?: string;
  limit?: number;
} = {}) {
  const now = new Date();
  const expiredCompanies = await prisma.company.findMany({
    where: {
      ...(companyId ? { id: companyId } : {}),
      billingPlan: { not: "FREE" },
      subscriptionStatus: "ACTIVE",
      currentPeriodEnd: { lt: now },
    },
    select: {
      id: true,
      name: true,
      billingPlan: true,
      currentPeriodEnd: true,
    },
    take: limit,
    orderBy: { currentPeriodEnd: "asc" },
  });
  const results: Array<{
    companyId: string;
    companyName: string;
    previousPlan: string;
    currentPeriodEnd: Date | null;
    newStatus: "PAST_DUE";
  }> = [];

  for (const company of expiredCompanies) {
    const updated = await prisma.company.updateMany({
      where: {
        id: company.id,
        subscriptionStatus: "ACTIVE",
        currentPeriodEnd: { lt: now },
      },
      data: { subscriptionStatus: "PAST_DUE" },
    });

    if (updated.count === 1) {
      results.push({
        companyId: company.id,
        companyName: company.name,
        previousPlan: company.billingPlan,
        currentPeriodEnd: company.currentPeriodEnd,
        newStatus: "PAST_DUE",
      });
    }
  }

  return {
    checkedCount: expiredCompanies.length,
    recoveredCount: results.length,
    results,
  };
}

export async function assertSubscriptionCanSend(companyId: string) {
  await expireCompanySubscriptionIfNeeded(companyId);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      billingPlan: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
    },
  });

  if (!company) throw new Error("Company not found");
  if (
    company.billingPlan !== "FREE" &&
    (company.subscriptionStatus === "PAST_DUE" ||
      company.subscriptionStatus === "CANCELED")
  ) {
    throw new Error("Subscription is past due");
  }

  return company;
}
