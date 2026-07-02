import { Prisma } from "@/generated/prisma/client";
import { graphFromJson } from "@/server/services/automation-context.service";
import { prisma } from "@/lib/prisma";
import type { AutomationGraph } from "@/lib/automation-builder/types";
import type { AutomationFlowAnalyticsQuery } from "@/server/validators/automation-analytics.validator";

type LoadedExecution = Awaited<ReturnType<typeof loadFlowExecutions>>[number];
type LoadedStep = LoadedExecution["steps"][number];

function jsonRecord(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function durationMs(startedAt: Date, completedAt?: Date | null) {
  if (!completedAt) return undefined;
  return Math.max(0, completedAt.getTime() - startedAt.getTime());
}

function percentage(part: number, total: number) {
  if (total <= 0) return 0;
  return Number(((part / total) * 100).toFixed(1));
}

function average(values: number[]) {
  const numbers = values.filter((value) => Number.isFinite(value));
  if (numbers.length === 0) return 0;

  return Math.round(
    numbers.reduce((total, value) => total + value, 0) / numbers.length,
  );
}

function resolveDateRange(filters: AutomationFlowAnalyticsQuery) {
  const endDate = filters.endDate ?? new Date();
  let startDate = filters.startDate;

  if (!startDate && filters.range !== "custom") {
    const ranges: Record<Exclude<typeof filters.range, "custom">, number> = {
      "24h": 1,
      "7d": 7,
      "30d": 30,
      "90d": 90,
    };
    const days = ranges[filters.range];
    startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
  }

  return {
    endDate,
    startDate:
      startDate ?? new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000),
  };
}

function graphNodeLabels(graph: AutomationGraph | null) {
  const labels = new Map<string, string>();

  graph?.nodes.forEach((node) => {
    const data = jsonRecord(node.data as unknown as Prisma.JsonValue);
    const label = typeof data.label === "string" ? data.label.trim() : "";
    if (label) labels.set(node.id, label);
  });

  return labels;
}

function topError(errors: string[]) {
  const counts = new Map<string, number>();

  errors.forEach((error) => {
    if (!error.trim()) return;
    counts.set(error, (counts.get(error) ?? 0) + 1);
  });

  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
}

async function loadFlowExecutions({
  companyId,
  endDate,
  flowId,
  flowVersionId,
  startDate,
}: {
  companyId: string;
  endDate: Date;
  flowId: string;
  flowVersionId?: string;
  startDate: Date;
}) {
  return prisma.automationExecution.findMany({
    where: {
      companyId,
      flowId,
      ...(flowVersionId ? { flowVersionId } : {}),
      startedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      flowVersion: {
        select: {
          graph: true,
          id: true,
          publishedAt: true,
          versionNumber: true,
        },
      },
      steps: {
        orderBy: {
          startedAt: "asc",
        },
      },
    },
    orderBy: {
      startedAt: "desc",
    },
  });
}

function getStepDuration(step: LoadedStep) {
  return step.durationMs ?? durationMs(step.startedAt, step.completedAt) ?? 0;
}

function createNodeKey(step: LoadedStep) {
  return `${step.nodeId}:${step.nodeType}`;
}

function isDropOffStep(step: LoadedStep, execution: LoadedExecution) {
  return (
    step.status === "FAILED" ||
    step.status === "WAITING" ||
    (step.nodeType === "HUMAN_HANDOFF" && step.status === "SUCCESS") ||
    (execution.status === "FAILED" && execution.failedNodeId === step.nodeId)
  );
}

function triggerKeyword(execution: LoadedExecution) {
  const payload = jsonRecord(execution.triggerPayload);
  const text = typeof payload.text === "string" ? payload.text : "";
  const keyword = text.trim().replace(/\s+/g, " ").toLowerCase();

  return keyword || "unknown";
}

