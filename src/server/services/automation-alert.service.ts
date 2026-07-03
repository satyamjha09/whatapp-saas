import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { sanitizeAlertMetadata } from "@/lib/monitoring/sanitize-alert-metadata";
import { createCompanyNotification } from "@/server/services/company-notification.service";
import type {
  AutomationAlertFilters,
  AutomationAlertListQuery,
} from "@/server/validators/automation-alert.validator";

export type AutomationAlertType =
  | "AUTOMATION_EXECUTION_FAILURE_SPIKE"
  | "AUTOMATION_NODE_FAILURE_SPIKE"
  | "AUTOMATION_RUNTIME_QUEUE_STUCK"
  | "AUTOMATION_RUNTIME_QUEUE_FAILED"
  | "WEBHOOK_QUEUE_FAILED"
  | "DEVELOPER_WEBHOOK_QUEUE_FAILED"
  | "MESSAGE_SEND_FAILURE_SPIKE"
  | "TALLY_CONNECTION_FAILED"
  | "GOOGLE_SHEET_AUTH_EXPIRED"
  | "CASHFREE_PAYMENT_LINK_FAILED"
  | "CASHFREE_WEBHOOK_DELAYED"
  | "AI_NODE_FAILED"
  | "WEBHOOK_NODE_FAILED"
  | "LOOP_DETECTED"
  | "DUPLICATE_EXECUTION_BLOCKED"
  | "INSUFFICIENT_WALLET_SPIKE"
  | "PLAN_LIMIT_REACHED"
  | "FLOW_BLOCKED_BY_PLAN"
  | "WAITING_SESSION_TIMEOUT_SPIKE"
  | "REDIS_UNHEALTHY"
  | "WORKER_UNHEALTHY"
  | "CUSTOM";

export type AutomationAlertSeverity = "INFO" | "WARNING" | "CRITICAL";
export type AutomationAlertStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "MUTED";

type AlertInput = {
  companyId: string;
  type: AutomationAlertType;
  severity: AutomationAlertSeverity;
  title: string;
  message: string;
  fingerprint: string;
  flowId?: string | null;
  flowVersionId?: string | null;
  executionId?: string | null;
  nodeId?: string | null;
  nodeType?: string | null;
  contactId?: string | null;
  queueName?: string | null;
  integrationType?: string | null;
  metadata?: unknown;
};

function toNotificationSeverity(severity: AutomationAlertSeverity) {
  return severity === "CRITICAL" ? "ERROR" : severity;
}

function oneHourAgo() {
  return new Date(Date.now() - 60 * 60 * 1000);
}

function buildWhere(
  companyId: string,
  filters: AutomationAlertFilters,
): Prisma.AutomationAlertWhereInput {
  return {
    companyId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.severity ? { severity: filters.severity } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.flowId ? { flowId: filters.flowId } : {}),
  };
}

function readNodeLabel(graph: Prisma.JsonValue | null | undefined, nodeId?: string | null) {
  if (!nodeId || !graph || typeof graph !== "object" || Array.isArray(graph)) return undefined;

  const nodes = (graph as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) return undefined;

  const node = nodes.find(
    (item) => item && typeof item === "object" && (item as { id?: unknown }).id === nodeId,
  );
  const data = node && typeof node === "object" ? (node as { data?: unknown }).data : undefined;

  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const label = (data as { label?: unknown }).label;

  return typeof label === "string" && label.trim() ? label.trim() : undefined;
}

function recommendedActions(type: AutomationAlertType) {
  const common = [
    {
      title: "Review execution logs",
      description: "Open recent failed executions and compare the first failing node.",
      actionUrl: "/dashboard/automation/executions?status=FAILED",
    },
  ];

  const map: Partial<
    Record<
      AutomationAlertType,
      Array<{ actionUrl?: string; description: string; title: string }>
    >
  > = {
    AUTOMATION_EXECUTION_FAILURE_SPIKE: [
      ...common,
      {
        title: "Run Live Test Mode",
        description: "Replay the flow in a controlled test before publishing new changes.",
        actionUrl: "/dashboard/automation/builder",
      },
    ],
    AUTOMATION_NODE_FAILURE_SPIKE: [
      ...common,
      {
        title: "Check node configuration",
        description: "Open the builder and inspect mappings, variables, URLs, credentials, and fallback paths.",
        actionUrl: "/dashboard/automation/builder",
      },
    ],
    AUTOMATION_RUNTIME_QUEUE_STUCK: [
      {
        title: "Check Redis and worker process",
        description: "Confirm Redis is reachable and the automation runtime worker is running.",
      },
    ],
    WEBHOOK_QUEUE_FAILED: [
      {
        title: "Check webhook worker logs",
        description: "Review inbound webhook processing errors and failed BullMQ jobs.",
      },
    ],
    DEVELOPER_WEBHOOK_QUEUE_FAILED: [
      {
        title: "Check developer webhook outbox",
        description: "Inspect failed deliveries and endpoint health.",
        actionUrl: "/dashboard/developer/webhooks/outbox",
      },
    ],
    TALLY_CONNECTION_FAILED: [
      {
        title: "Reconnect Tally",
        description: "Check the connector machine and run a safe lookup test.",
      },
    ],
    GOOGLE_SHEET_AUTH_EXPIRED: [
      {
        title: "Reconnect Google account",
        description: "Refresh OAuth consent and verify required Sheets scopes.",
        actionUrl: "/dashboard/integrations/google-sheets",
      },
    ],
    CASHFREE_PAYMENT_LINK_FAILED: [
      {
        title: "Check Cashfree setup",
        description: "Verify credentials, environment, and payment node configuration.",
      },
    ],
    AI_NODE_FAILED: [
      {
        title: "Check AI provider",
        description: "Verify API key, timeout, rate limits, and fallback routing.",
      },
    ],
    PLAN_LIMIT_REACHED: [
      {
        title: "Review plan usage",
        description: "Upgrade plan or pause lower priority automations.",
        actionUrl: "/dashboard/billing/upgrade",
      },
    ],
  };

  return map[type] ?? common;
}

