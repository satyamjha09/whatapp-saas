import { prisma } from "@/lib/prisma";
import { redactSensitiveData } from "@/server/utils/safe-logger";

export async function createPlatformAuditLog({
  actorUserId,
  actorEmail,
  action,
  entityType,
  entityId,
  metadata,
}: {
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: unknown;
}) {
  return prisma.platformAuditLog.create({
    data: {
      actorUserId: actorUserId ?? null,
      actorEmail: actorEmail ?? null,
      action,
      entityType,
      entityId: entityId ?? null,
      metadata: metadata ? (redactSensitiveData(metadata) as never) : undefined,
    },
  });
}
