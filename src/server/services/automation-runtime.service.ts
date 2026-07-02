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
    return null;
  }

  if (existing) return existing;

  try {
    return await prisma.automationExecution.create({
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
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    return findExistingExecution({
      companyId,
      flowId,
      triggerMessageId,
    });
  }
}

export async function failAutomationExecution(
  executionId: string,
  error: unknown,
) {
  return prisma.automationExecution.update({
    where: {
      id: executionId,
    },
    data: {
      completedAt: new Date(),
      errorMessage: asErrorMessage(error),
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
  return prisma.automationExecution.update({
    where: {
      id: executionId,
    },
    data: {
      completedAt: status === "WAITING" ? null : new Date(),
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
  status,
  stepId,
}: {
  output?: unknown;
  status: "SUCCESS" | "FAILED" | "WAITING" | "SKIPPED";
  stepId: string;
}) {
  return prisma.automationExecutionStep.update({
    where: {
      id: stepId,
    },
    data: {
      completedAt: new Date(),
      output: safeJson(output),
      status,
    },
  });
}

async function failStep({
  error,
  output,
  stepId,
}: {
  error: unknown;
  output?: unknown;
  stepId: string;
}) {
  return prisma.automationExecutionStep.update({
    where: {
      id: stepId,
    },
    data: {
      completedAt: new Date(),
      errorMessage: asErrorMessage(error),
      output: output === undefined ? undefined : safeJson(output),
      status: "FAILED",
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

      currentContext = setNodeOutput(result.context, node.id, result.output ?? {});

      await completeStep({
        output,
        status: result.status,
        stepId: step.id,
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

      currentNodeId = resolveNextNodeId(graph, node.id, result.nextHandle ?? "next");
    } catch (error) {
      const errorHandle = getErrorHandleForNode(node);
      const errorNodeId = resolveNextNodeId(graph, node.id, errorHandle);

      await failStep({
        error,
        output: {
          errorHandle,
          routedTo: errorNodeId,
        },
        stepId: step.id,
      });

      if (errorNodeId) {
        currentContext = setNodeOutput(currentContext, node.id, {
          error: asErrorMessage(error),
        });
        currentNodeId = errorNodeId;
        continue;
      }

      await failAutomationExecution(executionId, error);
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