async function notifyAlert(alert: {
  companyId: string;
  id: string;
  severity: AutomationAlertSeverity;
  title: string;
  message: string;
}) {
  await createCompanyNotification({
    companyId: alert.companyId,
    type: "SYSTEM",
    severity: toNotificationSeverity(alert.severity),
    title: alert.title,
    message: alert.message,
    actionHref: `/dashboard/automation/alerts/${alert.id}`,
    idempotencyKey: `automation-alert:${alert.id}`,
    metadata: {
      alertId: alert.id,
      source: "automation-monitoring",
      severity: alert.severity,
    },
  });
}

export async function createOrUpdateAlert(input: AlertInput) {
  const now = new Date();
  const sanitizedMetadata = sanitizeAlertMetadata(input.metadata);

  const existing = await prisma.automationAlert.findFirst({
    where: {
      companyId: input.companyId,
      fingerprint: input.fingerprint,
      status: {
        in: ["OPEN", "ACKNOWLEDGED", "MUTED"],
      },
    },
    orderBy: {
      lastSeenAt: "desc",
    },
  });

  if (existing) {
    const shouldReopen =
      existing.status === "ACKNOWLEDGED" && existing.lastSeenAt < oneHourAgo();

    return prisma.automationAlert.update({
      where: {
        id: existing.id,
      },
      data: {
        count: { increment: 1 },
        lastSeenAt: now,
        severity: input.severity,
        title: input.title,
        message: input.message,
        flowId: input.flowId ?? existing.flowId,
        flowVersionId: input.flowVersionId ?? existing.flowVersionId,
        executionId: input.executionId ?? existing.executionId,
        nodeId: input.nodeId ?? existing.nodeId,
        nodeType: input.nodeType ?? existing.nodeType,
        contactId: input.contactId ?? existing.contactId,
        queueName: input.queueName ?? existing.queueName,
        integrationType: input.integrationType ?? existing.integrationType,
        ...(sanitizedMetadata === undefined ? {} : { metadata: sanitizedMetadata }),
        ...(shouldReopen ? { status: "OPEN", acknowledgedAt: null, acknowledgedByUserId: null } : {}),
      },
    });
  }

  const alert = await prisma.automationAlert.create({
    data: {
      companyId: input.companyId,
      type: input.type,
      severity: input.severity,
      title: input.title,
      message: input.message,
      fingerprint: input.fingerprint,
      flowId: input.flowId ?? null,
      flowVersionId: input.flowVersionId ?? null,
      executionId: input.executionId ?? null,
      nodeId: input.nodeId ?? null,
      nodeType: input.nodeType ?? null,
      contactId: input.contactId ?? null,
      queueName: input.queueName ?? null,
      integrationType: input.integrationType ?? null,
      metadata: sanitizedMetadata,
      firstSeenAt: now,
      lastSeenAt: now,
    },
  });

  await notifyAlert(alert).catch((error) => {
    console.error("AUTOMATION_ALERT_NOTIFY_ERROR:", error);
  });

  return alert;
}

