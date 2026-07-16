import { randomBytes } from "node:crypto";
import { promises as dns } from "node:dns";
import {
  CompanyType,
  PartnerClientTransferStatus,
  PartnerDomainOwnershipChallengeStatus,
  PartnerOffboardingStatus,
  PlatformApprovalRequestStatus,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createPlatformAuditLog } from "@/server/services/platform-audit.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";
import type {
  CreatePartnerClientTransferRequestInput,
  CreatePartnerOffboardingRunInput,
  CreatePlatformApprovalRequestInput,
  PlatformApprovalDecisionInput,
} from "@/server/validators/enterprise-hardening.validator";

export class EnterpriseHardeningError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "EnterpriseHardeningError";
    this.status = status;
  }
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

async function assertPartnerCompany(partnerCompanyId: string) {
  const partner = await prisma.company.findUnique({
    where: { id: partnerCompanyId },
    select: { id: true, name: true, type: true, status: true },
  });

  if (!partner || partner.type !== CompanyType.PARTNER) {
    throw new EnterpriseHardeningError("Partner company not found.", 404);
  }

  return partner;
}

async function assertPartnerClientRelationship({
  clientCompanyId,
  partnerCompanyId,
}: {
  partnerCompanyId: string;
  clientCompanyId: string;
}) {
  const relationship = await prisma.partnerClientRelationship.findUnique({
    where: {
      partnerCompanyId_clientCompanyId: {
        partnerCompanyId,
        clientCompanyId,
      },
    },
    include: {
      clientCompany: { select: { id: true, name: true, type: true, status: true } },
    },
  });

  if (!relationship) {
    throw new EnterpriseHardeningError("Client does not belong to this partner.", 404);
  }

  return relationship;
}

export async function listPlatformApprovalRequests() {
  return prisma.platformApprovalRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      company: { select: { id: true, name: true, type: true, status: true } },
      requestedBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
      rejectedBy: { select: { id: true, name: true, email: true } },
    },
    take: 200,
  });
}

export async function createPlatformApprovalRequest({
  actorEmail,
  actorUserId,
  input,
}: {
  actorUserId?: string | null;
  actorEmail?: string | null;
  input: CreatePlatformApprovalRequestInput;
}) {
  const approval = await prisma.platformApprovalRequest.create({
    data: {
      type: input.type,
      companyId: input.companyId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      reason: input.reason,
      riskLevel: input.riskLevel,
      requestedByUserId: actorUserId ?? null,
      expiresAt: addDays(new Date(), 7),
      metadata: input.metadata ? safeJson(input.metadata) : undefined,
    },
  });

  await createPlatformAuditLog({
    actorUserId,
    actorEmail,
    action: "platform_approval.requested",
    entityType: "PlatformApprovalRequest",
    entityId: approval.id,
    metadata: {
      type: approval.type,
      targetEntityType: approval.entityType,
      targetEntityId: approval.entityId,
      riskLevel: approval.riskLevel,
    },
  }).catch(() => undefined);

  return approval;
}

export async function decidePlatformApprovalRequest({
  actorEmail,
  actorUserId,
  approvalId,
  input,
}: {
  actorUserId?: string | null;
  actorEmail?: string | null;
  approvalId: string;
  input: PlatformApprovalDecisionInput;
}) {
  const approval = await prisma.platformApprovalRequest.findUnique({
    where: { id: approvalId },
  });

  if (!approval) {
    throw new EnterpriseHardeningError("Approval request not found.", 404);
  }

  if (approval.status !== PlatformApprovalRequestStatus.PENDING) {
    throw new EnterpriseHardeningError("Approval request is already decided.");
  }

  if (approval.expiresAt && approval.expiresAt.getTime() < Date.now()) {
    await prisma.platformApprovalRequest.update({
      where: { id: approval.id },
      data: { status: PlatformApprovalRequestStatus.EXPIRED },
    });
    throw new EnterpriseHardeningError("Approval request has expired.");
  }

  if (input.decision === "approve" && approval.requestedByUserId === actorUserId) {
    throw new EnterpriseHardeningError(
      "Two-person approval is required. The requester cannot approve this action.",
      403,
    );
  }

  const now = new Date();
  const status =
    input.decision === "approve"
      ? PlatformApprovalRequestStatus.APPROVED
      : input.decision === "reject"
        ? PlatformApprovalRequestStatus.REJECTED
        : PlatformApprovalRequestStatus.CANCELED;

  const updated = await prisma.platformApprovalRequest.update({
    where: { id: approval.id },
    data: {
      status,
      decidedAt: now,
      decisionReason: input.reason,
      approvedByUserId:
        status === PlatformApprovalRequestStatus.APPROVED ? actorUserId ?? null : null,
      rejectedByUserId:
        status === PlatformApprovalRequestStatus.REJECTED ? actorUserId ?? null : null,
    },
  });

  await createPlatformAuditLog({
    actorUserId,
    actorEmail,
    action: `platform_approval.${input.decision}`,
    entityType: "PlatformApprovalRequest",
    entityId: updated.id,
    metadata: {
      type: updated.type,
      targetEntityType: updated.entityType,
      targetEntityId: updated.entityId,
      decisionReason: input.reason,
    },
  }).catch(() => undefined);

  return updated;
}

