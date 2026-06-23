import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  computeAuditIntegrityHash,
  getLatestAuditIntegrityHash,
} from "@/server/services/audit-integrity.service";

type CreateAuditLogInput = {
  companyId: string;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

type AuditLogClient = Pick<typeof prisma, "auditLog"> | Prisma.TransactionClient;

export async function createAuditLogWithClient(
  client: AuditLogClient,
  input: CreateAuditLogInput,
) {
  const previousIntegrityHash = await getLatestAuditIntegrityHash({
    companyId: input.companyId,
    client,
  });

  const auditLog = await client.auditLog.create({
    data: {
      companyId: input.companyId,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? {},
      previousIntegrityHash,
      integrityVersion: 1,
    },
  });

  const integrityHash = computeAuditIntegrityHash({
    id: auditLog.id,
    companyId: auditLog.companyId,
    actorUserId: auditLog.actorUserId,
    action: auditLog.action,
    entityType: auditLog.entityType,
    entityId: auditLog.entityId,
    metadata: auditLog.metadata,
    createdAt: auditLog.createdAt,
    previousIntegrityHash: auditLog.previousIntegrityHash,
    integrityVersion: auditLog.integrityVersion,
  });

  return client.auditLog.update({
    where: {
      id: auditLog.id,
    },
    data: {
      integrityHash,
    },
  });
}

export async function createAuditLog(input: CreateAuditLogInput) {
  return createAuditLogWithClient(prisma, input);
}

export async function getAuditLogsByCompany(companyId: string) {
  return prisma.auditLog.findMany({
    where: {
      companyId,
    },
    include: {
      actor: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });
}
