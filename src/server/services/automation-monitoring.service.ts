import { prisma } from "@/lib/prisma";
import {
  createOrUpdateAlert,
  listAlerts,
  type AutomationAlertSeverity,
  type AutomationAlertType,
} from "@/server/services/automation-alert.service";
import {
  getRecentIntegrationFailures,
} from "@/server/services/integration-health.service";
import {
  getAllQueueHealth,
  getRedisHealth,
  type QueueHealth,
} from "@/server/services/queue-health.service";
import { getWorkerHeartbeatHealth } from "@/server/services/worker-heartbeat.service";
import type { MonitoringOverviewQuery } from "@/server/validators/automation-alert.validator";

type MonitoringRange = MonitoringOverviewQuery["range"];

const RANGE_MS: Record<MonitoringRange, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

function sinceMs(ms: number) {
  return new Date(Date.now() - ms);
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    const key = getKey(item);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  return grouped;
}

async function getAlertCompanyIds(companyId?: string) {
  if (companyId) return [companyId];

  const flows = await prisma.automationFlow.findMany({
    where: {
      status: "PUBLISHED",
    },
    distinct: ["companyId"],
    select: { companyId: true },
    take: 500,
  });

  return flows.map((flow) => flow.companyId);
}

function queueAlertType(queueName: string): AutomationAlertType {
  if (queueName === "webhook-queue") return "WEBHOOK_QUEUE_FAILED";
  if (queueName === "developer-webhook-queue" || queueName === "developer-webhook-outbox") {
    return "DEVELOPER_WEBHOOK_QUEUE_FAILED";
  }
  if (queueName === "automation-runtime-queue") return "AUTOMATION_RUNTIME_QUEUE_STUCK";

  return "AUTOMATION_RUNTIME_QUEUE_FAILED";
}

function queueSeverity(queue: QueueHealth): AutomationAlertSeverity {
  return queue.status === "UNHEALTHY" ? "CRITICAL" : "WARNING";
}

function integrationAlertType(integrationType: string): AutomationAlertType {
  if (integrationType === "TALLY") return "TALLY_CONNECTION_FAILED";
  if (integrationType === "GOOGLE_SHEETS") return "GOOGLE_SHEET_AUTH_EXPIRED";
  if (integrationType === "CASHFREE") return "CASHFREE_PAYMENT_LINK_FAILED";
  if (integrationType === "AI") return "AI_NODE_FAILED";
  if (integrationType === "WEBHOOK_API") return "WEBHOOK_NODE_FAILED";

  return "CUSTOM";
}

export async function checkAutomationFailureSpikes(companyId?: string) {
  const since = sinceMs(15 * 60 * 1000);
  const failedExecutions = await prisma.automationExecution.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      status: "FAILED",
      startedAt: { gte: since },
    },
    include: {
      flow: { select: { id: true, name: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 5000,
  });

  const alerts = [];
  const grouped = groupBy(
    failedExecutions,
    (execution) => `${execution.companyId}:${execution.flowId}`,
  );

  for (const executions of grouped.values()) {
    if (executions.length < 5) continue;

    const latest = executions[0];
    const severity = executions.length >= 20 ? "CRITICAL" : "WARNING";
    alerts.push(
      await createOrUpdateAlert({
        companyId: latest.companyId,
        type: "AUTOMATION_EXECUTION_FAILURE_SPIKE",
        severity,
        title: `${latest.flow.name} has repeated failed runs`,
        message: `${executions.length} executions failed in the last 15 minutes.`,
        fingerprint: `${latest.companyId}:AUTOMATION_EXECUTION_FAILURE_SPIKE:${latest.flowId}`,
        flowId: latest.flowId,
        flowVersionId: latest.flowVersionId,
        executionId: latest.id,
        metadata: {
          code: "AUTOMATION_NODE_FAILED",
          failedCount: executions.length,
          windowMinutes: 15,
          sampleError: latest.errorMessage,
        },
      }),
    );
  }

  return alerts;
}

