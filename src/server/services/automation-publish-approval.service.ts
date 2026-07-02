import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { createAuditLogWithClient } from "@/server/services/audit.service";
import {
  normalizeAutomationGraph,
  validateAutomationGraph,
} from "@/lib/automation-builder/graph-validation";
import {
  graphFromJson,
  toJson,
  validationSnapshot,
} from "@/server/services/automation-versioning.service";
import { requireAutomationPermission } from "./automation-permission.service";
import type {
  ApprovePublishRequestInput,
  CreatePublishRequestInput,
  ListPublishRequestsQuery,
  RejectPublishRequestInput,
} from "../validators/automation-publish-approval.validator";

export class PublishRequestNotFoundError extends Error {
  constructor(requestId: string) {
    super(`Publish request with ID "${requestId}" was not found.`);
    this.name = "PublishRequestNotFoundError";
  }
}

export class InvalidPublishRequestStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPublishRequestStateError";
  }
}

export async function createPublishRequest(
  companyId: string,
  flowId: string,
  requestedByUserId: string,
  input: CreatePublishRequestInput
) {
  await requireAutomationPermission(companyId, requestedByUserId, "automation.flow.request_publish");

  const flow = await prisma.automationFlow.findFirst({
    where: { id: flowId, companyId },
  });

  if (!flow) {
    throw new Error(`Automation flow with ID "${flowId}" was not found.`);
  }

  const normalizedGraph = normalizeAutomationGraph(graphFromJson(flow.draftGraph));
  const validation = validateAutomationGraph(normalizedGraph);

  if (validation.errors.length > 0) {
    throw new InvalidPublishRequestStateError(
      `Cannot request approval for invalid flow graph. (${validation.errors.length} errors found)`
    );
  }

  return prisma.$transaction(async (tx) => {
    // Mark any previous PENDING request for this flow as SUPERSEDED
    await tx.automationPublishRequest.updateMany({
      where: {
        companyId,
        flowId,
        status: "PENDING",
      },
      data: {
        status: "SUPERSEDED",
      },
    });

    const request = await tx.automationPublishRequest.create({
      data: {
        companyId,
        flowId,
        status: "PENDING",
        requestedByUserId,
        draftGraph: toJson(normalizedGraph),
        validationSnapshot: toJson(validationSnapshot(validation)),
        publishNotes: input.publishNotes?.trim() || null,
      },
    });

    await createAuditLogWithClient(tx, {
      action: "AUTOMATION_PUBLISH_REQUESTED",
      actorUserId: requestedByUserId,
      companyId,
      entityId: request.id,
      entityType: "AutomationPublishRequest",
      metadata: toJson({
        flowId,
        publishNotes: input.publishNotes,
        warningCount: validation.warnings.length,
      }),
    });

    return request;
  });
}

export async function listPublishRequests(
  companyId: string,
  userId: string,
  userRole: string,
  query: ListPublishRequestsQuery
) {
  const isManagement = userRole === "OWNER" || userRole === "ADMIN";

  const where: Prisma.AutomationPublishRequestWhereInput = {
    companyId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.flowId ? { flowId: query.flowId } : {}),
    ...(!isManagement ? { requestedByUserId: userId } : {}),
  };

  const total = await prisma.automationPublishRequest.count({ where });
  const totalPages = Math.ceil(total / query.pageSize) || 1;

  const requests = await prisma.automationPublishRequest.findMany({
    where,
    include: {
      flow: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });

  return {
    requests,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages,
    },
  };
}

export async function getPublishRequestById(
  companyId: string,
  requestId: string
) {
  const request = await prisma.automationPublishRequest.findFirst({
    where: { id: requestId, companyId },
    include: {
      flow: true,
    },
  });

  if (!request) {
    throw new PublishRequestNotFoundError(requestId);
  }

  return request;
}

