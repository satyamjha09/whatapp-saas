import { Prisma } from "@/generated/prisma/client";
import type { AutomationTriggerType } from "@/generated/prisma/enums";
import { getAutomationRuntimeQueue } from "@/lib/queue";
import type { AutomationRuntimeJobData } from "@/lib/queue";
import type { AutomationGraph, AutomationNode } from "@/lib/automation-builder/types";
import { resolveSourceHandleId } from "@/lib/automation-builder/connection-handles";
import { validateAutomationGraph } from "@/lib/automation-builder/graph-validation";
import { prisma } from "@/lib/prisma";
import {
  asRecord,
  createAutomationContext,
  extractInboundTrigger,
  getAutomationContext,
  graphFromJson,
  safeJson,
  setAutomationContextValue,
  setNodeOutput,
  type AutomationContext,
  type AutomationRuntimeContact,
  type AutomationRuntimeMessage,
} from "@/server/services/automation-context.service";
import { executeAutomationNode } from "@/server/services/automation-node-executor.service";
import {
  completeAutomationSession,
  expireAutomationSession,
  failAutomationSession,
  findActiveAutomationSession,
  findExpiredWaitingAutomationSessions,
  markAutomationSessionActive,
  startAutomationSession,
  updateAutomationSessionContext,
} from "@/server/services/automation-session.service";
import {
  findMatchingPublishedAutomationFlow,
  type PublishedAutomationFlowMatch,
} from "@/server/services/automation-trigger-matcher.service";

export const MAX_AUTOMATION_STEPS_PER_RUN = 50;
const MAX_AUTOMATION_NODE_VISITS_PER_RUN = 5;

type LoadedInboundMessage = AutomationRuntimeMessage & {
  contact: AutomationRuntimeContact;
};

type RuntimeSession = Awaited<ReturnType<typeof findActiveAutomationSession>>;

function asErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown automation error";
}