export async function checkNodeFailureSpikes(companyId?: string) {
  const since = sinceMs(15 * 60 * 1000);
  const failedSteps = await prisma.automationExecutionStep.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      status: "FAILED",
      startedAt: { gte: since },
    },
    include: {
      execution: {
        include: {
          flow: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { startedAt: "desc" },
    take: 5000,
  });

  const alerts = [];
  const grouped = groupBy(
    failedSteps,
    (step) => `${step.companyId}:${step.execution.flowId}:${step.nodeId}`,
  );

  for (const steps of grouped.values()) {
    if (steps.length < 5) continue;

    const latest = steps[0];
    const nodeType = latest.nodeType.toUpperCase();
    const type: AutomationAlertType = nodeType.includes("AI")
      ? "AI_NODE_FAILED"
      : nodeType.includes("WEBHOOK") || nodeType.includes("API")
        ? "WEBHOOK_NODE_FAILED"
        : "AUTOMATION_NODE_FAILURE_SPIKE";

    alerts.push(
      await createOrUpdateAlert({
        companyId: latest.companyId,
        type,
        severity: "WARNING",
        title: `${latest.nodeType} node is failing repeatedly`,
        message: `${steps.length} failures happened on the same node in ${latest.execution.flow.name}.`,
        fingerprint: `${latest.companyId}:${type}:${latest.execution.flowId}:${latest.nodeId}`,
        flowId: latest.execution.flowId,
        flowVersionId: latest.execution.flowVersionId,
        executionId: latest.executionId,
        nodeId: latest.nodeId,
        nodeType: latest.nodeType,
        metadata: {
          code: type === "AI_NODE_FAILED" ? "AI_PROVIDER_FAILED" : "AUTOMATION_NODE_FAILED",
          failedCount: steps.length,
          windowMinutes: 15,
          sampleError: latest.errorMessage,
        },
      }),
    );
  }

  return alerts;
}

export async function checkMessageSendFailureSpikes(companyId?: string) {
  const since = sinceMs(15 * 60 * 1000);
  const failedMessages = await prisma.message.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      direction: "OUTBOUND",
      status: "FAILED",
      updatedAt: { gte: since },
    },
    orderBy: { updatedAt: "desc" },
    take: 5000,
  });

  const alerts = [];
  const grouped = groupBy(failedMessages, (message) => message.companyId);

  for (const messages of grouped.values()) {
    if (messages.length < 10) continue;

    const latest = messages[0];
    alerts.push(
      await createOrUpdateAlert({
        companyId: latest.companyId,
        type: "MESSAGE_SEND_FAILURE_SPIKE",
        severity: "CRITICAL",
        title: "WhatsApp message sending failures increased",
        message: `${messages.length} outbound messages failed in the last 15 minutes.`,
        fingerprint: `${latest.companyId}:MESSAGE_SEND_FAILURE_SPIKE`,
        contactId: latest.contactId,
        metadata: {
          code: "MESSAGE_SEND_FAILED",
          failedCount: messages.length,
          windowMinutes: 15,
          sampleMessageId: latest.id,
          sampleError: latest.errorMessage,
          sampleErrorCode: latest.errorCode,
        },
      }),
    );
  }

  return alerts;
}

export async function checkQueueHealth(companyId?: string) {
  const [queues, redis, workerHealth] = await Promise.all([
    getAllQueueHealth(),
    getRedisHealth(),
    getWorkerHeartbeatHealth(),
  ]);
  const companyIds = await getAlertCompanyIds(companyId);
  const alerts = [];

  for (const scopedCompanyId of companyIds) {
    if (!redis.ok) {
      alerts.push(
        await createOrUpdateAlert({
          companyId: scopedCompanyId,
          type: "REDIS_UNHEALTHY",
          severity: "CRITICAL",
          title: "Redis/BullMQ is unhealthy",
          message: redis.error ?? "Redis did not respond to health check.",
          fingerprint: `${scopedCompanyId}:REDIS_UNHEALTHY`,
          metadata: {
            code: "QUEUE_STUCK",
            redis,
          },
        }),
      );
    }

    if (workerHealth.unhealthyWorkers.length > 0) {
      alerts.push(
        await createOrUpdateAlert({
          companyId: scopedCompanyId,
          type: "WORKER_UNHEALTHY",
          severity: "CRITICAL",
          title: "Automation worker health issue",
          message: `${workerHealth.unhealthyWorkers.length} worker process(es) are missing, stale, or unhealthy.`,
          fingerprint: `${scopedCompanyId}:WORKER_UNHEALTHY`,
          metadata: {
            code: "QUEUE_JOB_FAILED",
            unhealthyWorkers: workerHealth.unhealthyWorkers,
          },
        }),
      );
    }

    for (const queue of queues.filter((item) => item.status !== "HEALTHY")) {
      const oldestAgeMs = Math.max(
        queue.oldestWaitingJobAgeMs ?? 0,
        queue.oldestDelayedJobAgeMs ?? 0,
      );

      alerts.push(
        await createOrUpdateAlert({
          companyId: scopedCompanyId,
          type: queueAlertType(queue.queueName),
          severity: queueSeverity(queue),
          title: `${queue.queueName} is ${queue.status.toLowerCase()}`,
          message: `Queue has ${queue.waiting} waiting, ${queue.delayed} delayed, and ${queue.failed} failed jobs.`,
          fingerprint: `${scopedCompanyId}:${queueAlertType(queue.queueName)}:${queue.queueName}`,
          queueName: queue.queueName,
          metadata: {
            code: oldestAgeMs >= 10 * 60 * 1000 ? "QUEUE_STUCK" : "QUEUE_JOB_FAILED",
            ...queue,
            oldestAgeMs,
          },
        }),
      );
    }
  }

  return alerts;
}

