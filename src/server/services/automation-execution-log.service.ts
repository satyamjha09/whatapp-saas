import { Prisma } from "@/generated/prisma/client";
import type { AutomationExecutionStatus } from "@/generated/prisma/enums";
import { graphFromJson } from "@/server/services/automation-context.service";
import { prisma } from "@/lib/prisma";
import {
  maskAutomationPhoneNumber,
  sanitizeAutomationLogValue,
} from "@/lib/automation-builder/sanitize-execution-log";
import type { AutomationGraph } from "@/lib/automation-builder/types";
import type { AutomationExecutionListQuery } from "@/server/validators/automation-analytics.validator";

type ExecutionWithRelations = NonNullable<
  Awaited<ReturnType<typeof getExecutionRecord>>
>;

function toIso(date: Date | null | undefined) {
  return date?.toISOString();
}

function computeDurationMs(startedAt: Date, completedAt?: Date | null) {
  if (!completedAt) return undefined;
  return Math.max(0, completedAt.getTime() - startedAt.getTime());
}

function jsonRecord(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getNodeLabelMap(graph: AutomationGraph | null) {
  const labels = new Map<string, string>();

  graph?.nodes.forEach((node) => {
    const data = jsonRecord(node.data as unknown as Prisma.JsonValue);
    const label = typeof data.label === "string" ? data.label.trim() : "";
    if (label) labels.set(node.id, label);
  });

  return labels;
}

function mapContact(
  contact:
    | {
        countryCode: string;
        email?: string | null;
        id: string;
        name: string | null;
        phoneNumber: string;
      }
    | null
    | undefined,
  { masked = false }: { masked?: boolean } = {},
) {
  if (!contact) return null;

  return {
    countryCode: contact.countryCode,
    email: contact.email ?? undefined,
    id: contact.id,
    name: contact.name ?? undefined,
    phoneNumber: masked
      ? maskAutomationPhoneNumber(`${contact.countryCode}${contact.phoneNumber}`)
      : `${contact.countryCode}${contact.phoneNumber}`,
  };
}

async function findContacts(companyId: string, contactIds: string[]) {
  if (contactIds.length === 0) {
    return new Map<
      string,
      {
        countryCode: string;
        email: string | null;
        id: string;
        name: string | null;
        phoneNumber: string;
      }
    >();
  }

  const contacts = await prisma.contact.findMany({
    where: {
      companyId,
      id: {
        in: [...new Set(contactIds)],
      },
    },
    select: {
      countryCode: true,
      email: true,
      id: true,
      name: true,
      phoneNumber: true,
    },
  });

  return new Map(contacts.map((contact) => [contact.id, contact]));
}

async function getExecutionRecord(companyId: string, executionId: string) {
  return prisma.automationExecution.findFirst({
    where: {
      companyId,
      id: executionId,
    },
    include: {
      flow: {
        select: {
          id: true,
          name: true,
          status: true,
        },
      },
      flowVersion: {
        select: {
          graph: true,
          id: true,
          publishedAt: true,
          versionNumber: true,
        },
      },
      session: {
        select: {
          contactId: true,
          currentNodeId: true,
          endedAt: true,
          id: true,
          startedAt: true,
          status: true,
          waitingForReply: true,
        },
      },
      steps: {
        orderBy: {
          startedAt: "asc",
        },
      },
    },
  });
}

function statusTimelineType(
  status: AutomationExecutionStatus,
): "EXECUTION_COMPLETED" | "EXECUTION_FAILED" {
  return status === "FAILED" ? "EXECUTION_FAILED" : "EXECUTION_COMPLETED";
}

function buildTimeline({
  execution,
  labels,
}: {
  execution: ExecutionWithRelations;
  labels: Map<string, string>;
}) {
  const timeline: Array<{
    description?: string;
    nodeId?: string;
    timestamp: string;
    title: string;
    type:
      | "EXECUTION_STARTED"
      | "NODE_STARTED"
      | "NODE_COMPLETED"
      | "NODE_FAILED"
      | "WAITING_FOR_REPLY"
      | "HUMAN_HANDOFF"
      | "EXECUTION_COMPLETED"
      | "EXECUTION_FAILED";
  }> = [
    {
      timestamp: execution.startedAt.toISOString(),
      title: "Execution started",
      type: "EXECUTION_STARTED",
    },
  ];

  execution.steps.forEach((step) => {
    const nodeLabel = labels.get(step.nodeId) ?? step.nodeType;

    timeline.push({
      description: step.nodeType,
      nodeId: step.nodeId,
      timestamp: step.startedAt.toISOString(),
      title: `${nodeLabel} started`,
      type: "NODE_STARTED",
    });

    if (!step.completedAt) return;

    if (step.status === "FAILED") {
      timeline.push({
        description: step.errorMessage ?? undefined,
        nodeId: step.nodeId,
        timestamp: step.completedAt.toISOString(),
        title: `${nodeLabel} failed`,
        type: "NODE_FAILED",
      });
      return;
    }

    if (step.status === "WAITING") {
      timeline.push({
        nodeId: step.nodeId,
        timestamp: step.completedAt.toISOString(),
        title: `${nodeLabel} is waiting for reply`,
        type: "WAITING_FOR_REPLY",
      });
      return;
    }

    if (step.nodeType === "HUMAN_HANDOFF") {
      timeline.push({
        nodeId: step.nodeId,
        timestamp: step.completedAt.toISOString(),
        title: `${nodeLabel} handed off to team`,
        type: "HUMAN_HANDOFF",
      });
      return;
    }

    timeline.push({
      nodeId: step.nodeId,
      timestamp: step.completedAt.toISOString(),
      title: `${nodeLabel} completed`,
      type: "NODE_COMPLETED",
    });
  });

  if (execution.completedAt) {
    timeline.push({
      description: execution.errorMessage ?? undefined,
      timestamp: execution.completedAt.toISOString(),
      title: execution.status === "FAILED" ? "Execution failed" : "Execution completed",
      type: statusTimelineType(execution.status),
    });
  }

  return timeline.sort((left, right) =>
    left.timestamp.localeCompare(right.timestamp),
  );
}

export async function getAutomationExecutionList(
  companyId: string,
  filters: AutomationExecutionListQuery,
) {
  const where: Prisma.AutomationExecutionWhereInput = {
    companyId,
    ...(filters.flowId ? { flowId: filters.flowId } : {}),
    ...(filters.flowVersionId ? { flowVersionId: filters.flowVersionId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.triggerType ? { triggerType: filters.triggerType } : {}),
    ...(filters.startDate || filters.endDate
      ? {
          startedAt: {
            ...(filters.startDate ? { gte: filters.startDate } : {}),
            ...(filters.endDate ? { lte: filters.endDate } : {}),
          },
        }
      : {}),
  };

  if (filters.contactSearch) {
    const search = filters.contactSearch;
    const contacts = await prisma.contact.findMany({
      where: {
        companyId,
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { phoneNumber: { contains: search } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
      },
      take: 250,
    });

    where.session = {
      contactId: {
        in: contacts.map((contact) => contact.id),
      },
    };
  }

  const skip = (filters.page - 1) * filters.pageSize;
  const [total, executions] = await prisma.$transaction([
    prisma.automationExecution.count({ where }),
    prisma.automationExecution.findMany({
      where,
      include: {
        _count: {
          select: {
            steps: true,
          },
        },
        flow: {
          select: {
            id: true,
            name: true,
          },
        },
        flowVersion: {
          select: {
            id: true,
            versionNumber: true,
          },
        },
        session: {
          select: {
            contactId: true,
          },
        },
      },
      orderBy: {
        startedAt: "desc",
      },
      skip,
      take: filters.pageSize,
    }),
  ]);
  const contacts = await findContacts(
    companyId,
    executions
      .map((execution) => execution.session?.contactId)
      .filter((contactId): contactId is string => Boolean(contactId)),
  );
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

  return {
    executions: executions.map((execution) => {
      const contact = execution.session?.contactId
        ? contacts.get(execution.session.contactId)
        : null;

      return {
        completedAt: toIso(execution.completedAt),
        contact: mapContact(contact, { masked: true }),
        durationMs:
          execution.durationMs ??
          computeDurationMs(execution.startedAt, execution.completedAt),
        errorMessage: execution.errorMessage ?? undefined,
        failedNodeId: execution.failedNodeId ?? undefined,
        failedNodeType: execution.failedNodeType ?? undefined,
        flowId: execution.flowId,
        flowName: execution.flow.name,
        flowVersionId: execution.flowVersionId,
        id: execution.id,
        startedAt: execution.startedAt.toISOString(),
        status: execution.status,
        stepCount: execution._count.steps,
        triggerType: execution.triggerType ?? undefined,
        versionNumber: execution.flowVersion.versionNumber,
      };
    }),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total,
      totalPages,
    },
  };
}

export async function getAutomationExecutionDetail(
  companyId: string,
  executionId: string,
) {
  const execution = await getExecutionRecord(companyId, executionId);

  if (!execution) return null;

  const graph = graphFromJson(execution.flowVersion.graph);
  const labels = getNodeLabelMap(graph);
  const contacts = await findContacts(
    companyId,
    execution.session?.contactId ? [execution.session.contactId] : [],
  );
  const contact = execution.session?.contactId
    ? contacts.get(execution.session.contactId)
    : null;

  return {
    execution: {
      companyId: execution.companyId,
      completedAt: toIso(execution.completedAt),
      contact: mapContact(contact),
      durationMs:
        execution.durationMs ??
        computeDurationMs(execution.startedAt, execution.completedAt),
      errorMessage: execution.errorMessage ?? undefined,
      flowId: execution.flowId,
      flowName: execution.flow.name,
      flowVersionId: execution.flowVersionId,
      id: execution.id,
      session: execution.session
        ? {
            currentNodeId: execution.session.currentNodeId ?? undefined,
            endedAt: toIso(execution.session.endedAt),
            id: execution.session.id,
            startedAt: execution.session.startedAt.toISOString(),
            status: execution.session.status,
            waitingForReply: execution.session.waitingForReply,
          }
        : null,
      startedAt: execution.startedAt.toISOString(),
      status: execution.status,
      triggerMessageId: execution.triggerMessageId ?? undefined,
      triggerPayload: sanitizeAutomationLogValue(execution.triggerPayload),
      triggerType: execution.triggerType ?? undefined,
      versionNumber: execution.flowVersion.versionNumber,
    },
    graph: sanitizeAutomationLogValue(
      graph ?? {
        edges: [],
        nodes: [],
        version: 1,
      },
    ),
    steps: execution.steps.map((step) => ({
      completedAt: toIso(step.completedAt),
      durationMs:
        step.durationMs ?? computeDurationMs(step.startedAt, step.completedAt),
      errorMessage: step.errorMessage ?? undefined,
      id: step.id,
      input: sanitizeAutomationLogValue(step.input),
      nodeId: step.nodeId,
      nodeLabel: labels.get(step.nodeId),
      nodeType: step.nodeType,
      output: sanitizeAutomationLogValue(step.output),
      sourceHandle: step.sourceHandle ?? undefined,
      startedAt: step.startedAt.toISOString(),
      status: step.status,
      targetNodeId: step.targetNodeId ?? undefined,
    })),
    timeline: buildTimeline({ execution, labels }),
  };
}
