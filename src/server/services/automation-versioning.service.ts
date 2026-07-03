import { Prisma } from "@/generated/prisma/client";
import type { AutomationTriggerType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { hasUnpublishedChanges } from "@/lib/automation-builder/graph-diff";
import {
  normalizeAutomationGraph,
  validateAutomationGraph,
} from "@/lib/automation-builder/graph-validation";
import type {
  AutomationGraph,
  AutomationGraphValidationIssue,
  AutomationGraphValidationResult,
} from "@/lib/automation-builder/types";
import { createDefaultAutomationGraph } from "@/lib/automation-builder/node-defaults";
import { createAuditLogWithClient } from "@/server/services/audit.service";

export type AutomationPublishInput = {
  allowWarnings?: boolean;
  publishNotes?: string;
};

export type AutomationRollbackInput = {
  publishNotes?: string;
};

export class AutomationFlowNotFoundError extends Error {
  constructor() {
    super("Automation flow was not found");
  }
}

export class AutomationPublishBlockedError extends Error {
  constructor(
    message: string,
    public readonly errors: AutomationGraphValidationIssue[],
    public readonly warnings: AutomationGraphValidationIssue[],
    public readonly statusCode: 400 | 409,
  ) {
    super(message);
  }
}

export class AutomationPublishConflictError extends Error {
  constructor() {
    super("Flow was published by another request. Please refresh.");
  }
}

export function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function graphFromJson(value: Prisma.JsonValue): AutomationGraph {
  return normalizeAutomationGraph(value as unknown as AutomationGraph);
}

export function validationSnapshot(validation: AutomationGraphValidationResult) {
  return {
    errors: validation.errors,
    valid: validation.valid,
    warnings: validation.warnings,
  };
}

function validationSummary(value: Prisma.JsonValue | null | undefined) {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const errors = Array.isArray(record.errors) ? record.errors : [];
  const warnings = Array.isArray(record.warnings) ? record.warnings : [];

  return {
    errorCount: errors.length,
    warningCount: warnings.length,
  };
}

function extractTriggerMetadata(graph: AutomationGraph) {
  const root = graph.nodes.find(
    (node) => node.type === "START" || node.type === "TEMPLATE_TRIGGER",
  );
  const data =
    root?.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : {};
  const rootTriggerType =
    typeof data.triggerType === "string" ? data.triggerType : undefined;
  const templateTriggerMode =
    typeof data.triggerMode === "string" ? data.triggerMode : undefined;
  const triggerType = (
    root?.type === "TEMPLATE_TRIGGER"
      ? templateTriggerMode === "BUTTON_REPLY"
        ? "BUTTON_REPLY"
        : "TEMPLATE_REPLY"
      : rootTriggerType
  ) as AutomationTriggerType | undefined;
  const keywords = Array.isArray(data.keywords)
    ? data.keywords.filter((keyword): keyword is string => typeof keyword === "string")
    : [];

  return {
    isDefault: triggerType === "DEFAULT",
    keywords,
    triggerType:
      triggerType &&
      [
        "KEYWORD",
        "DEFAULT",
        "TEMPLATE_REPLY",
        "BUTTON_REPLY",
        "LIST_REPLY",
        "CAMPAIGN_REPLY",
        "MANUAL",
      ].includes(triggerType)
        ? triggerType
        : null,
  };
}

export async function validateApprovedTemplateNodes(
  companyId: string,
  graph: AutomationGraph,
): Promise<AutomationGraphValidationIssue[]> {
  const templateNodes = graph.nodes
    .filter((node) => node.type === "SEND_TEMPLATE")
    .map((node) => {
      const data =
        node.data && typeof node.data === "object" && !Array.isArray(node.data)
          ? (node.data as Record<string, unknown>)
          : {};
      const templateId = typeof data.templateId === "string" ? data.templateId : "";

      return {
        nodeId: node.id,
        templateId,
      };
    })
    .filter((node) => node.templateId.trim());

  if (templateNodes.length === 0) return [];

  const approvedTemplateIds = new Set(
    (
      await prisma.template.findMany({
        select: {
          id: true,
        },
        where: {
          companyId,
          id: {
            in: Array.from(new Set(templateNodes.map((node) => node.templateId))),
          },
          status: "APPROVED",
        },
      })
    ).map((template) => template.id),
  );

  return templateNodes
    .filter((node) => !approvedTemplateIds.has(node.templateId))
    .map((node) => ({
      code: "SEND_TEMPLATE_NOT_APPROVED_ON_SERVER",
      message:
        "Selected WhatsApp template must still be approved before publishing.",
      nodeId: node.nodeId,
      severity: "ERROR",
    }));
}

function isPublishConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2034")
  );
}

