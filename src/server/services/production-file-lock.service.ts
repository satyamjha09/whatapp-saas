import fs from "fs/promises";
import path from "path";

export class ProductionFileLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductionFileLockError";
  }
}

type ProductionFileLockPayload = {
  operationType: string;
  lockOwner: string | null;
  lockedAt: string;
  expiresAt: string;
  metadata?: unknown;
};

function getLockPath() {
  const configuredPath =
    process.env.PRODUCTION_FILE_LOCK_PATH ?? "./.production-operation.lock";

  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.join(process.cwd(), configuredPath);
}

async function readExistingLock(lockPath: string) {
  try {
    const raw = await fs.readFile(lockPath, "utf8");
    return JSON.parse(raw) as ProductionFileLockPayload;
  } catch {
    return null;
  }
}

export async function acquireProductionFileLock({
  operationType,
  lockOwner,
  ttlMinutes = 120,
  metadata,
}: {
  operationType: string;
  lockOwner?: string | null;
  ttlMinutes?: number;
  metadata?: unknown;
}) {
  const lockPath = getLockPath();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  const existingLock = await readExistingLock(lockPath);

  if (existingLock) {
    const existingExpiresAt = new Date(existingLock.expiresAt);

    if (existingExpiresAt > now) {
      throw new ProductionFileLockError(
        `Another production operation is already running: ${existingLock.operationType}. Locked at ${existingLock.lockedAt} and expires at ${existingLock.expiresAt}.`,
      );
    }

    await fs.rm(lockPath, { force: true });
  }

  const payload: ProductionFileLockPayload = {
    operationType,
    lockOwner: lockOwner ?? null,
    lockedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    metadata,
  };

  try {
    await fs.writeFile(lockPath, JSON.stringify(payload, null, 2), {
      flag: "wx",
    });
  } catch {
    throw new ProductionFileLockError(
      "Unable to acquire production filesystem lock. Another operation may have started.",
    );
  }

  return {
    lockPath,
    payload,
  };
}

export async function releaseProductionFileLock() {
  const lockPath = getLockPath();

  await fs.rm(lockPath, { force: true });
}

export async function getProductionFileLock() {
  const lockPath = getLockPath();
  const payload = await readExistingLock(lockPath);

  if (!payload) {
    return null;
  }

  return {
    lockPath,
    ...payload,
    isExpired: new Date(payload.expiresAt) <= new Date(),
  };
}
