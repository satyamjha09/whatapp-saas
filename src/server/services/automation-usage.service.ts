import { prisma } from "@/lib/prisma";
import { getCompanyPlanFeatures } from "./plan-feature.service";

export function getCurrentCalendarMonthPeriod(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { start, end };
}

export async function getCompanyUsagePeriod(companyId: string): Promise<{ start: Date; end: Date }> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { currentPeriodStart: true, currentPeriodEnd: true },
  });

  if (company?.currentPeriodStart && company?.currentPeriodEnd) {
    return {
      start: company.currentPeriodStart,
      end: company.currentPeriodEnd,
    };
  }

  return getCurrentCalendarMonthPeriod();
}

export async function getOrCreateUsageCounter(companyId: string) {
  const period = await getCompanyUsagePeriod(companyId);

  const counter = await prisma.automationUsageCounter.upsert({
    where: {
      companyId_periodStart_periodEnd: {
        companyId,
        periodStart: period.start,
        periodEnd: period.end,
      },
    },
    update: {},
    create: {
      companyId,
      periodStart: period.start,
      periodEnd: period.end,
      executionsUsed: 0,
      testRunsUsed: 0,
    },
  });

  return counter;
}

export async function incrementExecutionUsage(companyId: string, executionId: string): Promise<void> {
  const counter = await getOrCreateUsageCounter(companyId);

  // Avoid double counting by checking if execution was already counted
  const execution = await prisma.automationExecution.findUnique({
    where: { id: executionId },
    select: { metadata: true },
  });

  const metadata = (execution?.metadata && typeof execution.metadata === "object"
    ? execution.metadata
    : {}) as Record<string, unknown>;

  if (metadata.usageIncremented) {
    return;
  }

  await prisma.$transaction([
    prisma.automationUsageCounter.update({
      where: { id: counter.id },
      data: { executionsUsed: { increment: 1 } },
    }),
    prisma.automationExecution.update({
      where: { id: executionId },
      data: {
        metadata: {
          ...metadata,
          usageIncremented: true,
        },
      },
    }),
  ]);
}

export async function incrementTestRunUsage(companyId: string, testRunId: string): Promise<void> {
  const counter = await getOrCreateUsageCounter(companyId);
  const testRun = await prisma.automationTestRun.findFirst({
    where: { companyId, id: testRunId },
    select: { id: true },
  });

  if (!testRun) return;

  await prisma.automationUsageCounter.update({
    where: { id: counter.id },
    data: { testRunsUsed: { increment: 1 } },
  });
}

export async function getAutomationUsageSummary(companyId: string) {
  const period = await getCompanyUsagePeriod(companyId);
  const counter = await getOrCreateUsageCounter(companyId);
  const limits = await getCompanyPlanFeatures(companyId);

  const [flowsUsed, publishedFlowsUsed] = await Promise.all([
    prisma.automationFlow.count({
      where: { companyId, status: { not: "ARCHIVED" } },
    }),
    prisma.automationFlow.count({
      where: { companyId, status: "PUBLISHED" },
    }),
  ]);

  const calcPct = (used: number, max: number | null): number | null => {
    if (max === null || max === 0) return null;
    return Math.min(100, Math.round((used / max) * 100));
  };

  return {
    period: {
      start: period.start.toISOString(),
      end: period.end.toISOString(),
    },
    usage: {
      flowsUsed,
      publishedFlowsUsed,
      executionsUsed: counter.executionsUsed,
      testRunsUsed: counter.testRunsUsed,
    },
    limits: {
      flows: limits.maxFlows,
      publishedFlows: limits.maxPublishedFlows,
      executions: limits.monthlyExecutions,
      testRuns: limits.monthlyTestRuns,
    },
    percentages: {
      flows: calcPct(flowsUsed, limits.maxFlows),
      publishedFlows: calcPct(publishedFlowsUsed, limits.maxPublishedFlows),
      executions: calcPct(counter.executionsUsed, limits.monthlyExecutions),
      testRuns: calcPct(counter.testRunsUsed, limits.monthlyTestRuns),
    },
  };
}
