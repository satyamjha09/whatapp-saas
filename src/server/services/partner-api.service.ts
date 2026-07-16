import { CompanyStatus, CompanyType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createPartnerClientProvisioningJob } from "@/server/services/partner-client-provisioning.service";
import { createPlatformAuditLog } from "@/server/services/platform-audit.service";
import { publishPartnerWebhookEvent } from "@/server/services/partner-webhook.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";
import type {
  PartnerApiCreateClientInput,
  PartnerApiUpdateClientInput,
} from "@/server/validators/partner-api.validator";

export class PartnerApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PartnerApiError";
    this.status = status;
  }
}

const relationshipInclude = {
  clientCompany: {
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      suspendedAt: true,
      suspensionReason: true,
      billingPlan: true,
      subscriptionStatus: true,
    },
  },
  subscriptions: {
    orderBy: { createdAt: "desc" },
    take: 1,
  },
} satisfies Prisma.PartnerClientRelationshipInclude;

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function serializeRelationship(
  relationship: Prisma.PartnerClientRelationshipGetPayload<{
    include: typeof relationshipInclude;
  }>,
) {
  return {
    id: relationship.id,
    partnerCompanyId: relationship.partnerCompanyId,
    clientCompanyId: relationship.clientCompanyId,
    status: relationship.status,
    displayName: relationship.displayName,
    externalClientReference: relationship.externalClientReference,
    activatedAt: relationship.activatedAt,
    archivedAt: relationship.archivedAt,
    metadata: relationship.metadata,
    client: relationship.clientCompany,
    subscription: relationship.subscriptions[0] ?? null,
    createdAt: relationship.createdAt,
    updatedAt: relationship.updatedAt,
  };
}

async function assertPartnerApiCompany(partnerCompanyId: string) {
  const partner = await prisma.company.findUnique({
    where: { id: partnerCompanyId },
    select: { id: true, name: true, type: true, status: true },
  });

  if (!partner) throw new PartnerApiError("Partner workspace not found.", 404);
  if (partner.type !== CompanyType.PARTNER) {
    throw new PartnerApiError("API key is not attached to a partner workspace.", 403);
  }
  if (partner.status !== CompanyStatus.ACTIVE) {
    throw new PartnerApiError("Partner workspace is not active.", 403);
  }

  return partner;
}

async function getRelationshipOrThrow({
  clientCompanyId,
  partnerCompanyId,
}: {
  partnerCompanyId: string;
  clientCompanyId: string;
}) {
  const relationship = await prisma.partnerClientRelationship.findUnique({
    where: {
      partnerCompanyId_clientCompanyId: { partnerCompanyId, clientCompanyId },
    },
    include: relationshipInclude,
  });

  if (!relationship) {
    throw new PartnerApiError("Client does not belong to this partner.", 404);
  }

  return relationship;
}

async function resolveActorUserId({
  apiKeyCreatedByUserId,
  partnerCompanyId,
}: {
  partnerCompanyId: string;
  apiKeyCreatedByUserId?: string | null;
}) {
  if (apiKeyCreatedByUserId) return apiKeyCreatedByUserId;

  const membership = await prisma.companyUser.findFirst({
    where: { companyId: partnerCompanyId, role: { in: ["OWNER", "ADMIN"] } },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });

  if (!membership) {
    throw new PartnerApiError("Partner workspace has no API actor user.", 403);
  }

  return membership.userId;
}