export async function checkIntegrationFailures(companyId?: string) {
  const issues = await getRecentIntegrationFailures({
    companyId,
    since: sinceMs(15 * 60 * 1000),
  });
  const alerts = [];

  for (const issue of issues) {
    const type = integrationAlertType(issue.integrationType);
    alerts.push(
      await createOrUpdateAlert({
        companyId: companyId ?? issue.fingerprint.split(":")[0],
        type,
        severity: issue.severity,
        title: issue.title,
        message: `${issue.failedCount} recent failures in ${issue.flowName ?? "automation flow"}.`,
        fingerprint: `${issue.fingerprint}:${type}`,
        flowId: issue.flowId,
        nodeId: issue.nodeId,
        nodeType: issue.nodeType,
        integrationType: issue.integrationType,
        metadata: {
          code:
            type === "GOOGLE_SHEET_AUTH_EXPIRED"
              ? "INTEGRATION_AUTH_EXPIRED"
              : type === "CASHFREE_PAYMENT_LINK_FAILED"
                ? "PAYMENT_LINK_CREATE_FAILED"
                : type === "WEBHOOK_NODE_FAILED"
                  ? "WEBHOOK_CALL_FAILED"
                  : "INTEGRATION_TIMEOUT",
          failedCount: issue.failedCount,
          sampleError: issue.sampleError,
        },
      }),
    );
  }

  return alerts;
}

export async function checkPlanLimitAlerts(companyId?: string) {
  const since = sinceMs(60 * 60 * 1000);
  const failedExecutions = await prisma.automationExecution.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      status: "FAILED",
      startedAt: { gte: since },
      OR: [
        { errorMessage: { contains: "plan", mode: "insensitive" } },
        { errorMessage: { contains: "limit", mode: "insensitive" } },
        { errorMessage: { contains: "quota", mode: "insensitive" } },
      ],
    },
    include: { flow: { select: { name: true } } },
    orderBy: { startedAt: "desc" },
    take: 1000,
  });

  const alerts = [];
  const grouped = groupBy(
    failedExecutions,
    (execution) => `${execution.companyId}:${execution.flowId}`,
  );

  for (const executions of grouped.values()) {
    const latest = executions[0];
    alerts.push(
      await createOrUpdateAlert({
        companyId: latest.companyId,
        type: "PLAN_LIMIT_REACHED",
        severity: "WARNING",
        title: `${latest.flow.name} hit an automation plan limit`,
        message: `${executions.length} execution(s) failed due to plan, quota, or feature limits in the last hour.`,
        fingerprint: `${latest.companyId}:PLAN_LIMIT_REACHED:${latest.flowId}`,
        flowId: latest.flowId,
        flowVersionId: latest.flowVersionId,
        executionId: latest.id,
        metadata: {
          code: "PLAN_LIMIT_EXCEEDED",
          failedCount: executions.length,
          sampleError: latest.errorMessage,
        },
      }),
    );
  }

  return alerts;
}