export async function approvePublishRequest(
  companyId: string,
  requestId: string,
  reviewerUserId: string,
  input: ApprovePublishRequestInput
) {
  await requireAutomationPermission(companyId, reviewerUserId, "automation.flow.approve_publish");

  const request = await prisma.automationPublishRequest.findFirst({
    where: { id: requestId, companyId },
    include: { flow: true },
  });

  if (!request) {
    throw new PublishRequestNotFoundError(requestId);
  }

  if (request.status !== "PENDING") {
    throw new InvalidPublishRequestStateError(
      `Cannot approve request with status "${request.status}". It must be PENDING.`
    );
  }

  const snapshotGraph = graphFromJson(request.draftGraph);
  const validation = validateAutomationGraph(snapshotGraph);

  if (validation.errors.length > 0) {
    throw new InvalidPublishRequestStateError(
      `Cannot approve publish request. Snapshot graph contains ${validation.errors.length} errors.`
    );
  }

  return prisma.$transaction(async (tx) => {
    // 1. Calculate next version number
    const latestVersion = await tx.automationFlowVersion.findFirst({
      where: { companyId, flowId: request.flowId },
      orderBy: { versionNumber: "desc" },
    });
    const versionNumber = (latestVersion?.versionNumber ?? 0) + 1;

    // 2. Create new AutomationFlowVersion from request.draftGraph snapshot
    const version = await tx.automationFlowVersion.create({
      data: {
        companyId,
        flowId: request.flowId,
        graph: request.draftGraph as Prisma.InputJsonValue,
        versionNumber,
        publishNotes: input.reviewNote?.trim() || request.publishNotes || "Approved publish request",
        publishedByUserId: reviewerUserId,
        validationSnapshot: toJson(validationSnapshot(validation)),
      },
    });

    // 3. Update AutomationFlow publishedVersionId and status
    await tx.automationFlow.update({
      where: { id: request.flowId },
      data: {
        status: "PUBLISHED",
        publishedVersionId: version.id,
        publishedAt: new Date(),
        lastPublishedByUserId: reviewerUserId,
      },
    });

    // 4. Update request status to APPROVED
    const updatedRequest = await tx.automationPublishRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
      },
    });

    // 5. Audit Log
    await createAuditLogWithClient(tx, {
      action: "AUTOMATION_PUBLISH_APPROVED",
      actorUserId: reviewerUserId,
      companyId,
      entityId: request.id,
      entityType: "AutomationPublishRequest",
      metadata: toJson({
        flowId: request.flowId,
        versionId: version.id,
        versionNumber,
      }),
    });

    return updatedRequest;
  });
}

export async function rejectPublishRequest(
  companyId: string,
  requestId: string,
  reviewerUserId: string,
  input: RejectPublishRequestInput
) {
  await requireAutomationPermission(companyId, reviewerUserId, "automation.flow.reject_publish");

  const request = await prisma.automationPublishRequest.findFirst({
    where: { id: requestId, companyId },
  });

  if (!request) {
    throw new PublishRequestNotFoundError(requestId);
  }

  if (request.status !== "PENDING") {
    throw new InvalidPublishRequestStateError(
      `Cannot reject request with status "${request.status}". It must be PENDING.`
    );
  }

  return prisma.$transaction(async (tx) => {
    const updatedRequest = await tx.automationPublishRequest.update({
      where: { id: request.id },
      data: {
        status: "REJECTED",
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
        rejectionReason: input.rejectionReason.trim(),
      },
    });

    await createAuditLogWithClient(tx, {
      action: "AUTOMATION_PUBLISH_REJECTED",
      actorUserId: reviewerUserId,
      companyId,
      entityId: request.id,
      entityType: "AutomationPublishRequest",
      metadata: toJson({
        flowId: request.flowId,
        rejectionReason: input.rejectionReason,
      }),
    });

    return updatedRequest;
  });
}

export async function cancelPublishRequest(
  companyId: string,
  requestId: string,
  userId: string,
  userRole: string
) {
  const request = await prisma.automationPublishRequest.findFirst({
    where: { id: requestId, companyId },
  });

  if (!request) {
    throw new PublishRequestNotFoundError(requestId);
  }

  const isManagement = userRole === "OWNER" || userRole === "ADMIN";
  if (!isManagement && request.requestedByUserId !== userId) {
    throw new InvalidPublishRequestStateError("You can only cancel your own pending publish requests.");
  }

  if (request.status !== "PENDING") {
    throw new InvalidPublishRequestStateError(
      `Cannot cancel request with status "${request.status}". It must be PENDING.`
    );
  }

  return prisma.$transaction(async (tx) => {
    const updatedRequest = await tx.automationPublishRequest.update({
      where: { id: request.id },
      data: {
        status: "CANCELLED",
      },
    });

    await createAuditLogWithClient(tx, {
      action: "AUTOMATION_PUBLISH_CANCELLED",
      actorUserId: userId,
      companyId,
      entityId: request.id,
      entityType: "AutomationPublishRequest",
      metadata: toJson({
        flowId: request.flowId,
      }),
    });

    return updatedRequest;
  });
}
