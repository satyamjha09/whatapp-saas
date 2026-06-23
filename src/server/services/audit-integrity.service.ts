import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

type AuditIntegrityPayload = {
  id: string;
  companyId: string;
  actorUserId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: unknown;
  createdAt: Date;
  previousIntegrityHash?: string | null;
  integrityVersion: number;
};

type AuditIntegrityClient = Pick<
  typeof prisma,
  "auditLog"
> | Prisma.TransactionClient;

function getAuditHashSecret() {
  const secret = process.env.AUDIT_LOG_HASH_SECRET ?? process.env.ENCRYPTION_KEY;

  if (!secret || secret.length < 32) {
    throw new Error("AUDIT_LOG_HASH_SECRET must be at least 32 characters");
  }

  return secret;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const record = value as Record<string, unknown>;

  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function computeAuditIntegrityHash(payload: AuditIntegrityPayload) {
  const canonicalPayload = {
    id: payload.id,
    companyId: payload.companyId,
    actorUserId: payload.actorUserId ?? null,
    action: payload.action,
    entityType: payload.entityType ?? null,
    entityId: payload.entityId ?? null,
    metadata: payload.metadata ?? null,
    createdAt: payload.createdAt.toISOString(),
    previousIntegrityHash: payload.previousIntegrityHash ?? null,
    integrityVersion: payload.integrityVersion,
  };

  return crypto
    .createHmac("sha256", getAuditHashSecret())
    .update(stableStringify(canonicalPayload))
    .digest("hex");
}

export async function getLatestAuditIntegrityHash({
  companyId,
  client = prisma,
}: {
  companyId: string;
  client?: AuditIntegrityClient;
}) {
  const latest = await client.auditLog.findFirst({
    where: {
      companyId,
      integrityHash: {
        not: null,
      },
    },
    orderBy: [
      {
        createdAt: "desc",
      },
      {
        id: "desc",
      },
    ],
    select: {
      integrityHash: true,
    },
  });

  return latest?.integrityHash ?? null;
}

export async function verifyAuditLogIntegrity({
  companyId,
  limit = 1000,
}: {
  companyId: string;
  limit?: number;
}) {
  const logs = await prisma.auditLog.findMany({
    where: {
      companyId,
    },
    orderBy: [
      {
        createdAt: "asc",
      },
      {
        id: "asc",
      },
    ],
    take: limit,
  });

  let previousHash: string | null = null;
  const failures: Array<{
    auditLogId: string;
    reason: string;
  }> = [];

  for (const log of logs) {
    if (!log.integrityHash) {
      failures.push({
        auditLogId: log.id,
        reason: "Missing integrity hash",
      });
      previousHash = log.integrityHash ?? previousHash;
      continue;
    }

    if ((log.previousIntegrityHash ?? null) !== previousHash) {
      failures.push({
        auditLogId: log.id,
        reason: "Previous hash mismatch",
      });
    }

    const expectedHash = computeAuditIntegrityHash({
      id: log.id,
      companyId: log.companyId,
      actorUserId: log.actorUserId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      metadata: log.metadata,
      createdAt: log.createdAt,
      previousIntegrityHash: log.previousIntegrityHash,
      integrityVersion: log.integrityVersion,
    });

    if (expectedHash !== log.integrityHash) {
      failures.push({
        auditLogId: log.id,
        reason: "Integrity hash mismatch",
      });
    }

    previousHash = log.integrityHash;
  }

  return {
    checkedCount: logs.length,
    failureCount: failures.length,
    isHealthy: failures.length === 0,
    failures: failures.slice(0, 50),
  };
}