export async function checkWaitingSessionTimeoutSpikes(companyId?: string) {
  const since = sinceMs(60 * 60 * 1000);
  const timedOutSessions = await prisma.automationSession.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      waitingForReply: true,
      replyTimeoutAt: {
        gte: since,
        lte: new Date(),
      },
    },
    include: { flow: { select: { name: true } } },
    orderBy: { replyTimeoutAt: "desc" },
    take: 5000,
  });

  const alerts = [];
  const grouped = groupBy(
    timedOutSessions,
    (session) => `${session.companyId}:${session.flowId}`,
  );

  for (const sessions of grouped.values()) {
    if (sessions.length < 10) continue;

    const latest = sessions[0];
    alerts.push(
      await createOrUpdateAlert({
        companyId: latest.companyId,
        type: "WAITING_SESSION_TIMEOUT_SPIKE",
        severity: "WARNING",
        title: `${latest.flow.name} has many reply timeouts`,
        message: `${sessions.length} sessions crossed reply timeout in the last hour.`,
        fingerprint: `${latest.companyId}:WAITING_SESSION_TIMEOUT_SPIKE:${latest.flowId}`,
        flowId: latest.flowId,
        flowVersionId: latest.flowVersionId,
        contactId: latest.contactId,
        nodeId: latest.waitingNodeId,
        metadata: {
          code: "INTEGRATION_TIMEOUT",
          timeoutCount: sessions.length,
          windowMinutes: 60,
        },
      }),
    );
  }

  return alerts;
}

export async function checkPaymentWebhookDelays(companyId?: string) {
  const staleBefore = sinceMs(30 * 60 * 1000);
  const staleCheckouts = await prisma.planCheckout.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      status: "CREATED",
      createdAt: { lte: staleBefore },
      cashfreeOrderId: { not: null },
      webhookProcessedAt: null,
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  const alerts = [];
  const grouped = groupBy(staleCheckouts, (checkout) => checkout.companyId);

  for (const checkouts of grouped.values()) {
    const latest = checkouts[0];
    alerts.push(
      await createOrUpdateAlert({
        companyId: latest.companyId,
        type: "CASHFREE_WEBHOOK_DELAYED",
        severity: "WARNING",
        title: "Cashfree webhook appears delayed",
        message: `${checkouts.length} payment checkout(s) are still awaiting webhook processing.`,
        fingerprint: `${latest.companyId}:CASHFREE_WEBHOOK_DELAYED`,
        integrationType: "CASHFREE",
        metadata: {
          code: "PAYMENT_LINK_CREATE_FAILED",
          pendingCount: checkouts.length,
          oldestCheckoutId: latest.id,
          oldestCreatedAt: latest.createdAt,
        },
      }),
    );
  }

  return alerts;
}

export async function checkWalletFailureSpikes(companyId?: string) {
  const since = sinceMs(60 * 60 * 1000);
  const failedExecutions = await prisma.automationExecution.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      status: "FAILED",
      startedAt: { gte: since },
      OR: [
        { errorMessage: { contains: "wallet", mode: "insensitive" } },
        { errorMessage: { contains: "insufficient", mode: "insensitive" } },
        { errorMessage: { contains: "balance", mode: "insensitive" } },
      ],
    },
    orderBy: { startedAt: "desc" },
    take: 1000,
  });

  const alerts = [];
  const grouped = groupBy(failedExecutions, (execution) => execution.companyId);

  for (const executions of grouped.values()) {
    if (executions.length < 5) continue;

    const latest = executions[0];
    alerts.push(
      await createOrUpdateAlert({
        companyId: latest.companyId,
        type: "INSUFFICIENT_WALLET_SPIKE",
        severity: "WARNING",
        title: "Automation wallet failures increased",
        message: `${executions.length} automation execution(s) failed due to wallet/balance checks in the last hour.`,
        fingerprint: `${latest.companyId}:INSUFFICIENT_WALLET_SPIKE`,
        executionId: latest.id,
        metadata: {
          code: "INSUFFICIENT_WALLET",
          failedCount: executions.length,
          sampleError: latest.errorMessage,
        },
      }),
    );
  }

  return alerts;
}

export async function runAutomationMonitoringChecks(companyId?: string) {
  const results = await Promise.all([
    checkAutomationFailureSpikes(companyId),
    checkNodeFailureSpikes(companyId),
    checkMessageSendFailureSpikes(companyId),
    checkQueueHealth(companyId),
    checkIntegrationFailures(companyId),
    checkPlanLimitAlerts(companyId),
    checkWaitingSessionTimeoutSpikes(companyId),
    checkPaymentWebhookDelays(companyId),
    checkWalletFailureSpikes(companyId),
  ]);

  return {
    createdOrUpdatedAlerts: results.flat().length,
    checkedAt: new Date().toISOString(),
  };
}