export async function requestPartnerOffboarding({
  actorEmail,
  actorUserId,
  input,
}: {
  actorUserId?: string | null;
  actorEmail?: string | null;
  input: CreatePartnerOffboardingRunInput;
}) {
  const partner = await assertPartnerCompany(input.partnerCompanyId);

  const run = await prisma.partnerOffboardingRun.create({
    data: {
      partnerCompanyId: partner.id,
      createdByUserId: actorUserId ?? null,
      status: PartnerOffboardingStatus.PENDING_APPROVAL,
      reason: input.reason,
      clientPolicy: input.clientPolicy,
      transferTargets: input.transferTargets ? safeJson(input.transferTargets) : undefined,
      checklist: input.checklist ? safeJson(input.checklist) : undefined,
    },
  });

  const approval = await createPlatformApprovalRequest({
    actorEmail,
    actorUserId,
    input: {
      type: "PARTNER_OFFBOARDING",
      companyId: partner.id,
      entityType: "PartnerOffboardingRun",
      entityId: run.id,
      action: "partner.offboarding.approve",
      reason: input.reason,
      riskLevel: 5,
      metadata: {
        partnerCompanyId: partner.id,
        clientPolicy: input.clientPolicy,
      },
    },
  });

  const updated = await prisma.partnerOffboardingRun.update({
    where: { id: run.id },
    data: { approvalRequestId: approval.id },
  });

  await createPlatformAuditLog({
    actorUserId,
    actorEmail,
    action: "partner_offboarding.requested",
    entityType: "PartnerOffboardingRun",
    entityId: updated.id,
    metadata: {
      partnerCompanyId: partner.id,
      approvalRequestId: approval.id,
      clientPolicy: input.clientPolicy,
    },
  }).catch(() => undefined);

  return updated;
}

export async function requestPartnerClientTransfer({
  actorEmail,
  actorUserId,
  input,
}: {
  actorUserId?: string | null;
  actorEmail?: string | null;
  input: CreatePartnerClientTransferRequestInput;
}) {
  await assertPartnerCompany(input.fromPartnerCompanyId);
  if (input.toPartnerCompanyId) {
    await assertPartnerCompany(input.toPartnerCompanyId);
  }

  const relationship = await assertPartnerClientRelationship({
    partnerCompanyId: input.fromPartnerCompanyId,
    clientCompanyId: input.clientCompanyId,
  });

  const transfer = await prisma.partnerClientTransferRequest.create({
    data: {
      fromPartnerCompanyId: input.fromPartnerCompanyId,
      toPartnerCompanyId: input.toPartnerCompanyId ?? null,
      clientCompanyId: input.clientCompanyId,
      relationshipId: relationship.id,
      requestedByUserId: actorUserId ?? null,
      status: PartnerClientTransferStatus.PENDING_APPROVAL,
      reason: input.reason,
      transferMode: input.transferMode,
      metadata: input.metadata ? safeJson(input.metadata) : undefined,
    },
  });

  const approval = await createPlatformApprovalRequest({
    actorEmail,
    actorUserId,
    input: {
      type: "PARTNER_CLIENT_TRANSFER",
      companyId: input.fromPartnerCompanyId,
      entityType: "PartnerClientTransferRequest",
      entityId: transfer.id,
      action: "partner.client_transfer.approve",
      reason: input.reason,
      riskLevel: 5,
      metadata: {
        fromPartnerCompanyId: input.fromPartnerCompanyId,
        toPartnerCompanyId: input.toPartnerCompanyId ?? null,
        clientCompanyId: input.clientCompanyId,
        transferMode: input.transferMode,
      },
    },
  });

  const updated = await prisma.partnerClientTransferRequest.update({
    where: { id: transfer.id },
    data: { approvalRequestId: approval.id },
  });

  await createPlatformAuditLog({
    actorUserId,
    actorEmail,
    action: "partner_client_transfer.requested",
    entityType: "PartnerClientTransferRequest",
    entityId: updated.id,
    metadata: {
      approvalRequestId: approval.id,
      fromPartnerCompanyId: input.fromPartnerCompanyId,
      toPartnerCompanyId: input.toPartnerCompanyId ?? null,
      clientCompanyId: input.clientCompanyId,
    },
  }).catch(() => undefined);

  return updated;
}

