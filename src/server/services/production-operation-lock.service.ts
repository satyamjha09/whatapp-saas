import { Prisma, ProductionOperationType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const PRODUCTION_OPERATION_LOCK_ID = "global-production-operation";

export class ProductionOperationLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductionOperationLockError";
  }
}

export async function acquireProductionOperationLock({
  operationType,
  lockOwner,
  ttlMinutes = 90,
  metadata,
}: {
  operationType: ProductionOperationType;
  lockOwner?: string | null;
  ttlMinutes?: number;
  metadata?: Prisma.InputJsonValue;
}) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  try {
    return await prisma.productionOperationLock.create({
      data: {
        id: PRODUCTION_OPERATION_LOCK_ID,
        operationType,
        lockOwner,
        lockedAt: now,
        expiresAt,
        metadata,
      },
    });
  } catch {
    const updatedExpiredLock = await prisma.productionOperationLock.updateMany({
      where: {
        id: PRODUCTION_OPERATION_LOCK_ID,
        expiresAt: {
          lte: now,
        },
      },
      data: {
        operationType,
        lockOwner,
        lockedAt: now,
        expiresAt,
        metadata,
      },
    });

    if (updatedExpiredLock.count === 1) {
      return prisma.productionOperationLock.findUniqueOrThrow({
        where: {
          id: PRODUCTION_OPERATION_LOCK_ID,
        },
      });
    }

    const activeLock = await prisma.productionOperationLock.findUnique({
      where: {
        id: PRODUCTION_OPERATION_LOCK_ID,
      },
    });

    throw new ProductionOperationLockError(
      activeLock
        ? `Another production operation is already running: ${activeLock.operationType}. Locked at ${activeLock.lockedAt.toISOString()} and expires at ${activeLock.expiresAt.toISOString()}.`
        : "Another production operation is already running.",
    );
  }
}

export async function releaseProductionOperationLock({
  operationType,
}: {
  operationType?: ProductionOperationType;
} = {}) {
  return prisma.productionOperationLock.deleteMany({
    where: {
      id: PRODUCTION_OPERATION_LOCK_ID,
      ...(operationType ? { operationType } : {}),
    },
  });
}

export async function forceReleaseProductionOperationLock() {
  return prisma.productionOperationLock.deleteMany({
    where: {
      id: PRODUCTION_OPERATION_LOCK_ID,
    },
  });
}

export async function getActiveProductionOperationLock() {
  const lock = await prisma.productionOperationLock.findUnique({
    where: {
      id: PRODUCTION_OPERATION_LOCK_ID,
    },
  });

  if (!lock) {
    return null;
  }

  const isExpired = lock.expiresAt <= new Date();

  return {
    ...lock,
    isExpired,
  };
}