export async function listPartnerApiClients(partnerCompanyId: string) {
  await assertPartnerApiCompany(partnerCompanyId);
  const clients = await prisma.partnerClientRelationship.findMany({
    where: { partnerCompanyId },
    include: relationshipInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return {
    clients: clients.map(serializeRelationship),
  };
}

export async function createPartnerApiClient({
  apiKeyCreatedByUserId,
  idempotencyKey,
  input,
  partnerCompanyId,
}: {
  partnerCompanyId: string;
  apiKeyCreatedByUserId?: string | null;
  idempotencyKey?: string | null;
  input: PartnerApiCreateClientInput;
}) {
  await assertPartnerApiCompany(partnerCompanyId);
  const actorUserId = await resolveActorUserId({
    partnerCompanyId,
    apiKeyCreatedByUserId,
  });

  const job = await createPartnerClientProvisioningJob({
    actorUserId,
    idempotencyKey,
    input: {
      ...input,
      partnerCompanyId,
      idempotencyKey: idempotencyKey ?? undefined,
    },
  });

  if (!job) {
    throw new PartnerApiError("Partner client provisioning job could not be created.", 500);
  }

  await publishPartnerWebhookEvent({
    partnerCompanyId,
    eventType: "partner.client.provisioning_started",
    idempotencyKey: `partner-client-provisioning-started:${job.id}`,
    payload: safeJson({
      jobId: job.id,
      status: job.status,
      requestedCompanyName: job.requestedCompanyName,
      requestedOwnerEmail: job.requestedOwnerEmail,
      externalClientReference: job.externalClientReference,
    }),
  }).catch(() => undefined);

  return { job };
}

export async function getPartnerApiClient({
  clientCompanyId,
  partnerCompanyId,
}: {
  partnerCompanyId: string;
  clientCompanyId: string;
}) {
  await assertPartnerApiCompany(partnerCompanyId);
  return {
    client: serializeRelationship(
      await getRelationshipOrThrow({ partnerCompanyId, clientCompanyId }),
    ),
  };
}

export async function updatePartnerApiClient({
  actorUserId,
  input,
  clientCompanyId,
  partnerCompanyId,
}: {
  partnerCompanyId: string;
  clientCompanyId: string;
  actorUserId?: string | null;
  input: PartnerApiUpdateClientInput;
}) {
  await assertPartnerApiCompany(partnerCompanyId);
  await getRelationshipOrThrow({ partnerCompanyId, clientCompanyId });

  const updated = await prisma.partnerClientRelationship.update({
    where: {
      partnerCompanyId_clientCompanyId: { partnerCompanyId, clientCompanyId },
    },
    data: {
      ...(input.displayName ? { displayName: input.displayName } : {}),
      ...(input.externalClientReference !== undefined
        ? { externalClientReference: input.externalClientReference || null }
        : {}),
      ...(input.metadata !== undefined
        ? { metadata: input.metadata ? safeJson(input.metadata) : Prisma.JsonNull }
        : {}),
    },
    include: relationshipInclude,
  });

  await createPlatformAuditLog({
    actorUserId,
    action: "partner_api.client_updated",
    entityType: "PartnerClientRelationship",
    entityId: updated.id,
    metadata: { partnerCompanyId, clientCompanyId, input },
  }).catch(() => undefined);

  return { client: serializeRelationship(updated) };
}

export async function suspendPartnerApiClient({
  actorUserId,
  clientCompanyId,
  partnerCompanyId,
}: {
  partnerCompanyId: string;
  clientCompanyId: string;
  actorUserId?: string | null;
}) {
  await assertPartnerApiCompany(partnerCompanyId);
  const relationship = await getRelationshipOrThrow({
    partnerCompanyId,
    clientCompanyId,
  });

  const [updated] = await prisma.$transaction([
    prisma.partnerClientRelationship.update({
      where: { id: relationship.id },
      data: { status: "SUSPENDED" },
      include: relationshipInclude,
    }),
    prisma.company.update({
      where: { id: clientCompanyId },
      data: {
        status: "SUSPENDED",
        suspendedAt: new Date(),
        suspensionReason: "Suspended by partner API",
      },
    }),
  ]);

  await publishPartnerWebhookEvent({
    partnerCompanyId,
    eventType: "partner.client.suspended",
    idempotencyKey: `partner-client-suspended:${relationship.id}:${Date.now()}`,
    payload: safeJson({ clientCompanyId, relationshipId: relationship.id }),
  }).catch(() => undefined);

  await createPlatformAuditLog({
    actorUserId,
    action: "partner_api.client_suspended",
    entityType: "PartnerClientRelationship",
    entityId: relationship.id,
    metadata: { partnerCompanyId, clientCompanyId },
  }).catch(() => undefined);

  return { client: serializeRelationship(updated) };
}

export async function reactivatePartnerApiClient({
  actorUserId,
  clientCompanyId,
  partnerCompanyId,
}: {
  partnerCompanyId: string;
  clientCompanyId: string;
  actorUserId?: string | null;
}) {
  await assertPartnerApiCompany(partnerCompanyId);
  const relationship = await getRelationshipOrThrow({
    partnerCompanyId,
    clientCompanyId,
  });

  const [updated] = await prisma.$transaction([
    prisma.partnerClientRelationship.update({
      where: { id: relationship.id },
      data: { status: "ACTIVE" },
      include: relationshipInclude,
    }),
    prisma.company.update({
      where: { id: clientCompanyId },
      data: {
        status: "ACTIVE",
        suspendedAt: null,
        suspensionReason: null,
      },
    }),
  ]);

  await publishPartnerWebhookEvent({
    partnerCompanyId,
    eventType: "partner.client.reactivated",
    idempotencyKey: `partner-client-reactivated:${relationship.id}:${Date.now()}`,
    payload: safeJson({ clientCompanyId, relationshipId: relationship.id }),
  }).catch(() => undefined);

  await createPlatformAuditLog({
    actorUserId,
    action: "partner_api.client_reactivated",
    entityType: "PartnerClientRelationship",
    entityId: relationship.id,
    metadata: { partnerCompanyId, clientCompanyId },
  }).catch(() => undefined);

  return { client: serializeRelationship(updated) };
}

export async function getPartnerApiClientUsage({
  clientCompanyId,
  partnerCompanyId,
}: {
  partnerCompanyId: string;
  clientCompanyId: string;
}) {
  await getRelationshipOrThrow({ partnerCompanyId, clientCompanyId });

  const usage = await prisma.partnerClientUsageDaily.findMany({
    where: { partnerCompanyId, clientCompanyId },
    orderBy: { date: "desc" },
    take: 90,
  });

  return { usage };
}

export async function listPartnerApiSubscriptions(partnerCompanyId: string) {
  await assertPartnerApiCompany(partnerCompanyId);
  return {
    subscriptions: await prisma.partnerClientSubscription.findMany({
      where: { partnerCompanyId },
      include: {
        clientCompany: { select: { id: true, name: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  };
}

export async function listPartnerApiInvoices(partnerCompanyId: string) {
  await assertPartnerApiCompany(partnerCompanyId);
  return {
    invoices: await prisma.partnerBillingInvoice.findMany({
      where: { partnerCompanyId },
      include: {
        clientCompany: { select: { id: true, name: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  };
}

export async function listPartnerApiCommissions(partnerCompanyId: string) {
  await assertPartnerApiCompany(partnerCompanyId);
  return {
    commissions: await prisma.partnerCommissionAccrual.findMany({
      where: { partnerCompanyId },
      include: {
        clientCompany: { select: { id: true, name: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  };
}

export async function listPartnerApiPayouts(partnerCompanyId: string) {
  await assertPartnerApiCompany(partnerCompanyId);
  return {
    payouts: await prisma.partnerPayout.findMany({
      where: { partnerCompanyId },
      orderBy: { requestedAt: "desc" },
      take: 200,
    }),
  };
}
