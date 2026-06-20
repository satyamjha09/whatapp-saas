import { getBillingPlanConfig } from "@/lib/billing-plans";
import { prisma } from "@/lib/prisma";

function getCurrentUtcMonth() {
  const now = new Date();

  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

export async function getBillingOverviewByCompany(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      billingPlan: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      monthlyMessageLimit: true,
      wallet: {
        select: { balancePaise: true },
      },
    },
  });

  if (!company) {
    throw new Error("Company not found");
  }

  const planConfig = getBillingPlanConfig(company.billingPlan);
  const currentMonth = getCurrentUtcMonth();
  const periodStart = company.currentPeriodStart ?? currentMonth.start;
  const periodEnd = company.currentPeriodEnd ?? currentMonth.end;
  const messagesUsedThisPeriod = await prisma.message.count({
    where: {
      companyId,
      direction: "OUTBOUND",
      createdAt: {
        gte: periodStart,
        lt: periodEnd,
      },
    },
  });

  return {
    plan: company.billingPlan,
    planName: planConfig.name,
    subscriptionStatus: company.subscriptionStatus,
    trialEndsAt: company.trialEndsAt,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    monthlyMessageLimit: company.monthlyMessageLimit,
    messagesUsedThisPeriod,
    messagesRemainingThisPeriod: Math.max(
      company.monthlyMessageLimit - messagesUsedThisPeriod,
      0,
    ),
    walletBalancePaise: company.wallet?.balancePaise ?? 0,
    limits: planConfig,
  };
}
