import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

type CreateAuditLogInput = {
  companyId: string;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonObject;
};

export async function createAuditLog(input: CreateAuditLogInput) {
  return prisma.auditLog.create({
    data: {
      companyId: input.companyId,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? {},
    },
  });
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