function durationMs(startedAt: Date, completedAt: Date) {
  return Math.max(0, completedAt.getTime() - startedAt.getTime());
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

function mapContact(contact: LoadedInboundMessage["contact"]): AutomationRuntimeContact {
  return {
    companyName: contact.companyName,
    countryCode: contact.countryCode,
    email: contact.email,
    id: contact.id,
    lifecycleStage: contact.lifecycleStage,
    name: contact.name,
    phoneNumber: contact.phoneNumber,
    source: contact.source,
  };
}

async function loadInboundMessage({
  companyId,
  contactId,
  inboundMessageId,
}: AutomationRuntimeJobData): Promise<LoadedInboundMessage | null> {
  const message = await prisma.message.findFirst({
    where: {
      companyId,
      contactId,
      direction: "INBOUND",
      id: inboundMessageId,
    },
    include: {
      contact: true,
    },
  });

  if (!message) return null;

  return {
    body: message.body,
    campaignId: message.campaignId,
    contact: mapContact(message.contact),
    id: message.id,
    metadata: message.metadata,
    templateId: message.templateId,
  };
}

function validatePublishedGraph(graph: AutomationGraph) {
  const validation = validateAutomationGraph(graph);

  if (!validation.valid) {
    throw new Error(
      `Published automation graph is invalid: ${validation.errors
        .map((issue) => issue.message)
        .join("; ")}`,
    );
  }
}

export function resolveNextNodeId(
  graph: AutomationGraph,
  currentNodeId: string,
  sourceHandle?: string | null,
) {
  const sourceNode = graph.nodes.find((node) => node.id === currentNodeId);

  if (!sourceNode) return null;

  const edge = graph.edges.find((candidate) => {
    if (candidate.source !== currentNodeId) return false;

    const resolvedSourceHandle = resolveSourceHandleId(
      sourceNode,
      candidate.sourceHandle,
    );

    return sourceHandle
      ? resolvedSourceHandle === sourceHandle
      : Boolean(resolvedSourceHandle);
  });

  return edge?.target ?? null;
}

function findRootNode(graph: AutomationGraph, preferredRootNodeId?: string | null) {
  if (preferredRootNodeId) {
    const preferred = graph.nodes.find((node) => node.id === preferredRootNodeId);
    if (preferred) return preferred;
  }

  return graph.nodes.find(
    (node) => node.type === "START" || node.type === "TEMPLATE_TRIGGER",
  );
}

async function findExistingExecution({
  companyId,
  flowId,
  triggerMessageId,
}: {
  companyId: string;
  flowId: string;
  triggerMessageId: string;
}) {
  return prisma.automationExecution.findUnique({
    where: {
      companyId_triggerMessageId_flowId: {
        companyId,
        flowId,
        triggerMessageId,
      },
    },
  });
}

async function emitRuntimeAlert(input: {
  code: string;
  companyId: string;
  executionId?: string | null;
  flowId?: string | null;
  flowVersionId?: string | null;
  message: string;
  nodeId?: string | null;
  nodeType?: string | null;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  type:
    | "DUPLICATE_EXECUTION_BLOCKED"
    | "FLOW_BLOCKED_BY_PLAN"
    | "LOOP_DETECTED";
}) {
  try {
    const { createOrUpdateAlert } = await import(
      "@/server/services/automation-alert.service"
    );
    await createOrUpdateAlert({
      companyId: input.companyId,
      type: input.type,
      severity: input.severity,
      title: input.title,
      message: input.message,
      fingerprint: [
        input.companyId,
        input.type,
        input.flowId ?? "unknown-flow",
        input.nodeId ?? "flow",
      ].join(":"),
      flowId: input.flowId,
      flowVersionId: input.flowVersionId,
      executionId: input.executionId,
      nodeId: input.nodeId,
      nodeType: input.nodeType,
      metadata: {
        code: input.code,
      },
    });
  } catch (error) {
    console.error("AUTOMATION_RUNTIME_ALERT_EMIT_ERROR:", error);
  }
}

async function createAutomationExecution({
  companyId,
  flowId,
  flowVersionId,
  sessionId,
  triggerMessageId,
  triggerPayload,
  triggerType,
}: {
  companyId: string;
  flowId: string;
  flowVersionId: string;
  sessionId?: string | null;
  triggerMessageId: string;
  triggerPayload?: unknown;
  triggerType?: AutomationTriggerType | null;
}) {
  const existing = await findExistingExecution({
    companyId,
    flowId,
    triggerMessageId,
  });

  if (existing && existing.status !== "RUNNING") {
    await emitRuntimeAlert({
      code: "DUPLICATE_EXECUTION_BLOCKED",
      companyId,
      executionId: existing.id,
      flowId,
      flowVersionId,
      message: "Duplicate inbound trigger was blocked by automation idempotency.",
      severity: "INFO",
      title: "Duplicate automation execution blocked",
      type: "DUPLICATE_EXECUTION_BLOCKED",
    });
    return null;
  }

  if (existing) {
    const { incrementExecutionUsage } = await import("./automation-usage.service");
    await incrementExecutionUsage(companyId, existing.id);
    return existing;
  }

  try {
    const execution = await prisma.automationExecution.create({
      data: {
        companyId,
        flowId,
        flowVersionId,
        sessionId: sessionId ?? null,
        status: "RUNNING",
        triggerMessageId,
        triggerPayload: safeJson(triggerPayload),
        triggerType: triggerType ?? null,
      },
    });

    if (sessionId) {
      await prisma.automationSession.updateMany({
        where: {
          companyId,
          id: sessionId,
        },
        data: {
          lastExecutionId: execution.id,
        },
      });
    }

    const { incrementExecutionUsage } = await import("./automation-usage.service");
    await incrementExecutionUsage(companyId, execution.id);

    return execution;
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    const existingExecution = await findExistingExecution({
      companyId,
      flowId,
      triggerMessageId,
    });

    await emitRuntimeAlert({
      code: "DUPLICATE_EXECUTION_BLOCKED",
      companyId,
      executionId: existingExecution?.id,
      flowId,
      flowVersionId,
      message: "Concurrent duplicate trigger was blocked by automation idempotency.",
      severity: "INFO",
      title: "Duplicate automation execution blocked",
      type: "DUPLICATE_EXECUTION_BLOCKED",
    });

    return existingExecution;
  }
}

export async function failAutomationExecution(
  executionId: string,
  error: unknown,
  failedNode?: Pick<AutomationNode, "id" | "type"> | null,
) {
  const completedAt = new Date();
  const execution = await prisma.automationExecution.findUnique({
    where: {
      id: executionId,
    },
    select: {
      startedAt: true,
    },
  });

  return prisma.automationExecution.update({
    where: {
      id: executionId,
    },
    data: {
      completedAt,
      durationMs: execution ? durationMs(execution.startedAt, completedAt) : undefined,
      errorMessage: asErrorMessage(error),
      failedNodeId: failedNode?.id ?? undefined,
      failedNodeType: failedNode?.type ?? undefined,
      status: "FAILED",
    },
  });
}

async function markAutomationExecutionStatus({
  executionId,
  status,
}: {
  executionId: string;
  status: "SUCCESS" | "WAITING" | "SKIPPED";
}) {
  const completedAt = status === "WAITING" ? null : new Date();
  const execution = completedAt
    ? await prisma.automationExecution.findUnique({
        where: {
          id: executionId,
        },
        select: {
          startedAt: true,
        },
      })
    : null;

  return prisma.automationExecution.update({
    where: {
      id: executionId,
    },
    data: {
      completedAt,
      durationMs:
        completedAt && execution
          ? durationMs(execution.startedAt, completedAt)
          : undefined,
      status,
    },
  });
}

async function createRunningStep({
  companyId,
  executionId,
  node,
  input,
}: {
  companyId: string;
  executionId: string;
  input: unknown;
  node: AutomationNode;
}) {
  return prisma.automationExecutionStep.create({
    data: {
      companyId,
      executionId,
      input: safeJson(input),
      nodeId: node.id,
      nodeType: node.type,
      status: "RUNNING",
    },
  });
}

async function completeStep({
  output,
  sourceHandle,
  status,
  stepId,
  targetNodeId,
}: {
  output?: unknown;
  sourceHandle?: string | null;
  status: "SUCCESS" | "FAILED" | "WAITING" | "SKIPPED";
  stepId: string;
  targetNodeId?: string | null;
}) {
  const completedAt = new Date();
  const step = await prisma.automationExecutionStep.findUnique({
    where: {
      id: stepId,
    },
    select: {
      startedAt: true,
    },
  });

  return prisma.automationExecutionStep.update({
    where: {
      id: stepId,
    },
    data: {
      completedAt,
      durationMs: step ? durationMs(step.startedAt, completedAt) : undefined,
      output: safeJson(output),
      sourceHandle: sourceHandle ?? undefined,
      status,
      targetNodeId: targetNodeId ?? undefined,
    },
  });
}

async function failStep({
  error,
  output,
  sourceHandle,
  stepId,
  targetNodeId,
}: {
  error: unknown;
  output?: unknown;
  sourceHandle?: string | null;
  stepId: string;
  targetNodeId?: string | null;
}) {
  const completedAt = new Date();
  const step = await prisma.automationExecutionStep.findUnique({
    where: {
      id: stepId,
    },
    select: {
      startedAt: true,
    },
  });

  return prisma.automationExecutionStep.update({
    where: {
      id: stepId,
    },
    data: {
      completedAt,
      durationMs: step ? durationMs(step.startedAt, completedAt) : undefined,
      errorMessage: asErrorMessage(error),
      output: output === undefined ? undefined : safeJson(output),
      sourceHandle: sourceHandle ?? undefined,
      status: "FAILED",
      targetNodeId: targetNodeId ?? undefined,
    },
  });
}

async function completeRunWithoutNextNode({
  context,
  executionId,
  sessionId,
}: {
  context: AutomationContext;
  executionId: string;
  sessionId: string;
}) {
  await updateAutomationSessionContext({
    context,
    currentNodeId: null,
    sessionId,
  });
  await completeAutomationSession(sessionId);
  await markAutomationExecutionStatus({
    executionId,
    status: "SUCCESS",
  });
}

async function executeAutomationGraphSafely(
  input: Parameters<typeof executeAutomationGraph>[0],
) {
  try {
    await executeAutomationGraph(input);
  } catch (error) {
    await failAutomationExecution(input.executionId, error);
    await failAutomationSession({
      error,
      sessionId: input.sessionId,
    });
    throw error;
  }
}

function getErrorHandleForNode(node: AutomationNode) {
  if (node.type === "SEND_TEMPLATE") return "failed";
  if (node.type === "API_CALL") return "error";
  if (node.type === "CATALOG_SEND") return "failed";
  if (
    [
      "AI_REPLY",
      "GOOGLE_SHEET_APPEND_ROW",
      "GOOGLE_SHEET_UPDATE_ROW",
      "PAYMENT_LINK",
      "TALLY_LOOKUP",
      "WEBHOOK",
    ].includes(node.type)
  ) {
    return "error";
  }

  return "error";
}

async function getReusableCompletedStep({
  executionId,
  nodeId,
}: {
  executionId: string;
  nodeId: string;
}) {
  return prisma.automationExecutionStep.findFirst({
    where: {
      executionId,
      nodeId,
      status: {
        in: ["SUCCESS", "WAITING"],
      },
    },
    orderBy: {
      startedAt: "desc",
    },
  });
}

export async function executeAutomationGraph({
  companyId,
  contact,
  context,
  executionId,
  graph,
  inboundMessage,
  sessionId,
  startNodeId,
}: {
  companyId: string;
  contact: AutomationRuntimeContact;
  context: AutomationContext;
  executionId: string;
  graph: AutomationGraph;
  inboundMessage: AutomationRuntimeMessage;
  sessionId: string;
  startNodeId: string | null;
}) {
  validatePublishedGraph(graph);

  let currentNodeId = startNodeId;
  let currentContext = context;
  const visits = new Map<string, number>();

  for (let stepCount = 0; stepCount < MAX_AUTOMATION_STEPS_PER_RUN; stepCount += 1) {
    if (!currentNodeId) {
      await completeRunWithoutNextNode({
        context: currentContext,
        executionId,
        sessionId,
      });
      return;
    }

    const node = graph.nodes.find((candidate) => candidate.id === currentNodeId);

    if (!node) {
      throw new Error(`Automation node "${currentNodeId}" not found`);
    }

    const visitCount = (visits.get(node.id) ?? 0) + 1;
    visits.set(node.id, visitCount);

    if (visitCount > MAX_AUTOMATION_NODE_VISITS_PER_RUN) {
      await emitRuntimeAlert({
        code: "LOOP_DETECTED",
        companyId,
        executionId,
        message: "Automation exceeded the maximum visits for a single node.",
        nodeId: node.id,
        nodeType: node.type,
        severity: "CRITICAL",
        title: "Automation loop detected",
        type: "LOOP_DETECTED",
      });
      throw new Error("Automation exceeded max node visit count. Possible loop detected.");
    }

    const reusableStep = await getReusableCompletedStep({
      executionId,
      nodeId: node.id,
    });

    if (reusableStep) {
      const output = reusableStep.output as Record<string, unknown> | null;
      const nextHandle =
        typeof output?.nextHandle === "string" ? output.nextHandle : undefined;

      if (reusableStep.status === "WAITING") {
        await markAutomationExecutionStatus({
          executionId,
          status: "WAITING",
        });
        return;
      }

      currentNodeId = resolveNextNodeId(graph, node.id, nextHandle ?? "next");
      continue;
    }

    const step = await createRunningStep({
      companyId,
      executionId,
      input: {
        context: currentContext,
        inboundMessageId: inboundMessage.id,
      },
      node,
    });

    try {
      const { requireAutomationNodeAccess } = await import("./plan-feature.service");
      await requireAutomationNodeAccess(companyId, node.type);

      const result = await executeAutomationNode({
        companyId,
        contact,
        context: currentContext,
        executionId,
        inboundMessage,
        node,
        sessionId,
      });
      const output = {
        ...(result.output ?? {}),
        nextHandle: result.nextHandle ?? null,
        stop: Boolean(result.stop),
      };
      const targetNodeId =
        result.status === "WAITING" || result.stop
          ? null
          : resolveNextNodeId(graph, node.id, result.nextHandle ?? "next");

      currentContext = setNodeOutput(result.context, node.id, result.output ?? {});

      await completeStep({
        output,
        sourceHandle: result.nextHandle ?? null,
        status: result.status,
        stepId: step.id,
        targetNodeId,
      });

      await updateAutomationSessionContext({
        context: currentContext,
        currentNodeId: node.id,
        sessionId,
      });

      if (result.status === "WAITING") {
        await markAutomationExecutionStatus({
          executionId,
          status: "WAITING",
        });
        return;
      }

      if (result.stop) {
        await markAutomationExecutionStatus({
          executionId,
          status: "SUCCESS",
        });
        return;
      }

      currentNodeId = targetNodeId;
    } catch (error) {
      const errorHandle = getErrorHandleForNode(node);
      const errorNodeId = resolveNextNodeId(graph, node.id, errorHandle);

      await failStep({
        error,
        output: {
          errorHandle,
          routedTo: errorNodeId,
        },
        sourceHandle: errorHandle,
        stepId: step.id,
        targetNodeId: errorNodeId,
      });

      if (errorNodeId) {
        currentContext = setNodeOutput(currentContext, node.id, {
          error: asErrorMessage(error),
        });
        currentNodeId = errorNodeId;
        continue;
      }

      await failAutomationExecution(executionId, error, node);
      await failAutomationSession({
        error,
        sessionId,
      });
      return;
    }
  }

  const error = new Error(
    "Automation exceeded max step count. Possible loop detected.",
  );

  await emitRuntimeAlert({
    code: "LOOP_DETECTED",
    companyId,
    executionId,
    message: "Automation exceeded the maximum step count for one run.",
    severity: "CRITICAL",
    title: "Automation loop detected",
    type: "LOOP_DETECTED",
  });

  await failAutomationExecution(executionId, error);
  await failAutomationSession({
    error,
    sessionId,
  });
}

function getReplyContinuation({
  context,
  graph,
  waitingNode,
}: {
  context: AutomationContext;
  graph: AutomationGraph;
  waitingNode: AutomationNode;
}) {
  if (waitingNode.type === "WAIT_FOR_REPLY") {
    return resolveNextNodeId(graph, waitingNode.id, "received");
  }

  if (waitingNode.type === "QUICK_REPLY") {
    const buttonMap = context.variables.buttonReplyMap;
    const rawButtonId = context.trigger.buttonId ?? context.trigger.buttonText;
    const mappedButtonId =
      rawButtonId && typeof buttonMap === "object" && !Array.isArray(buttonMap)
        ? (buttonMap as Record<string, unknown>)[rawButtonId]
        : null;
    const buttonId =
      typeof mappedButtonId === "string" ? mappedButtonId : rawButtonId;

    return buttonId
      ? resolveNextNodeId(graph, waitingNode.id, `button:${buttonId}`)
      : null;
  }

  if (waitingNode.type === "LIST_MESSAGE") {
    const itemId = context.trigger.listItemId ?? context.trigger.listItemText;

    return itemId
      ? resolveNextNodeId(graph, waitingNode.id, `item:${itemId}`)
      : null;
  }

  return waitingNode.id;
}

function saveWaitingReply({
  context,
  waitingNode,
}: {
  context: AutomationContext;
  waitingNode: AutomationNode;
}) {
  if (waitingNode.type !== "WAIT_FOR_REPLY") return context;

  const data = asRecord(waitingNode.data);
  const saveReplyAs =
    typeof data.saveReplyAs === "string" && data.saveReplyAs.trim()
      ? data.saveReplyAs.trim()
      : "reply";
  const replyText =
    context.trigger.text ||
    context.trigger.buttonText ||
    context.trigger.listItemText ||
    "";

  return setAutomationContextValue(
    setAutomationContextValue(context, `replies.${saveReplyAs}`, replyText),
    `variables.${saveReplyAs}`,
    replyText,
  );
}

export async function continueAutomationSession({
  contact,
  inboundMessage,
  session,
}: {
  contact: AutomationRuntimeContact;
  inboundMessage: AutomationRuntimeMessage;
  session: NonNullable<RuntimeSession>;
}) {
  const graph = graphFromJson(session.flowVersion.graph);
  if (!graph) {
    throw new Error("Automation published graph is missing");
  }

  const baseContext =
    getAutomationContext(session.context) ??
    createAutomationContext({
      contact,
      message: inboundMessage,
    });
  let context: AutomationContext = {
    ...baseContext,
    trigger: extractInboundTrigger(inboundMessage),
  };
  const waitingNodeId = session.waitingNodeId ?? session.currentNodeId;
  const waitingNode = waitingNodeId
    ? graph.nodes.find((node) => node.id === waitingNodeId)
    : null;

  if (waitingNode) {
    context = saveWaitingReply({
      context,
      waitingNode,
    });
  }

  await markAutomationSessionActive({
    context,
    inboundMessageId: inboundMessage.id,
    sessionId: session.id,
  });

  const execution = await createAutomationExecution({
    companyId: session.companyId,
    flowId: session.flowId,
    flowVersionId: session.flowVersionId,
    sessionId: session.id,
    triggerMessageId: inboundMessage.id,
    triggerPayload: {
      continuation: true,
      waitingNodeId,
    },
    triggerType: "MANUAL",
  });

  if (!execution) return;

  const continuationNodeId = waitingNode
    ? getReplyContinuation({
        context,
        graph,
        waitingNode,
      })
    : session.currentNodeId;

  await executeAutomationGraphSafely({
    companyId: session.companyId,
    contact,
    context,
    executionId: execution.id,
    graph,
    inboundMessage,
    sessionId: session.id,
    startNodeId: continuationNodeId,
  });
}

export async function startAutomationSessionFromMatch({
  contact,
  inboundMessage,
  match,
}: {
  contact: AutomationRuntimeContact;
  inboundMessage: AutomationRuntimeMessage;
  match: PublishedAutomationFlowMatch;
}) {
  const graph = graphFromJson(match.version.graph);

  if (!graph) {
    throw new Error("Automation published graph is missing");
  }

  const rootNode = findRootNode(graph, match.rootNodeId);

  if (!rootNode) {
    throw new Error("Automation published graph has no start node");
  }

  const context = createAutomationContext({
    contact,
    message: inboundMessage,
  });
  const session = await startAutomationSession({
    companyId: match.flow.companyId,
    contactId: contact.id,
    context,
    currentNodeId: rootNode.id,
    flowId: match.flow.id,
    flowVersionId: match.version.id,
    inboundMessageId: inboundMessage.id,
  });
  const execution = await createAutomationExecution({
    companyId: match.flow.companyId,
    flowId: match.flow.id,
    flowVersionId: match.version.id,
    sessionId: session.id,
    triggerMessageId: inboundMessage.id,
    triggerPayload: match.triggerPayload,
    triggerType: match.triggerType,
  });

  if (!execution) return;

  await executeAutomationGraphSafely({
    companyId: match.flow.companyId,
    contact,
    context,
    executionId: execution.id,
    graph,
    inboundMessage,
    sessionId: session.id,
    startNodeId: rootNode.id,
  });
}

export async function findOrCreateAutomationSession(input: {
  contact: AutomationRuntimeContact;
  inboundMessage: AutomationRuntimeMessage;
  match: PublishedAutomationFlowMatch;
}) {
  const activeSession = await findActiveAutomationSession({
    companyId: input.match.flow.companyId,
    contactId: input.contact.id,
  });

  if (activeSession) return activeSession;

  const graph = graphFromJson(input.match.version.graph);
  const rootNode = graph ? findRootNode(graph, input.match.rootNodeId) : null;

  return startAutomationSession({
    companyId: input.match.flow.companyId,
    contactId: input.contact.id,
    context: createAutomationContext({
      contact: input.contact,
      message: input.inboundMessage,
    }),
    currentNodeId: rootNode?.id ?? null,
    flowId: input.match.flow.id,
    flowVersionId: input.match.version.id,
    inboundMessageId: input.inboundMessage.id,
  });
}

export async function runAutomationForInboundMessage(
  input: AutomationRuntimeJobData,
) {
  const inboundMessage = await loadInboundMessage(input);

  if (!inboundMessage) return;

  const contact = inboundMessage.contact;
  const activeSession = await findActiveAutomationSession({
    companyId: input.companyId,
    contactId: input.contactId,
  });

  if (activeSession) {
    const { checkCanRunAutomationExecution } = await import("./automation-plan-limit.service");
    try {
      await checkCanRunAutomationExecution(input.companyId, activeSession.flowId);
    } catch (err) {
      console.warn(`[AUTOMATION_PLAN_LIMIT_EXCEEDED] Skipping runtime execution for company ${input.companyId}:`, (err as Error).message);
      return;
    }

    await continueAutomationSession({
      contact,
      inboundMessage,
      session: activeSession,
    });
    return;
  }

  const match = await findMatchingPublishedAutomationFlow(
    input.companyId,
    contact,
    inboundMessage,
  );

  if (!match) return;

  const { checkCanRunAutomationExecution } = await import("./automation-plan-limit.service");
  try {
    await checkCanRunAutomationExecution(input.companyId, match.flow.id);
  } catch (err) {
    console.warn(`[AUTOMATION_PLAN_LIMIT_EXCEEDED] Skipping runtime execution for company ${input.companyId}:`, (err as Error).message);
    return;
  }

  await startAutomationSessionFromMatch({
    contact,
    inboundMessage,
    match,
  });
}

export async function queueAutomationRuntimeJob(input: AutomationRuntimeJobData) {
  return getAutomationRuntimeQueue().add("run-automation", input, {
    jobId: `automation-runtime:${input.companyId}:${input.inboundMessageId}`,
  });
}

export async function processAutomationReplyTimeouts({
  limit = 100,
}: {
  limit?: number;
} = {}) {
  const sessions = await findExpiredWaitingAutomationSessions({ limit });
  let processed = 0;
  let expired = 0;

  for (const session of sessions) {
    const graph = graphFromJson(session.flowVersion.graph);
    const context = getAutomationContext(session.context);
    const waitingNode = graph?.nodes.find(
      (node) => node.id === session.waitingNodeId,
    );
    const contact = await prisma.contact.findFirst({
      where: {
        companyId: session.companyId,
        id: session.contactId,
      },
    });

    if (!graph || !context || !waitingNode || !contact) {
      await expireAutomationSession(session.id);
      expired += 1;
      continue;
    }

    const timeoutNodeId = resolveNextNodeId(graph, waitingNode.id, "timeout");
    if (!timeoutNodeId) {
      await expireAutomationSession(session.id);
      expired += 1;
      continue;
    }

    const { checkCanRunAutomationExecution } = await import("./automation-plan-limit.service");
    try {
      await checkCanRunAutomationExecution(session.companyId, session.flowId);
    } catch (err) {
      console.warn(`[AUTOMATION_PLAN_LIMIT_EXCEEDED] Skipping timeout execution for company ${session.companyId}:`, (err as Error).message);
      continue;
    }

    const execution = await prisma.automationExecution.create({
      data: {
        companyId: session.companyId,
        flowId: session.flowId,
        flowVersionId: session.flowVersionId,
        sessionId: session.id,
        status: "RUNNING",
        triggerPayload: safeJson({
          timeout: true,
          waitingNodeId: waitingNode.id,
        }),
        triggerType: "MANUAL",
      },
    });
    const { incrementExecutionUsage } = await import("./automation-usage.service");
    await incrementExecutionUsage(session.companyId, execution.id);

    await markAutomationSessionActive({
      context,
      inboundMessageId: session.lastInboundMessageId ?? `timeout:${session.id}`,
      sessionId: session.id,
    });

    await executeAutomationGraphSafely({
      companyId: session.companyId,
      contact: mapContact(contact),
      context,
      executionId: execution.id,
      graph,
      inboundMessage: {
        body: "",
        id: session.lastInboundMessageId ?? `timeout:${session.id}`,
        metadata: null,
      },
      sessionId: session.id,
      startNodeId: timeoutNodeId,
    });
    processed += 1;
  }

  return {
    expired,
    processed,
  };
}