export async function createPartnerDomainOwnershipChallenge({
  domainId,
  partnerCompanyId,
  normalizedHost,
}: {
  partnerCompanyId: string;
  domainId?: string | null;
  normalizedHost: string;
}) {
  const token = randomBytes(18).toString("hex");
  return prisma.partnerDomainOwnershipChallenge.create({
    data: {
      partnerCompanyId,
      domainId: domainId ?? null,
      normalizedHost,
      token,
      txtName: `_metawhat-transfer.${normalizedHost}`,
      txtValue: `metawhat-domain-ownership=${token}`,
      expiresAt: addDays(new Date(), 7),
      metadata: safeJson({
        purpose: "domain_takeover_protection",
      }),
    },
  });
}

export async function verifyPartnerDomainOwnershipChallenge({
  actorEmail,
  actorUserId,
  domainId,
}: {
  actorUserId?: string | null;
  actorEmail?: string | null;
  domainId: string;
}) {
  const challenge = await prisma.partnerDomainOwnershipChallenge.findFirst({
    where: {
      domainId,
      status: PartnerDomainOwnershipChallengeStatus.PENDING,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!challenge) {
    throw new EnterpriseHardeningError("No pending ownership challenge found.", 404);
  }

  if (challenge.expiresAt.getTime() < Date.now()) {
    const expired = await prisma.partnerDomainOwnershipChallenge.update({
      where: { id: challenge.id },
      data: {
        status: PartnerDomainOwnershipChallengeStatus.EXPIRED,
        failureReason: "Ownership challenge expired.",
        lastCheckedAt: new Date(),
      },
    });
    return expired;
  }

  let verified = false;
  let txtValues: string[] = [];
  try {
    const records = await dns.resolveTxt(challenge.txtName);
    txtValues = records.map((record) => record.join(""));
    verified = txtValues.includes(challenge.txtValue);
  } catch {
    txtValues = [];
  }

  const updated = await prisma.partnerDomainOwnershipChallenge.update({
    where: { id: challenge.id },
    data: {
      status: verified
        ? PartnerDomainOwnershipChallengeStatus.VERIFIED
        : PartnerDomainOwnershipChallengeStatus.FAILED,
      verifiedAt: verified ? new Date() : null,
      failedAt: verified ? null : new Date(),
      lastCheckedAt: new Date(),
      failureReason: verified ? null : "Expected ownership TXT record was not found.",
      metadata: safeJson({
        expectedTxtName: challenge.txtName,
        expectedTxtValue: challenge.txtValue,
        observedTxtValues: txtValues,
      }),
    },
  });

  await createPlatformAuditLog({
    actorUserId,
    actorEmail,
    action: "partner_domain.ownership_challenge_checked",
    entityType: "PartnerDomainOwnershipChallenge",
    entityId: updated.id,
    metadata: {
      domainId,
      normalizedHost: updated.normalizedHost,
      status: updated.status,
    },
  }).catch(() => undefined);

  return updated;
}