export async function listAlerts(
  companyId: string,
  filters: AutomationAlertListQuery,
) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const where = buildWhere(companyId, filters);

  const [alerts, total] = await Promise.all([
    prisma.automationAlert.findMany({
      where,
      include: {
        flow: { select: { id: true, name: true } },
        flowVersion: { select: { graph: true } },
      },
      orderBy: { lastSeenAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.automationAlert.count({ where }),
  ]);

  return {
    alerts: alerts.map((alert) => ({
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      status: alert.status,
      title: alert.title,
      message: alert.message,
      flowId: alert.flowId ?? undefined,
      flowName: alert.flow?.name,
      nodeId: alert.nodeId ?? undefined,
      nodeType: alert.nodeType ?? undefined,
      nodeLabel: readNodeLabel(alert.flowVersion?.graph, alert.nodeId),
      count: alert.count,
      firstSeenAt: alert.firstSeenAt.toISOString(),
      lastSeenAt: alert.lastSeenAt.toISOString(),
      acknowledgedAt: alert.acknowledgedAt?.toISOString(),
      resolvedAt: alert.resolvedAt?.toISOString(),
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getAlertDetail(companyId: string, alertId: string) {
  const alert = await prisma.automationAlert.findFirst({
    where: { companyId, id: alertId },
    include: {
      flow: { select: { id: true, name: true, status: true } },
      flowVersion: {
        select: { graph: true, id: true, versionNumber: true, publishedAt: true },
      },
      execution: {
        select: {
          id: true,
          status: true,
          startedAt: true,
          completedAt: true,
          errorMessage: true,
          failedNodeId: true,
          failedNodeType: true,
        },
      },
    },
  });

  if (!alert) return null;

  const relatedExecutions = await prisma.automationExecution.findMany({
    where: {
      companyId,
      ...(alert.flowId ? { flowId: alert.flowId } : {}),
      ...(alert.nodeId ? { failedNodeId: alert.nodeId } : { status: "FAILED" }),
      startedAt: {
        gte: new Date(alert.firstSeenAt.getTime() - 60 * 60 * 1000),
      },
    },
    orderBy: { startedAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      startedAt: true,
      errorMessage: true,
      failedNodeId: true,
      failedNodeType: true,
    },
  });

  const relatedSteps = await prisma.automationExecutionStep.findMany({
    where: {
      companyId,
      status: "FAILED",
      ...(alert.nodeId ? { nodeId: alert.nodeId } : {}),
      execution: alert.flowId ? { flowId: alert.flowId } : undefined,
      startedAt: {
        gte: new Date(alert.firstSeenAt.getTime() - 60 * 60 * 1000),
      },
    },
    orderBy: { startedAt: "desc" },
    take: 20,
    select: {
      executionId: true,
      nodeId: true,
      nodeType: true,
      status: true,
      errorMessage: true,
      startedAt: true,
    },
  });

  const nodeLabel = readNodeLabel(alert.flowVersion?.graph, alert.nodeId);

  return {
    alert: {
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      status: alert.status,
      title: alert.title,
      message: alert.message,
      count: alert.count,
      firstSeenAt: alert.firstSeenAt.toISOString(),
      lastSeenAt: alert.lastSeenAt.toISOString(),
      metadata: alert.metadata,
      queueName: alert.queueName,
      integrationType: alert.integrationType,
      flow: alert.flow,
      node: alert.nodeId
        ? {
            id: alert.nodeId,
            type: alert.nodeType,
            label: nodeLabel,
          }
        : null,
      execution: alert.execution
        ? {
            ...alert.execution,
            startedAt: alert.execution.startedAt.toISOString(),
            completedAt: alert.execution.completedAt?.toISOString(),
          }
        : null,
    },
    relatedExecutions: relatedExecutions.map((execution) => ({
      ...execution,
      startedAt: execution.startedAt.toISOString(),
    })),
    relatedSteps: relatedSteps.map((step) => ({
      ...step,
      startedAt: step.startedAt.toISOString(),
    })),
    recommendedActions: recommendedActions(alert.type),
  };
}

async function updateAlertStatus({
  alertId,
  companyId,
  data,
}: {
  alertId: string;
  companyId: string;
  data: Prisma.AutomationAlertUpdateInput;
}) {
  const result = await prisma.automationAlert.updateMany({
    where: { id: alertId, companyId },
    data,
  });

  if (result.count === 0) return null;

  return prisma.automationAlert.findFirst({
    where: { id: alertId, companyId },
  });
}

export function acknowledgeAlert(companyId: string, alertId: string, userId: string) {
  return updateAlertStatus({
    companyId,
    alertId,
    data: {
      status: "ACKNOWLEDGED",
      acknowledgedAt: new Date(),
      acknowledgedByUserId: userId,
    },
  });
}

export function resolveAlert(companyId: string, alertId: string, userId: string) {
  return updateAlertStatus({
    companyId,
    alertId,
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
      resolvedByUserId: userId,
    },
  });
}

export function muteAlert(companyId: string, alertId: string, userId: string) {
  return updateAlertStatus({
    companyId,
    alertId,
    data: {
      status: "MUTED",
      acknowledgedAt: new Date(),
      acknowledgedByUserId: userId,
    },
  });
}
