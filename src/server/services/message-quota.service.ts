import { prisma } from "@/lib/prisma";

function getCurrentUtcMonth() {
  const now = new Date();

  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
  };
}

export async function getCompanyMessageQuota(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      currentPeriodStart: true,
      currentPeriodEnd: true,
      monthlyMessageLimit: true,
    },
  });

  if (!company) throw new Error("Company not found");

  const currentMonth = getCurrentUtcMonth();
  const periodStart = company.currentPeriodStart ?? currentMonth.start;
  const periodEnd = company.currentPeriodEnd ?? currentMonth.end;
  const usedMessages = await prisma.message.count({
    where: {
      companyId,
      direction: "OUTBOUND",
      status: {
        not: "CANCELED",
      },
      createdAt: { gte: periodStart, lt: periodEnd },
    },
  });

  return {
    periodStart,
    periodEnd,
    monthlyMessageLimit: company.monthlyMessageLimit,
    usedMessages,
    remainingMessages: Math.max(company.monthlyMessageLimit - usedMessages, 0),
    hasAvailableMessages: usedMessages < company.monthlyMessageLimit,
  };
}

export async function assertCompanyMessageQuota(
  companyId: string,
  requestedMessages = 1,
) {
  const quota = await getCompanyMessageQuota(companyId);

  if (requestedMessages < 1) return quota;
  if (quota.usedMessages + requestedMessages > quota.monthlyMessageLimit) {
    throw new Error(
      `Monthly message limit exceeded. ${quota.remainingMessages.toLocaleString("en-IN")} message(s) remaining`,
    );
  }

  return quota;
}
