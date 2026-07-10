import { Prisma } from "@/generated/prisma/client";
import { getAutomationRuntimeQueue } from "@/lib/queue";
import type { AutomationFlowResponseJobData } from "@/lib/queue";
import {
  isEmptyFlowMappingValue,
  normalizeFlowResponseMappings,
  readFlowResponseMappingsFromComponents,
  resolveFlowResponseValue,
  transformFlowResponseValue,
  validateFlowResponseMappings,
  type FlowResponseContactFieldTarget,
  type FlowResponseMapping,
} from "@/lib/whatsapp-flow-response-mapping";
import { prisma } from "@/lib/prisma";
import {
  asRecord,
  getAutomationContext,
  setAutomationContextValue,
  type AutomationRuntimeContact,
  type AutomationRuntimeMessage,
} from "@/server/services/automation-context.service";
import { continueAutomationSession } from "@/server/services/automation-runtime.service";

type MappingApplyResult = {
  applied: Array<{
    sourcePath: string;
    targetKey: string;
    targetType: string;
    transform: string;
  }>;
  skipped: Array<{
    reason: string;
    sourcePath: string;
    targetKey: string;
    targetType: string;
  }>;
};

type LoadedFlowResponse = NonNullable<
  Awaited<ReturnType<typeof loadFlowResponseForProcessing>>
>;

function safeJson(value: unknown): Prisma.InputJsonValue {
  return (value ?? Prisma.JsonNull) as Prisma.InputJsonValue;
}

function asInputJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

function asErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown Flow response error";
}

