import { Prisma } from "@/generated/prisma/client";
import type {
  AutomationEdge,
  AutomationGraph,
  AutomationNode,
} from "@/lib/automation-builder/types";
import { resolveSourceHandleId } from "@/lib/automation-builder/connection-handles";
import {
  normalizeAutomationGraph,
  validateAutomationGraph,
} from "@/lib/automation-builder/graph-validation";
import { prisma } from "@/lib/prisma";
import {
  addNodeOutput,
  asRecord,
  createInitialTestContext,
  getTestContext,
  safeTestJson,
  setTestContextValue,
  stringValue,
  type AutomationTestContext,
} from "@/server/services/automation-test-context.service";
import { executeAutomationTestNode } from "@/server/services/automation-test-node-executor.service";
import type {
  ContinueAutomationTestInput,
  StartAutomationTestInput,
} from "@/server/validators/automation-test.validator";

export const MAX_TEST_STEPS_PER_RUN = 100;
const MAX_TEST_NODE_VISITS_PER_RUN = 5;

export class AutomationTestValidationError extends Error {
  constructor(
    message: string,
    public readonly validationErrors: unknown,
    public readonly validationWarnings: unknown,
  ) {
    super(message);
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown dry-run test error";
}

function graphFromJson(value: Prisma.JsonValue): AutomationGraph {
  const record = asRecord(value);

  return normalizeAutomationGraph({
    edges: Array.isArray(record.edges) ? record.edges as AutomationEdge[] : [],
    nodes: Array.isArray(record.nodes) ? record.nodes as AutomationNode[] : [],
    version: 1,
  });
}

function findRootNode(graph: AutomationGraph) {
  return graph.nodes.find(
    (node) => node.type === "START" || node.type === "TEMPLATE_TRIGGER",
  );
}

function findEdgeForHandle({
  graph,
  sourceHandle,
  sourceNodeId,
}: {
  graph: AutomationGraph;
  sourceHandle?: string | null;
  sourceNodeId: string;
}) {
  const sourceNode = graph.nodes.find((node) => node.id === sourceNodeId);
  if (!sourceNode) return null;

  return (
    graph.edges.find((edge) => {
      if (edge.source !== sourceNodeId) return false;

      const resolved = resolveSourceHandleId(sourceNode, edge.sourceHandle);

      return sourceHandle ? resolved === sourceHandle : Boolean(resolved);
    }) ?? null
  );
}

function resolveNextNode({
  graph,
  sourceHandle,
  sourceNodeId,
}: {
  graph: AutomationGraph;
  sourceHandle?: string | null;
  sourceNodeId: string;
}) {
  const edge = findEdgeForHandle({
    graph,
    sourceHandle,
    sourceNodeId,
  });

  return {
    edge,
    nodeId: edge?.target ?? null,
  };
}

async function assertFlowAccess({
  companyId,
  flowId,
}: {
  companyId: string;
  flowId: string;
}) {
  const flow = await prisma.automationFlow.findUnique({
    where: {
      id: flowId,
    },
    select: {
      companyId: true,
      id: true,
    },
  });

  if (flow && flow.companyId !== companyId) {
    throw new Error("Automation flow not found");
  }

  return flow;
}

async function updateRun({
  context,
  currentNodeId,
  status,
  testRunId,
  waitingForReply,
  waitingNodeId,
}: {
  context: AutomationTestContext;
  currentNodeId?: string | null;
  status?: "RUNNING" | "WAITING" | "SUCCESS" | "FAILED" | "CANCELLED";
  testRunId: string;
  waitingForReply?: boolean;
  waitingNodeId?: string | null;
}) {
  return prisma.automationTestRun.update({
    where: {
      id: testRunId,
    },
    data: {
      context: safeTestJson(context),
      ...(currentNodeId !== undefined ? { currentNodeId } : {}),
      ...(status ? { status } : {}),
      ...(status === "SUCCESS" || status === "FAILED" || status === "CANCELLED"
        ? { completedAt: new Date() }
        : {}),
      ...(waitingForReply !== undefined ? { waitingForReply } : {}),
      ...(waitingNodeId !== undefined ? { waitingNodeId } : {}),
    },
  });
}

async function createStep({
  companyId,
  context,
  node,
  testRunId,
}: {
  companyId: string;
  context: AutomationTestContext;
  node: AutomationNode;
  testRunId: string;
}) {
  return prisma.automationTestStep.create({
    data: {
      companyId,
      input: safeTestJson({
        context,
        nodeId: node.id,
      }),
      nodeId: node.id,
      nodeType: node.type,
      status: "RUNNING",
      testRunId,
    },
  });
}

async function completeStep({
  error,
  output,
  status,
  stepId,
}: {
  error?: unknown;
  output?: unknown;
  status: "SUCCESS" | "FAILED" | "WAITING" | "SKIPPED";
  stepId: string;
}) {
  return prisma.automationTestStep.update({
    where: {
      id: stepId,
    },
    data: {
      completedAt: new Date(),
      errorMessage: error ? errorMessage(error) : null,
      output: safeTestJson(output),
      status,
    },
  });
}

function serializeStep(step: {
  completedAt: Date | null;
  errorMessage: string | null;
  id: string;
  input: Prisma.JsonValue | null;
  nodeId: string;
  nodeType: string;
  output: Prisma.JsonValue | null;
  startedAt: Date;
  status: string;
}) {
  return {
    completedAt: step.completedAt?.toISOString() ?? null,
    durationMs: step.completedAt
      ? step.completedAt.getTime() - step.startedAt.getTime()
      : null,
    errorMessage: step.errorMessage,
    id: step.id,
    input: step.input,
    nodeId: step.nodeId,
    nodeType: step.nodeType,
    output: step.output,
    startedAt: step.startedAt.toISOString(),
    status: step.status,
  };
}

function deriveHighlightedEdgeIds(steps: Array<{ output: Prisma.JsonValue | null }>) {
  return steps
    .map((step) => {
      const output = asRecord(step.output);
      return stringValue(output.edgeId);
    })
    .filter(Boolean);
}

export async function getAutomationTestRun({
  companyId,
  flowId,
  testRunId,
}: {
  companyId: string;
  flowId: string;
  testRunId: string;
}) {
  const testRun = await prisma.automationTestRun.findFirst({
    where: {
      companyId,
      flowId,
      id: testRunId,
    },
    include: {
      steps: {
        orderBy: {
          startedAt: "asc",
        },
      },
    },
  });

  if (!testRun) return null;

  return {
    completedAt: testRun.completedAt?.toISOString() ?? null,
    context: testRun.context,
    createdByUserId: testRun.createdByUserId,
    currentNodeId: testRun.currentNodeId,
    flowId: testRun.flowId,
    graph: testRun.graph,
    highlightedEdgeIds: deriveHighlightedEdgeIds(testRun.steps),
    id: testRun.id,
    simulatedContact: testRun.simulatedContact,
    startedAt: testRun.startedAt.toISOString(),
    status: testRun.status,
    steps: testRun.steps.map(serializeStep),
    updatedAt: testRun.updatedAt.toISOString(),
    waitingForReply: testRun.waitingForReply,
    waitingNodeId: testRun.waitingNodeId,
  };
}

async function executeTestGraph({
  companyId,
  context,
  graph,
  startNodeId,
  testRunId,
}: {
  companyId: string;
  context: AutomationTestContext;
  graph: AutomationGraph;
  startNodeId: string | null;
  testRunId: string;
}) {
  let currentContext = context;
  let currentNodeId = startNodeId;
  const visits = new Map<string, number>();

  for (let stepIndex = 0; stepIndex < MAX_TEST_STEPS_PER_RUN; stepIndex += 1) {
    if (!currentNodeId) {
      await updateRun({
        context: currentContext,
        currentNodeId: null,
        status: "SUCCESS",
        testRunId,
        waitingForReply: false,
        waitingNodeId: null,
      });
      return;
    }

    const node = graph.nodes.find((candidate) => candidate.id === currentNodeId);
    if (!node) throw new Error(`Flow stopped because node ${currentNodeId} is missing.`);

    const visitCount = (visits.get(node.id) ?? 0) + 1;
    visits.set(node.id, visitCount);

    if (visitCount > MAX_TEST_NODE_VISITS_PER_RUN) {
      throw new Error("Test stopped because the flow may contain an infinite loop.");
    }

    await updateRun({
      context: currentContext,
      currentNodeId: node.id,
      status: "RUNNING",
      testRunId,
      waitingForReply: false,
      waitingNodeId: null,
    });

    const step = await createStep({
      companyId,
      context: currentContext,
      node,
      testRunId,
    });

    try {
      const result = await executeAutomationTestNode({
        companyId,
        context: currentContext,
        node,
      });
      const edgeResult = result.nextHandle
        ? resolveNextNode({
            graph,
            sourceHandle: result.nextHandle,
            sourceNodeId: node.id,
          })
        : { edge: null, nodeId: null };
      const output = {
        ...(result.output ?? {}),
        edgeId: edgeResult.edge?.id ?? null,
        nextHandle: result.nextHandle ?? null,
        targetNodeId: edgeResult.nodeId,
      };

      currentContext = addNodeOutput(result.context, node.id, output);

      await completeStep({
        output,
        status: result.status,
        stepId: step.id,
      });

      if (result.status === "WAITING") {
        await updateRun({
          context: currentContext,
          currentNodeId: node.id,
          status: "WAITING",
          testRunId,
          waitingForReply: true,
          waitingNodeId: node.id,
        });
        return;
      }

      if (result.stop) {
        await updateRun({
          context: currentContext,
          currentNodeId: node.id,
          status: "SUCCESS",
          testRunId,
          waitingForReply: false,
          waitingNodeId: null,
        });
        return;
      }

      if (result.nextHandle && !edgeResult.edge) {
        throw new Error(
          `Flow stopped because no target node exists for ${result.nextHandle} path.`,
        );
      }

      currentNodeId = edgeResult.nodeId;
    } catch (error) {
      const errorEdge = resolveNextNode({
        graph,
        sourceHandle: node.type === "SEND_TEMPLATE" ? "failed" : "error",
        sourceNodeId: node.id,
      });

      await completeStep({
        error,
        output: {
          edgeId: errorEdge.edge?.id ?? null,
          error: errorMessage(error),
          targetNodeId: errorEdge.nodeId,
        },
        status: "FAILED",
        stepId: step.id,
      });

      if (errorEdge.nodeId) {
        currentContext = addNodeOutput(currentContext, node.id, {
          error: errorMessage(error),
        });
        currentNodeId = errorEdge.nodeId;
        continue;
      }

      await updateRun({
        context: currentContext,
        currentNodeId: node.id,
        status: "FAILED",
        testRunId,
        waitingForReply: false,
        waitingNodeId: null,
      });
      return;
    }
  }

  throw new Error("Test stopped because the flow may contain an infinite loop.");
}

export async function startAutomationTestRun({
  companyId,
  flowId,
  input,
  userId,
}: {
  companyId: string;
  flowId: string;
  input: StartAutomationTestInput;
  userId: string;
}) {
  await assertFlowAccess({ companyId, flowId });

  const graph = normalizeAutomationGraph(input.graph);
  const validation = validateAutomationGraph(graph);

  if (!validation.valid) {
    throw new AutomationTestValidationError(
      "Fix validation errors before running a test.",
      validation.errors,
      validation.warnings,
    );
  }

  const rootNode = findRootNode(graph);
  const context = createInitialTestContext({
    initialMessage: input.initialMessage,
    simulatedContact: input.simulatedContact,
  });
  const testRun = await prisma.automationTestRun.create({
    data: {
      companyId,
      context: safeTestJson(context),
      createdByUserId: userId,
      currentNodeId: rootNode?.id ?? null,
      flowId,
      graph: safeTestJson(graph),
      simulatedContact: safeTestJson(input.simulatedContact),
      status: "RUNNING",
    },
  });

  try {
    await executeTestGraph({
      companyId,
      context,
      graph,
      startNodeId: rootNode?.id ?? null,
      testRunId: testRun.id,
    });
  } catch {
    await updateRun({
      context,
      currentNodeId: rootNode?.id ?? null,
      status: "FAILED",
      testRunId: testRun.id,
      waitingForReply: false,
      waitingNodeId: null,
    });
  }

  return getAutomationTestRun({
    companyId,
    flowId,
    testRunId: testRun.id,
  });
}

function continueFromWaitingNode({
  context,
  graph,
  input,
  waitingNode,
}: {
  context: AutomationTestContext;
  graph: AutomationGraph;
  input: ContinueAutomationTestInput;
  waitingNode: AutomationNode;
}) {
  let nextContext: AutomationTestContext = {
    ...context,
    trigger: {
      buttonId: input.buttonId || undefined,
      listItemId: input.listItemId || undefined,
      text: input.messageText,
      type: "MANUAL_TEST",
    },
    variables: {
      ...context.variables,
      last_reply: input.buttonId || input.listItemId || input.messageText,
    },
  };
  let handle = "received";

  if (waitingNode.type === "WAIT_FOR_REPLY") {
    const data = asRecord(waitingNode.data);
    const saveReplyAs = stringValue(data.saveReplyAs, "last_reply");
    const replyValue = input.buttonId || input.listItemId || input.messageText;

    nextContext = setTestContextValue(
      setTestContextValue(nextContext, `replies.${saveReplyAs}`, replyValue),
      `variables.${saveReplyAs}`,
      replyValue,
    );
    handle = "received";
  }

  if (waitingNode.type === "QUICK_REPLY") {
    const buttonId = input.buttonId || input.messageText;
    handle = `button:${buttonId}`;
  }

  if (waitingNode.type === "LIST_MESSAGE") {
    const itemId = input.listItemId || input.messageText;
    handle = `item:${itemId}`;
  }

  return {
    context: nextContext,
    nextNodeId: resolveNextNode({
      graph,
      sourceHandle: handle,
      sourceNodeId: waitingNode.id,
    }).nodeId,
  };
}

export async function continueAutomationTestRun({
  companyId,
  flowId,
  input,
}: {
  companyId: string;
  flowId: string;
  input: ContinueAutomationTestInput;
}) {
  await assertFlowAccess({ companyId, flowId });

  const testRun = await prisma.automationTestRun.findFirst({
    where: {
      companyId,
      flowId,
      id: input.testRunId,
      status: {
        in: ["RUNNING", "WAITING"],
      },
    },
  });

  if (!testRun) {
    throw new Error("Active test run not found.");
  }

  const graph = graphFromJson(testRun.graph);
  const context = getTestContext(testRun.context);
  const waitingNode = testRun.waitingNodeId
    ? graph.nodes.find((node) => node.id === testRun.waitingNodeId)
    : null;

  if (!context || !waitingNode) {
    throw new Error("This test run is not waiting for a reply.");
  }

  const continuation = continueFromWaitingNode({
    context,
    graph,
    input,
    waitingNode,
  });

  if (!continuation.nextNodeId) {
    await updateRun({
      context: continuation.context,
      currentNodeId: waitingNode.id,
      status: "FAILED",
      testRunId: testRun.id,
      waitingForReply: false,
      waitingNodeId: null,
    });
    throw new Error("No connected path matches this simulated reply.");
  }

  await executeTestGraph({
    companyId,
    context: continuation.context,
    graph,
    startNodeId: continuation.nextNodeId,
    testRunId: testRun.id,
  });

  return getAutomationTestRun({
    companyId,
    flowId,
    testRunId: testRun.id,
  });
}

export async function cancelAutomationTestRun({
  companyId,
  flowId,
  testRunId,
}: {
  companyId: string;
  flowId: string;
  testRunId: string;
}) {
  await assertFlowAccess({ companyId, flowId });

  const testRun = await prisma.automationTestRun.findFirst({
    where: {
      companyId,
      flowId,
      id: testRunId,
    },
  });

  if (!testRun) return null;

  const context = getTestContext(testRun.context);

  await prisma.automationTestRun.update({
    where: {
      id: testRun.id,
    },
    data: {
      completedAt: new Date(),
      context: context ? safeTestJson(context) : undefined,
      status: "CANCELLED",
      waitingForReply: false,
      waitingNodeId: null,
    },
  });

  return getAutomationTestRun({
    companyId,
    flowId,
    testRunId,
  });
}

export type AutomationTestRunResult = NonNullable<
  Awaited<ReturnType<typeof getAutomationTestRun>>
>;