async function findFlow(companyId: string, flowId: string) {
  return prisma.automationFlow.findFirst({
    where: {
      companyId,
      id: flowId,
    },
  });
}

async function getCurrentPublishedVersion(
  companyId: string,
  publishedVersionId?: string | null,
) {
  if (!publishedVersionId) return null;

  return prisma.automationFlowVersion.findFirst({
    where: {
      companyId,
      id: publishedVersionId,
    },
  });
}

function mapVersionSummary(
  version: {
    id: string;
    isRollback: boolean;
    publishedAt: Date;
    publishedByUserId: string | null;
    publishNotes: string | null;
    validationSnapshot: Prisma.JsonValue | null;
    versionNumber: number;
  },
  publishedVersionId?: string | null,
) {
  return {
    id: version.id,
    isCurrentPublished: version.id === publishedVersionId,
    isRollback: version.isRollback,
    publishedAt: version.publishedAt.toISOString(),
    publishedByUserId: version.publishedByUserId,
    publishNotes: version.publishNotes,
    validationSummary: validationSummary(version.validationSnapshot),
    versionNumber: version.versionNumber,
  };
}

export async function ensureAutomationFlowDraft({
  actorUserId,
  companyId,
  name = "WhatsApp Automation Flow",
}: {
  actorUserId?: string | null;
  companyId: string;
  name?: string;
}) {
  const existing = await prisma.automationFlow.findFirst({
    where: {
      companyId,
      status: {
        not: "ARCHIVED",
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (existing) return existing;

  const { checkCanCreateAutomationFlow } = await import("./automation-plan-limit.service");
  await checkCanCreateAutomationFlow(companyId);

  return prisma.automationFlow.create({
    data: {
      companyId,
      createdByUserId: actorUserId ?? null,
      draftGraph: toJson(createDefaultAutomationGraph()),
      name,
      status: "DRAFT",
      updatedByUserId: actorUserId ?? null,
    },
  });
}

export async function getAutomationFlowDraft(companyId: string, flowId: string) {
  const flow = await findFlow(companyId, flowId);

  if (!flow) return null;

  const draftGraph = graphFromJson(flow.draftGraph);
  const publishedVersion = await getCurrentPublishedVersion(
    companyId,
    flow.publishedVersionId,
  );
  const publishedGraph = publishedVersion
    ? graphFromJson(publishedVersion.graph)
    : null;

  return {
    currentVersionNumber: publishedVersion?.versionNumber ?? null,
    draftGraph,
    flow,
    hasUnpublishedChanges: hasUnpublishedChanges(draftGraph, publishedGraph),
    publishedGraph,
    publishedVersion,
  };
}

export async function saveAutomationFlowDraft(
  companyId: string,
  flowId: string,
  draftGraph: AutomationGraph,
  actorUserId?: string | null,
) {
  const flow = await findFlow(companyId, flowId);

  if (!flow) throw new AutomationFlowNotFoundError();

  const normalizedGraph = normalizeAutomationGraph(draftGraph);
  const { checkCanSaveDraft } = await import("./automation-plan-limit.service");
  await checkCanSaveDraft(companyId, flowId, normalizedGraph);

  const validation = validateAutomationGraph(normalizedGraph);
  const triggerMetadata = extractTriggerMetadata(normalizedGraph);
  const updatedFlow = await prisma.$transaction(async (tx) => {
    const updated = await tx.automationFlow.update({
      where: {
        id: flow.id,
      },
      data: {
        draftGraph: toJson(normalizedGraph),
        isDefault: triggerMetadata.isDefault,
        keywords: triggerMetadata.keywords,
        triggerType: triggerMetadata.triggerType,
        updatedByUserId: actorUserId ?? null,
      },
    });

    await createAuditLogWithClient(tx, {
      action: "AUTOMATION_FLOW_DRAFT_SAVED",
      actorUserId,
      companyId,
      entityId: flow.id,
      entityType: "AutomationFlow",
      metadata: toJson({
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length,
      }),
    });

    return updated;
  });
  const publishedVersion = await getCurrentPublishedVersion(
    companyId,
    updatedFlow.publishedVersionId,
  );
  const publishedGraph = publishedVersion
    ? graphFromJson(publishedVersion.graph)
    : null;

  return {
    draftGraph: normalizedGraph,
    flow: updatedFlow,
    hasUnpublishedChanges: hasUnpublishedChanges(normalizedGraph, publishedGraph),
    publishedVersion,
    validation,
  };
}

async function createVersionInTransaction({
  actorUserId,
  companyId,
  flowId,
  graph,
  isRollback = false,
  publishNotes,
  rollbackFromVersionId,
  tx,
  validation,
}: {
  actorUserId?: string | null;
  companyId: string;
  flowId: string;
  graph: AutomationGraph;
  isRollback?: boolean;
  publishNotes?: string | null;
  rollbackFromVersionId?: string | null;
  tx: Prisma.TransactionClient;
  validation: AutomationGraphValidationResult;
}) {
  const latestVersion = await tx.automationFlowVersion.findFirst({
    where: {
      companyId,
      flowId,
    },
    orderBy: {
      versionNumber: "desc",
    },
  });
  const versionNumber = (latestVersion?.versionNumber ?? 0) + 1;

  return tx.automationFlowVersion.create({
    data: {
      companyId,
      flowId,
      graph: toJson(graph),
      isRollback,
      publishNotes: publishNotes?.trim() || null,
      publishedByUserId: actorUserId ?? null,
      rollbackFromVersionId: rollbackFromVersionId ?? null,
      validationSnapshot: toJson(validationSnapshot(validation)),
      versionNumber,
    },
  });
}

export async function publishAutomationFlow(
  companyId: string,
  flowId: string,
  input: AutomationPublishInput,
  actorUserId?: string | null,
) {
  const flow = await findFlow(companyId, flowId);

  if (!flow) throw new AutomationFlowNotFoundError();

  const normalizedGraph = graphFromJson(flow.draftGraph);

  const { checkCanPublishAutomationFlow } = await import("./automation-plan-limit.service");
  await checkCanPublishAutomationFlow(companyId, flowId, normalizedGraph);

  const validation = validateAutomationGraph(normalizedGraph);
  const templateErrors = await validateApprovedTemplateNodes(
    companyId,
    normalizedGraph,
  );

  if (validation.errors.length > 0 || templateErrors.length > 0) {
    throw new AutomationPublishBlockedError(
      "Fix validation errors before publishing",
      [...validation.errors, ...templateErrors],
      validation.warnings,
      400,
    );
  }

  if (validation.warnings.length > 0 && input.allowWarnings !== true) {
    throw new AutomationPublishBlockedError(
      "Publish has warnings and requires confirmation",
      validation.errors,
      validation.warnings,
      409,
    );
  }

  const triggerMetadata = extractTriggerMetadata(normalizedGraph);

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const version = await createVersionInTransaction({
          actorUserId,
          companyId,
          flowId,
          graph: normalizedGraph,
          publishNotes: input.publishNotes,
          tx,
          validation,
        });
        const publishedAt = new Date();
        const updatedFlow = await tx.automationFlow.update({
          where: {
            id: flow.id,
          },
          data: {
            isDefault: triggerMetadata.isDefault,
            keywords: triggerMetadata.keywords,
            lastPublishedByUserId: actorUserId ?? null,
            publishedAt,
            publishedVersionId: version.id,
            status: "PUBLISHED",
            triggerType: triggerMetadata.triggerType,
            updatedByUserId: actorUserId ?? null,
          },
        });

        await createAuditLogWithClient(tx, {
          action: "AUTOMATION_FLOW_PUBLISHED",
          actorUserId,
          companyId,
          entityId: flow.id,
          entityType: "AutomationFlow",
          metadata: toJson({
            publishNotes: input.publishNotes ?? null,
            versionId: version.id,
            versionNumber: version.versionNumber,
            warningCount: validation.warnings.length,
          }),
        });

        return {
          flow: updatedFlow,
          validation,
          version,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return result;
  } catch (error) {
    if (isPublishConflict(error)) {
      throw new AutomationPublishConflictError();
    }

    throw error;
  }
}

export async function listAutomationFlowVersions(
  companyId: string,
  flowId: string,
) {
  const flow = await findFlow(companyId, flowId);

  if (!flow) throw new AutomationFlowNotFoundError();

  const versions = await prisma.automationFlowVersion.findMany({
    where: {
      companyId,
      flowId,
    },
    orderBy: {
      versionNumber: "desc",
    },
  });

  return {
    flow,
    versions: versions.map((version) =>
      mapVersionSummary(version, flow.publishedVersionId),
    ),
  };
}

export async function getAutomationFlowVersion(
  companyId: string,
  flowId: string,
  versionId: string,
) {
  const flow = await findFlow(companyId, flowId);

  if (!flow) throw new AutomationFlowNotFoundError();

  const version = await prisma.automationFlowVersion.findFirst({
    where: {
      companyId,
      flowId,
      id: versionId,
    },
  });

  if (!version) throw new AutomationFlowNotFoundError();

  return {
    graph: graphFromJson(version.graph),
    isCurrentPublished: version.id === flow.publishedVersionId,
    version,
  };
}

export async function rollbackAutomationFlowVersion(
  companyId: string,
  flowId: string,
  versionId: string,
  actorUserId?: string | null,
  input: AutomationRollbackInput = {},
) {
  const flow = await findFlow(companyId, flowId);

  if (!flow) throw new AutomationFlowNotFoundError();

  const sourceVersion = await prisma.automationFlowVersion.findFirst({
    where: {
      companyId,
      flowId,
      id: versionId,
    },
  });

  if (!sourceVersion) throw new AutomationFlowNotFoundError();

  const graph = graphFromJson(sourceVersion.graph);
  const { checkCanPublishAutomationFlow } = await import("./automation-plan-limit.service");
  await checkCanPublishAutomationFlow(companyId, flowId, graph);

  const validation = validateAutomationGraph(graph);
  const triggerMetadata = extractTriggerMetadata(graph);
  const publishNotes =
    input.publishNotes?.trim() ||
    `Rollback to version ${sourceVersion.versionNumber}`;

  try {
    return await prisma.$transaction(
      async (tx) => {
        const version = await createVersionInTransaction({
          actorUserId,
          companyId,
          flowId,
          graph,
          isRollback: true,
          publishNotes,
          rollbackFromVersionId: sourceVersion.id,
          tx,
          validation,
        });
        const publishedAt = new Date();
        const updatedFlow = await tx.automationFlow.update({
          where: {
            id: flow.id,
          },
          data: {
            draftGraph: toJson(graph),
            isDefault: triggerMetadata.isDefault,
            keywords: triggerMetadata.keywords,
            lastPublishedByUserId: actorUserId ?? null,
            publishedAt,
            publishedVersionId: version.id,
            status: "PUBLISHED",
            triggerType: triggerMetadata.triggerType,
            updatedByUserId: actorUserId ?? null,
          },
        });

        await createAuditLogWithClient(tx, {
          action: "AUTOMATION_FLOW_ROLLED_BACK",
          actorUserId,
          companyId,
          entityId: flow.id,
          entityType: "AutomationFlow",
          metadata: toJson({
            rollbackFromVersionId: sourceVersion.id,
            rollbackFromVersionNumber: sourceVersion.versionNumber,
            versionId: version.id,
            versionNumber: version.versionNumber,
          }),
        });

        return {
          flow: updatedFlow,
          sourceVersion,
          validation,
          version,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error) {
    if (isPublishConflict(error)) {
      throw new AutomationPublishConflictError();
    }

    throw error;
  }
}

export async function pauseAutomationFlow(
  companyId: string,
  flowId: string,
  actorUserId?: string | null,
) {
  const flow = await findFlow(companyId, flowId);

  if (!flow) throw new AutomationFlowNotFoundError();

  return prisma.$transaction(async (tx) => {
    const updated = await tx.automationFlow.update({
      where: {
        id: flow.id,
      },
      data: {
        status: "PAUSED",
        updatedByUserId: actorUserId ?? null,
      },
    });

    await createAuditLogWithClient(tx, {
      action: "AUTOMATION_FLOW_PAUSED",
      actorUserId,
      companyId,
      entityId: flow.id,
      entityType: "AutomationFlow",
      metadata: {},
    });

    return updated;
  });
}

export async function resumeAutomationFlow(
  companyId: string,
  flowId: string,
  actorUserId?: string | null,
) {
  const flow = await findFlow(companyId, flowId);

  if (!flow) throw new AutomationFlowNotFoundError();

  if (!flow.publishedVersionId) {
    throw new AutomationPublishBlockedError(
      "Publish the flow before resuming it",
      [],
      [],
      400,
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.automationFlow.update({
      where: {
        id: flow.id,
      },
      data: {
        status: "PUBLISHED",
        updatedByUserId: actorUserId ?? null,
      },
    });

    await createAuditLogWithClient(tx, {
      action: "AUTOMATION_FLOW_RESUMED",
      actorUserId,
      companyId,
      entityId: flow.id,
      entityType: "AutomationFlow",
      metadata: {},
    });

    return updated;
  });
}

export async function archiveAutomationFlow(
  companyId: string,
  flowId: string,
  actorUserId?: string | null,
) {
  const flow = await findFlow(companyId, flowId);

  if (!flow) throw new AutomationFlowNotFoundError();

  return prisma.$transaction(async (tx) => {
    const updated = await tx.automationFlow.update({
      where: {
        id: flow.id,
      },
      data: {
        status: "ARCHIVED",
        updatedByUserId: actorUserId ?? null,
      },
    });

    await createAuditLogWithClient(tx, {
      action: "AUTOMATION_FLOW_ARCHIVED",
      actorUserId,
      companyId,
      entityId: flow.id,
      entityType: "AutomationFlow",
      metadata: {},
    });

    return updated;
  });
}

export async function getRunnablePublishedVersion(
  companyId: string,
  flowId: string,
) {
  const flow = await prisma.automationFlow.findFirst({
    where: {
      companyId,
      id: flowId,
      publishedVersionId: {
        not: null,
      },
      status: "PUBLISHED",
    },
  });

  if (!flow?.publishedVersionId) return null;

  const version = await prisma.automationFlowVersion.findFirst({
    where: {
      companyId,
      flowId: flow.id,
      id: flow.publishedVersionId,
    },
  });

  if (!version) return null;

  return {
    flow,
    graph: graphFromJson(version.graph),
    version,
  };
}
