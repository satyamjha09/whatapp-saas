import { prisma } from "@/lib/prisma";
import { createCompanyNotification } from "@/server/services/company-notification.service";

export const SUBSCRIPTION_EXPIRY_JOB = "subscription-expiry-check";

export async function expireCompanySubscriptionIfNeeded(companyId: string) {
  const now = new Date();
  const company = await prisma.company.findFirst({
    where: {
      id: companyId,
      billingPlan: { not: "FREE" },
      subscriptionStatus: "ACTIVE",
      currentPeriodEnd: { lt: now },
    },
    select: {
      id: true,
      billingPlan: true,
      currentPeriodEnd: true,
    },
  });

  if (!company) return false;

  const result = await prisma.company.updateMany({
    where: {
      id: companyId,
      billingPlan: { not: "FREE" },
      subscriptionStatus: "ACTIVE",
      currentPeriodEnd: { lt: now },
    },
    data: { subscriptionStatus: "PAST_DUE" },
  });

  if (result.count === 1) {
    await createPastDueNotification(company);
  }

  return result.count === 1;
}

async function createPastDueNotification(company: {
  id: string;
  billingPlan: string;
  currentPeriodEnd: Date | null;
}) {
  return createCompanyNotification({
    companyId: company.id,
    type: "BILLING",
    severity: "ERROR",
    title: "Subscription past due",
    message:
      "Your paid plan has expired. Renew your subscription to continue sending messages.",
    actionHref: "/dashboard/billing",
    idempotencyKey: `subscription-past-due:${company.id}:${company.currentPeriodEnd?.toISOString() ?? "unknown"}`,
    metadata: {
      previousPlan: company.billingPlan,
      currentPeriodEnd: company.currentPeriodEnd?.toISOString() ?? null,
    },
  });
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
      await createPastDueNotification(company);

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
      status: true,
      billingPlan: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
    },
  });

  if (!company) throw new Error("Company not found");
  if (company.status !== "ACTIVE") {
    throw new Error("Complete company onboarding first");
  }

  if (
    company.billingPlan !== "FREE" &&
    (company.subscriptionStatus === "PAST_DUE" ||
      company.subscriptionStatus === "CANCELED")
  ) {
    throw new Error("Subscription is past due");
  }

  return company;
}
