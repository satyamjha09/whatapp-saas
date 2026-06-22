import { prisma } from "@/lib/prisma";
import { getBillingPlanConfig } from "@/server/config/billing-plans";
import { assertCompanyFeature } from "@/server/services/feature-gate.service";

export function getUtcDayStart(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export async function getDeveloperApiUsage(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { billingPlan: true },
  });

  if (!company) throw new Error("Company not found");

  const plan = getBillingPlanConfig(company.billingPlan);
  const date = getUtcDayStart();
  const usage = await prisma.developerApiUsage.aggregate({
    where: { companyId, date },
    _sum: { count: true },
  });
  const usedToday = usage._sum.count ?? 0;

  return {
    planId: plan.id,
    planName: plan.name,
    dailyLimit: plan.developerApiDailyLimit,
    usedToday,
    remainingToday: Math.max(plan.developerApiDailyLimit - usedToday, 0),
    date,
  };
}

export async function assertAndRecordDeveloperApiUsage({
  apiKeyId,
  companyId,
}: {
  apiKeyId?: string | null;
  companyId: string;
}) {
  const access = await assertCompanyFeature(companyId, "DEVELOPER_API");
  const dailyLimit = access.plan.developerApiDailyLimit;

  if (dailyLimit <= 0) {
    throw new Error("Developer API is not available on your current plan");
  }

  const date = getUtcDayStart();
  const usageKey = apiKeyId ?? "unknown";

  return prisma.$transaction(async (tx) => {
    const lockKey = `developer-api:${companyId}:${date.toISOString()}`;
    await tx.$queryRaw<Array<{ locked: number }>>`
      SELECT 1::int AS "locked"
      FROM pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
    `;

    const aggregate = await tx.developerApiUsage.aggregate({
      where: { companyId, date },
      _sum: { count: true },
    });
    const usedToday = aggregate._sum.count ?? 0;

    if (usedToday >= dailyLimit) {
      throw new Error("Developer API daily limit exceeded");
    }

    await tx.developerApiUsage.upsert({
      where: {
        companyId_apiKeyId_date: { companyId, apiKeyId: usageKey, date },
      },
      update: { count: { increment: 1 } },
      create: { companyId, apiKeyId: usageKey, date, count: 1 },
    });

    return {
      planId: access.plan.id,
      planName: access.plan.name,
      dailyLimit,
      usedToday: usedToday + 1,
      remainingToday: Math.max(dailyLimit - usedToday - 1, 0),
      date,
    };
  });
}