export async function getMonitoringOverview(
  companyId: string,
  filters: MonitoringOverviewQuery,
) {
  const since = sinceMs(RANGE_MS[filters.range]);
  const last24h = sinceMs(24 * 60 * 60 * 1000);

  const [
    alertCounts,
    failedExecutionsLast24h,
    executionsLast24h,
    queues,
    recentAlerts,
    recentExecutions,
    failedSteps,
  ] = await Promise.all([
    prisma.automationAlert.groupBy({
      by: ["severity", "status"],
      where: {
        companyId,
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
      },
      _count: { _all: true },
    }),
    prisma.automationExecution.count({
      where: { companyId, status: "FAILED", startedAt: { gte: last24h } },
    }),
    prisma.automationExecution.count({
      where: { companyId, startedAt: { gte: last24h } },
    }),
    getAllQueueHealth(),
    listAlerts(companyId, { page: 1, pageSize: 5 }),
    prisma.automationExecution.findMany({
      where: { companyId, startedAt: { gte: since } },
      include: { flow: { select: { id: true, name: true } } },
      orderBy: { startedAt: "desc" },
      take: 5000,
    }),
    prisma.automationExecutionStep.findMany({
      where: {
        companyId,
        status: "FAILED",
        startedAt: { gte: since },
      },
      include: {
        execution: {
          include: { flow: { select: { id: true, name: true } } },
        },
      },
      orderBy: { startedAt: "desc" },
      take: 5000,
    }),
  ]);
  const planLimitIssues = await prisma.automationAlert.count({
    where: {
      companyId,
      status: { in: ["OPEN", "ACKNOWLEDGED"] },
      type: { in: ["PLAN_LIMIT_REACHED", "FLOW_BLOCKED_BY_PLAN"] },
    },
  });

  const openAlerts = alertCounts.reduce(
    (sum, item) => sum + (item.status === "OPEN" ? item._count._all : 0),
    0,
  );
  const criticalAlerts = alertCounts.reduce(
    (sum, item) => sum + (item.severity === "CRITICAL" ? item._count._all : 0),
    0,
  );
  const warningAlerts = alertCounts.reduce(
    (sum, item) => sum + (item.severity === "WARNING" ? item._count._all : 0),
    0,
  );
  const queueIssues = queues.filter((queue) => queue.status !== "HEALTHY").length;

  const flowGroups = groupBy(recentExecutions, (execution) => execution.flowId);
  const topFailingFlows = [...flowGroups.values()]
    .map((executions) => {
      const failedCount = executions.filter((execution) => execution.status === "FAILED").length;
      const first = executions[0];

      return {
        flowId: first.flowId,
        flowName: first.flow.name,
        failedCount,
        failureRate: executions.length > 0 ? failedCount / executions.length : 0,
      };
    })
    .filter((flow) => flow.failedCount > 0)
    .sort((left, right) => right.failedCount - left.failedCount)
    .slice(0, 5);

  const nodeGroups = groupBy(
    failedSteps,
    (step) => `${step.execution.flowId}:${step.nodeId}`,
  );
  const topFailingNodes = [...nodeGroups.values()]
    .map((steps) => {
      const first = steps[0];

      return {
        flowId: first.execution.flowId,
        flowName: first.execution.flow.name,
        nodeId: first.nodeId,
        nodeType: first.nodeType,
        failedCount: steps.length,
      };
    })
    .sort((left, right) => right.failedCount - left.failedCount)
    .slice(0, 5);

  const healthStatus =
    criticalAlerts > 0 || queues.some((queue) => queue.status === "UNHEALTHY")
      ? "UNHEALTHY"
      : openAlerts > 0 || queueIssues > 0
        ? "DEGRADED"
        : "HEALTHY";

  return {
    healthStatus,
    summary: {
      openAlerts,
      criticalAlerts,
      warningAlerts,
      failedExecutionsLast24h,
      failureRateLast24h:
        executionsLast24h > 0 ? failedExecutionsLast24h / executionsLast24h : 0,
      queueIssues,
      integrationIssues: openAlerts,
      planLimitIssues,
    },
    queues: queues.map((queue) => ({
      queueName: queue.queueName,
      status: queue.status,
      waiting: queue.waiting,
      active: queue.active,
      delayed: queue.delayed,
      failed: queue.failed,
      oldestJobAgeMs: Math.max(
        queue.oldestWaitingJobAgeMs ?? 0,
        queue.oldestDelayedJobAgeMs ?? 0,
      ),
    })),
    topFailingFlows,
    topFailingNodes,
    recentAlerts: recentAlerts.alerts,
  };
}
