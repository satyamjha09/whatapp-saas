import crypto from "crypto";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";
import {
  getRemoteDatabaseBackupObjectMetadata,
  isRemoteBackupStorageEnabled,
} from "@/server/services/database-backup-storage.service";

async function sha256File(filePath: string) {
  const buffer = await fs.readFile(filePath);

  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function verifyDatabaseBackup({ backupId }: { backupId: string }) {
  const backup = await prisma.databaseBackupRun.findUnique({
    where: {
      id: backupId,
    },
  });

  if (!backup) {
    throw new Error("Backup not found");
  }

  if (backup.status !== "COMPLETED") {
    throw new Error("Only completed backups can be verified");
  }

  try {
    if (!backup.filePath) {
      throw new Error("Backup file path is missing");
    }

    if (!backup.checksumSha256) {
      throw new Error("Backup checksum is missing");
    }

    const localChecksum = await sha256File(backup.filePath);

    if (localChecksum !== backup.checksumSha256) {
      throw new Error("Local backup checksum mismatch");
    }

    if (isRemoteBackupStorageEnabled()) {
      if (!backup.remoteBucket || !backup.remoteKey) {
        throw new Error("Remote backup metadata is missing");
      }

      const remoteMetadata = await getRemoteDatabaseBackupObjectMetadata({
        bucket: backup.remoteBucket,
        key: backup.remoteKey,
      });

      if (
        remoteMetadata.checksumSha256 &&
        remoteMetadata.checksumSha256 !== backup.checksumSha256
      ) {
        throw new Error("Remote backup checksum metadata mismatch");
      }

      if (
        backup.sizeBytes !== null &&
        remoteMetadata.contentLength !== null &&
        remoteMetadata.contentLength !== backup.sizeBytes
      ) {
        throw new Error("Remote backup size mismatch");
      }
    }

    return prisma.databaseBackupRun.update({
      where: {
        id: backup.id,
      },
      data: {
        verificationStatus: "VERIFIED",
        verifiedAt: new Date(),
        verificationError: null,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message.slice(0, 2000)
        : "Unknown backup verification error";

    await prisma.databaseBackupRun.update({
      where: {
        id: backup.id,
      },
      data: {
        verificationStatus: "FAILED",
        verifiedAt: new Date(),
        verificationError: errorMessage,
      },
    });

    throw error;
  }
}

export async function verifyLatestCompletedDatabaseBackup() {
  const latestBackup = await prisma.databaseBackupRun.findFirst({
    where: {
      status: "COMPLETED",
    },
    orderBy: {
      completedAt: "desc",
    },
  });

  if (!latestBackup) {
    throw new Error("No completed backup found");
  }

  return verifyDatabaseBackup({
    backupId: latestBackup.id,
  });
}