function isEmailTargetValid(value: unknown) {
  if (typeof value !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function shouldWriteValue({
  conflictPolicy,
  existing,
}: {
  conflictPolicy: FlowResponseMapping["conflictPolicy"];
  existing: unknown;
}) {
  if (conflictPolicy === "OVERWRITE") return true;
  if (conflictPolicy === "KEEP_EXISTING") return isEmptyFlowMappingValue(existing);
  return isEmptyFlowMappingValue(existing);
}

function sanitizeProcessingResult(result: MappingApplyResult & {
  automation?: Record<string, unknown>;
}) {
  return {
    applied: result.applied,
    automation: result.automation ?? { resumed: false, reason: "NO_AUTOMATION_CONTEXT" },
    skipped: result.skipped,
  };
}

async function loadFlowResponseForProcessing(flowResponseId: string) {
  return prisma.whatsAppFlowResponse.findUnique({
    where: {
      id: flowResponseId,
    },
    include: {
      contact: true,
      flowInteraction: {
        include: {
          template: true,
        },
      },
      message: {
        include: {
          contact: true,
        },
      },
    },
  });
}

function getMappings(response: LoadedFlowResponse) {
  const snapshotMappings = normalizeFlowResponseMappings(
    response.flowInteraction?.responseMappingSnapshot,
  );

  if (snapshotMappings.length > 0) return snapshotMappings;

  return readFlowResponseMappingsFromComponents(
    response.flowInteraction?.template.components,
  );
}

async function applyFlowResponseMappings({
  mappings,
  response,
}: {
  mappings: FlowResponseMapping[];
  response: LoadedFlowResponse;
}): Promise<MappingApplyResult> {
  const result: MappingApplyResult = {
    applied: [],
    skipped: [],
  };

  if (!response.contactId || mappings.length === 0) return result;

  await prisma.$transaction(async (tx) => {
    const contact = await tx.contact.findFirst({
      where: {
        companyId: response.companyId,
        id: response.contactId ?? "",
      },
    });

    if (!contact) {
      result.skipped.push({
        reason: "CONTACT_NOT_FOUND",
        sourcePath: "*",
        targetKey: "*",
        targetType: "*",
      });
      return;
    }

    const contactUpdates: Partial<Record<FlowResponseContactFieldTarget, string>> =
      {};
    const customAttributes = asRecord(contact.customAttributes);

    for (const mapping of mappings) {
      const rawValue = resolveFlowResponseValue(
        response.responseData ?? response.responsePayload,
        mapping.sourcePath,
      );

      if (rawValue === undefined || rawValue === null) {
        result.skipped.push({
          reason: "SOURCE_MISSING",
          sourcePath: mapping.sourcePath,
          targetKey: mapping.targetKey,
          targetType: mapping.targetType,
        });
        continue;
      }

      const transformedValue = transformFlowResponseValue(
        rawValue,
        mapping.transform,
      );

      if (transformedValue === undefined) {
        result.skipped.push({
          reason: "TRANSFORM_FAILED",
          sourcePath: mapping.sourcePath,
          targetKey: mapping.targetKey,
          targetType: mapping.targetType,
        });
        continue;
      }

      if (mapping.targetType === "CONTACT_FIELD") {
        const targetKey = mapping.targetKey as FlowResponseContactFieldTarget;
        const existingValue = contact[targetKey];

        if (!shouldWriteValue({ conflictPolicy: mapping.conflictPolicy, existing: existingValue })) {
          result.skipped.push({
            reason: "CONFLICT_POLICY",
            sourcePath: mapping.sourcePath,
            targetKey: mapping.targetKey,
            targetType: mapping.targetType,
          });
          continue;
        }

        if (targetKey === "email" && !isEmailTargetValid(transformedValue)) {
          result.skipped.push({
            reason: "INVALID_EMAIL",
            sourcePath: mapping.sourcePath,
            targetKey: mapping.targetKey,
            targetType: mapping.targetType,
          });
          continue;
        }

        contactUpdates[targetKey] =
          typeof transformedValue === "string"
            ? transformedValue
            : JSON.stringify(transformedValue);
      } else {
        const existingValue = customAttributes[mapping.targetKey];

        if (!shouldWriteValue({ conflictPolicy: mapping.conflictPolicy, existing: existingValue })) {
          result.skipped.push({
            reason: "CONFLICT_POLICY",
            sourcePath: mapping.sourcePath,
            targetKey: mapping.targetKey,
            targetType: mapping.targetType,
          });
          continue;
        }

        customAttributes[mapping.targetKey] = transformedValue;
      }

      result.applied.push({
        sourcePath: mapping.sourcePath,
        targetKey: mapping.targetKey,
        targetType: mapping.targetType,
        transform: mapping.transform,
      });
    }

    await tx.contact.update({
      where: {
        id: contact.id,
      },
      data: {
        ...contactUpdates,
        customAttributes: asInputJsonObject(customAttributes),
      },
    });
  });

  return result;
}

function mapRuntimeContact(
  contact: NonNullable<NonNullable<LoadedFlowResponse["message"]>["contact"]>,
): AutomationRuntimeContact {
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

function mapRuntimeMessage(message: NonNullable<LoadedFlowResponse["message"]>): AutomationRuntimeMessage {
  return {
    body: message.body,
    campaignId: message.campaignId,
    id: message.id,
    metadata: message.metadata,
    templateId: message.templateId,
  };
}

async function resumeAutomationForFlowResponse({
  mappingResult,
  response,
}: {
  mappingResult: MappingApplyResult;
  response: LoadedFlowResponse;
}) {
  const interaction = response.flowInteraction;

  if (
    !interaction?.automationExecutionId ||
    !interaction.automationStepId ||
    !interaction.automationNodeId ||
    !response.message ||
    !response.message.contact
  ) {
    return { resumed: false, reason: "NO_AUTOMATION_CONTEXT" };
  }

  const waitingStep = await prisma.automationExecutionStep.findFirst({
    where: {
      companyId: response.companyId,
      executionId: interaction.automationExecutionId,
      id: interaction.automationStepId,
      nodeId: interaction.automationNodeId,
      status: "WAITING",
    },
  });

  if (!waitingStep) {
    return { resumed: false, reason: "WAITING_STEP_NOT_FOUND" };
  }

  const waitingExecution = await prisma.automationExecution.findFirst({
    where: {
      companyId: response.companyId,
      id: interaction.automationExecutionId,
      status: "WAITING",
    },
  });

  if (!waitingExecution?.sessionId) {
    return { resumed: false, reason: "WAITING_EXECUTION_NOT_FOUND" };
  }

  const session = await prisma.automationSession.findFirst({
    where: {
      companyId: response.companyId,
      contactId: response.message.contactId,
      id: waitingExecution.sessionId,
      status: "WAITING",
      waitingNodeId: interaction.automationNodeId,
    },
    include: {
      flow: true,
      flowVersion: true,
    },
  });

  if (!session) {
    return { resumed: false, reason: "WAITING_SESSION_NOT_FOUND" };
  }

  const baseContext = getAutomationContext(session.context);

  if (!baseContext) {
    return { resumed: false, reason: "SESSION_CONTEXT_INVALID" };
  }

  const flowOutput = {
    appliedMappings: mappingResult.applied.map((item) => ({
      sourcePath: item.sourcePath,
      targetKey: item.targetKey,
      targetType: item.targetType,
    })),
    flowResponseId: response.id,
    screenId: response.screenId,
    submittedAt: response.receivedAt.toISOString(),
  };
  const contextWithData = setAutomationContextValue(
    setAutomationContextValue(
      setAutomationContextValue(
        baseContext,
        `nodes.${interaction.automationNodeId}.flowResponse`,
        response.responseData ?? {},
      ),
      `nodes.${interaction.automationNodeId}.output.flowResponse`,
      flowOutput,
    ),
    `variables.flowResponses.${interaction.automationNodeId}`,
    response.responseData ?? {},
  );

  await prisma.$transaction([
    prisma.automationSession.update({
      where: {
        id: session.id,
      },
      data: {
        context: safeJson(contextWithData),
      },
    }),
    prisma.whatsAppFlowInteraction.update({
      where: {
        id: interaction.id,
      },
      data: {
        automationResumeQueuedAt: new Date(),
      },
    }),
  ]);

  await continueAutomationSession({
    contact: mapRuntimeContact(response.message.contact),
    inboundMessage: mapRuntimeMessage(response.message),
    session: {
      ...session,
      context: contextWithData as unknown as Prisma.JsonValue,
    },
  });

  return {
    executionId: interaction.automationExecutionId,
    nodeId: interaction.automationNodeId,
    resumed: true,
    sessionId: session.id,
  };
}

export async function processWhatsAppFlowResponseMappingJob({
  flowResponseId,
}: AutomationFlowResponseJobData) {
  const claimed = await prisma.whatsAppFlowResponse.updateMany({
    where: {
      id: flowResponseId,
      status: "CAPTURED",
    },
    data: {
      processingError: null,
      processingStartedAt: new Date(),
      status: "PROCESSING",
    },
  });

  if (claimed.count !== 1) {
    return { status: "SKIPPED" };
  }

  try {
    const response = await loadFlowResponseForProcessing(flowResponseId);

    if (!response) {
      throw new Error("Flow response not found");
    }

    const interaction = response.flowInteraction;
    if (interaction && interaction.companyId !== response.companyId) {
      throw new Error("Flow interaction tenant mismatch");
    }

    if (
      interaction?.contactId &&
      response.contactId &&
      interaction.contactId !== response.contactId
    ) {
      throw new Error("Flow response contact mismatch");
    }

    const mappings = getMappings(response);
    const mappingIssues = validateFlowResponseMappings(mappings);

    if (mappingIssues.length > 0) {
      throw new Error(mappingIssues.map((issue) => issue.message).join("; "));
    }

    const mappingResult = await applyFlowResponseMappings({
      mappings,
      response,
    });
    const automation = await resumeAutomationForFlowResponse({
      mappingResult,
      response,
    });

    const processedAt = new Date();

    await prisma.whatsAppFlowResponse.update({
      where: {
        id: response.id,
      },
      data: {
        processedAt,
        processingError: null,
        processingResult: safeJson(
          sanitizeProcessingResult({
            ...mappingResult,
            automation,
          }),
        ),
        status: "PROCESSED",
      },
    });

    return { status: "PROCESSED" };
  } catch (error) {
    await prisma.whatsAppFlowResponse.updateMany({
      where: {
        id: flowResponseId,
        status: "PROCESSING",
      },
      data: {
        processedAt: new Date(),
        processingError: asErrorMessage(error),
        status: "FAILED",
      },
    });

    throw error;
  }
}

export async function enqueueWhatsAppFlowResponseProcessing({
  flowResponseId,
}: {
  flowResponseId: string;
}) {
  return getAutomationRuntimeQueue().add(
    "process-flow-response",
    {
      flowResponseId,
      kind: "FLOW_RESPONSE",
    } satisfies AutomationFlowResponseJobData,
    {
      jobId: `automation-flow-response:${flowResponseId}`,
    },
  );
}