export async function getFlowAnalytics(
  companyId: string,
  flowId: string,
  filters: AutomationFlowAnalyticsQuery,
) {
  const flow = await prisma.automationFlow.findFirst({
    where: {
      companyId,
      id: flowId,
    },
    include: {
      versions: {
        orderBy: {
          versionNumber: "desc",
        },
        select: {
          graph: true,
          id: true,
          publishedAt: true,
          versionNumber: true,
        },
      },
    },
  });

  if (!flow) return null;

  const { endDate, startDate } = resolveDateRange(filters);
  const executions = await loadFlowExecutions({
    companyId,
    endDate,
    flowId,
    flowVersionId: filters.flowVersionId,
    startDate,
  });
  const sessionWhere: Prisma.AutomationSessionWhereInput = {
    companyId,
    flowId,
    ...(filters.flowVersionId ? { flowVersionId: filters.flowVersionId } : {}),
    startedAt: {
      gte: startDate,
      lte: endDate,
    },
  };
  const sessionStatusCounts = await prisma.automationSession.groupBy({
    by: ["status"],
    where: sessionWhere,
    _count: {
      _all: true,
    },
  });
  const sessionCount = (status: string) =>
    sessionStatusCounts.find((item) => item.status === status)?._count._all ?? 0;
  const labelsByVersion = new Map<string, Map<string, string>>();

  flow.versions.forEach((version) => {
    labelsByVersion.set(version.id, graphNodeLabels(graphFromJson(version.graph)));
  });

  const labelFor = (versionId: string, nodeId: string) =>
    labelsByVersion.get(versionId)?.get(nodeId);

  const totalRuns = executions.length;
  const successfulRuns = executions.filter(
    (execution) => execution.status === "SUCCESS",
  ).length;
  const failedRuns = executions.filter(
    (execution) => execution.status === "FAILED",
  ).length;
  const waitingRuns = executions.filter(
    (execution) => execution.status === "WAITING",
  ).length;
  const completedDurations = executions
    .map((execution) =>
      execution.durationMs ?? durationMs(execution.startedAt, execution.completedAt),
    )
    .filter((value): value is number => typeof value === "number");
  const allSteps = executions.flatMap((execution) =>
    execution.steps.map((step) => ({ execution, step })),
  );
  const humanHandoffCount = allSteps.filter(
    ({ step }) => step.nodeType === "HUMAN_HANDOFF" && step.status === "SUCCESS",
  ).length;
  const paymentLinkCreatedCount = allSteps.filter(
    ({ step }) => step.nodeType === "PAYMENT_LINK" && step.status === "SUCCESS",
  ).length;
  const nodeGroups = new Map<
    string,
    {
      durations: number[];
      errors: string[];
      failedCount: number;
      nodeId: string;
      nodeLabel?: string;
      nodeType: string;
      skippedCount: number;
      successCount: number;
      totalVisits: number;
      waitingCount: number;
      dropOffCount: number;
    }
  >();

  allSteps.forEach(({ execution, step }) => {
    const key = createNodeKey(step);
    const existing =
      nodeGroups.get(key) ??
      {
        dropOffCount: 0,
        durations: [],
        errors: [],
        failedCount: 0,
        nodeId: step.nodeId,
        nodeLabel: labelFor(execution.flowVersionId, step.nodeId),
        nodeType: step.nodeType,
        skippedCount: 0,
        successCount: 0,
        totalVisits: 0,
        waitingCount: 0,
      };

    existing.totalVisits += 1;
    existing.durations.push(getStepDuration(step));

    if (step.status === "SUCCESS") existing.successCount += 1;
    if (step.status === "FAILED") existing.failedCount += 1;
    if (step.status === "WAITING") existing.waitingCount += 1;
    if (step.status === "SKIPPED") existing.skippedCount += 1;
    if (step.errorMessage) existing.errors.push(step.errorMessage);
    if (isDropOffStep(step, execution)) existing.dropOffCount += 1;

    nodeGroups.set(key, existing);
  });

  const nodeAnalytics = [...nodeGroups.values()]
    .map((node) => ({
      averageDurationMs: average(node.durations),
      dropOffCount: node.dropOffCount,
      dropOffRate: percentage(node.dropOffCount, node.totalVisits),
      failedCount: node.failedCount,
      mostCommonError: topError(node.errors),
      nodeId: node.nodeId,
      nodeLabel: node.nodeLabel,
      nodeType: node.nodeType,
      skippedCount: node.skippedCount,
      successCount: node.successCount,
      totalVisits: node.totalVisits,
      waitingCount: node.waitingCount,
    }))
    .sort((left, right) => right.totalVisits - left.totalVisits);
  const dropOffNodes = nodeAnalytics
    .filter((node) => node.dropOffCount > 0)
    .sort((left, right) => right.dropOffCount - left.dropOffCount)
    .slice(0, 8)
    .map((node) => ({
      dropOffCount: node.dropOffCount,
      dropOffRate: node.dropOffRate,
      nodeId: node.nodeId,
      nodeLabel: node.nodeLabel,
      nodeType: node.nodeType,
    }));
  const topFailedNodes = nodeAnalytics
    .filter((node) => node.failedCount > 0)
    .sort((left, right) => right.failedCount - left.failedCount)
    .slice(0, 8)
    .map((node) => ({
      failedCount: node.failedCount,
      lastError: node.mostCommonError,
      nodeId: node.nodeId,
      nodeLabel: node.nodeLabel,
      nodeType: node.nodeType,
    }));
  const versionGroups = new Map<
    string,
    {
      failedRuns: number;
      flowVersionId: string;
      publishedAt?: string;
      successfulRuns: number;
      totalRuns: number;
      versionNumber: number;
    }
  >();

  executions.forEach((execution) => {
    const existing =
      versionGroups.get(execution.flowVersionId) ??
      {
        failedRuns: 0,
        flowVersionId: execution.flowVersionId,
        publishedAt: execution.flowVersion.publishedAt.toISOString(),
        successfulRuns: 0,
        totalRuns: 0,
        versionNumber: execution.flowVersion.versionNumber,
      };

    existing.totalRuns += 1;
    if (execution.status === "SUCCESS") existing.successfulRuns += 1;
    if (execution.status === "FAILED") existing.failedRuns += 1;
    versionGroups.set(execution.flowVersionId, existing);
  });

  const keywordGroups = new Map<
    string,
    { count: number; failedCount: number; keyword: string; successCount: number }
  >();

  executions.forEach((execution) => {
    const keyword = triggerKeyword(execution);
    const group =
      keywordGroups.get(keyword) ??
      {
        count: 0,
        failedCount: 0,
        keyword,
        successCount: 0,
      };

    group.count += 1;
    if (execution.status === "SUCCESS") group.successCount += 1;
    if (execution.status === "FAILED") group.failedCount += 1;
    keywordGroups.set(keyword, group);
  });

  return {
    dateRange: {
      endDate: endDate.toISOString(),
      range: filters.range,
      startDate: startDate.toISOString(),
    },
    dropOffNodes,
    flow: {
      id: flow.id,
      name: flow.name,
      status: flow.status,
    },
    nodeAnalytics,
    summary: {
      activeSessions: sessionCount("ACTIVE"),
      averageExecutionTimeMs: average(completedDurations),
      completedSessions: sessionCount("COMPLETED"),
      failedRuns,
      failureRate: percentage(failedRuns, totalRuns),
      humanHandoffCount,
      pausedSessions: sessionCount("PAUSED"),
      paymentLinkCreatedCount,
      successRate: percentage(successfulRuns, totalRuns),
      successfulRuns,
      totalRuns,
      waitingRuns,
      waitingSessions: sessionCount("WAITING"),
    },
    topFailedNodes,
    topTriggerKeywords: [...keywordGroups.values()]
      .sort((left, right) => right.count - left.count)
      .slice(0, 8),
    versionBreakdown: [...versionGroups.values()]
      .map((version) => ({
        ...version,
        successRate: percentage(version.successfulRuns, version.totalRuns),
      }))
      .sort((left, right) => right.versionNumber - left.versionNumber),
    versions: flow.versions.map((version) => ({
      id: version.id,
      publishedAt: version.publishedAt.toISOString(),
      versionNumber: version.versionNumber,
    })),
  };
}
