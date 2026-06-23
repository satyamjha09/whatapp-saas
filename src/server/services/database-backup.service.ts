import crypto from "crypto";
import { execFile } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import { prisma } from "@/lib/prisma";
import {
  isRemoteBackupStorageEnabled,
  uploadDatabaseBackupToRemoteStorage,
} from "@/server/services/database-backup-storage.service";

const execFileAsync = promisify(execFile);

function getBackupDir() {
  const configuredDir = process.env.DATABASE_BACKUP_DIR ?? "./backups/postgres";

  return path.isAbsolute(configuredDir)
    ? configuredDir
    : path.join(/* turbopackIgnore: true */ process.cwd(), configuredDir);
}

function getRetentionDays() {
  return Number(process.env.DATABASE_BACKUP_RETENTION_DAYS ?? "14");
}

function getPgDumpPath() {
  return process.env.PG_DUMP_PATH ?? "pg_dump";
}

async function sha256File(filePath: string) {
  const buffer = await fs.readFile(filePath);

  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function createDatabaseBackup() {
  if (process.env.DATABASE_BACKUPS_ENABLED !== "true") {
    throw new Error("Database backups are disabled");
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  const backupRun = await prisma.databaseBackupRun.create({
    data: {
      status: "RUNNING",
    },
  });

  const backupDir = getBackupDir();
  await fs.mkdir(backupDir, { recursive: true });

  const timestamp = new Date()
    .toISOString()
    .replaceAll(":", "-")
    .replaceAll(".", "-");

  const fileName = `tallykonnect-postgres-${timestamp}.dump`;
  const filePath = path.join(backupDir, fileName);

  try {
    await execFileAsync(
      getPgDumpPath(),
      [
        "--dbname",
        process.env.DATABASE_URL,
        "--format",
        "custom",
        "--no-owner",
        "--no-acl",
        "--file",
        filePath,
      ],
      {
        timeout: 10 * 60 * 1000,
        maxBuffer: 1024 * 1024 * 10,
      },
    );

    const stat = await fs.stat(filePath);
    const checksumSha256 = await sha256File(filePath);

    let completedRun = await prisma.databaseBackupRun.update({
      where: {
        id: backupRun.id,
      },
      data: {
        status: "COMPLETED",
        fileName,
        filePath,
        sizeBytes: stat.size,
        checksumSha256,
        completedAt: new Date(),
        remoteStorageEnabled: isRemoteBackupStorageEnabled(),
      },
    });

    if (isRemoteBackupStorageEnabled()) {
      try {
        const remoteUpload = await uploadDatabaseBackupToRemoteStorage({
          filePath,
          fileName,
          checksumSha256,
        });

        completedRun = await prisma.databaseBackupRun.update({
          where: {
            id: backupRun.id,
          },
          data: {
            remoteBucket: remoteUpload.bucket,
            remoteKey: remoteUpload.key,
            remoteUploadedAt: new Date(),
            remoteUploadError: null,
          },
        });
      } catch (error) {
        completedRun = await prisma.databaseBackupRun.update({
          where: {
            id: backupRun.id,
          },
          data: {
            remoteUploadError:
              error instanceof Error
                ? error.message.slice(0, 2000)
                : "Unknown remote backup upload error",
          },
        });

        throw error;
      }
    }

    return completedRun;
  } catch (error) {
    await prisma.databaseBackupRun.update({
      where: {
        id: backupRun.id,
      },
      data: {
        status: "FAILED",
        errorMessage:
          error instanceof Error
            ? error.message.slice(0, 2000)
            : "Unknown backup error",
        completedAt: new Date(),
      },
    });

    throw error;
  }
}

export async function cleanupOldDatabaseBackups() {
  const retentionDays = getRetentionDays();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const oldBackups = await prisma.databaseBackupRun.findMany({
    where: {
      status: "COMPLETED",
      startedAt: {
        lt: cutoff,
      },
    },
    take: 500,
    orderBy: {
      startedAt: "asc",
    },
  });

  let deletedCount = 0;

  for (const backup of oldBackups) {
    if (backup.filePath) {
      await fs.rm(backup.filePath, { force: true }).catch(() => undefined);
    }

    await prisma.databaseBackupRun.delete({
      where: {
        id: backup.id,
      },
    });

    deletedCount += 1;
  }

  return {
    retentionDays,
    deletedCount,
  };
}

export async function getDatabaseBackupHealth() {
  const [latestBackup, recentFailures] = await Promise.all([
    prisma.databaseBackupRun.findFirst({
      orderBy: {
        startedAt: "desc",
      },
    }),

    prisma.databaseBackupRun.count({
      where: {
        status: "FAILED",
        startedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  const latestBackupAgeHours = latestBackup?.completedAt
    ? Math.round(
        (Date.now() - latestBackup.completedAt.getTime()) / (60 * 60 * 1000),
      )
    : null;

  const remoteStorageEnabled = isRemoteBackupStorageEnabled();

  const latestBackupHasRemoteCopy =
    !remoteStorageEnabled ||
    Boolean(latestBackup?.remoteKey && latestBackup.remoteUploadedAt);

  const latestBackupVerified = latestBackup?.verificationStatus === "VERIFIED";

  const isHealthy =
    process.env.DATABASE_BACKUPS_ENABLED !== "true"
      ? true
      : Boolean(
          latestBackup &&
            latestBackup.status === "COMPLETED" &&
            latestBackupAgeHours !== null &&
            latestBackupAgeHours <= 30 &&
            recentFailures === 0 &&
            latestBackupHasRemoteCopy &&
            latestBackupVerified,
        );

  return {
    enabled: process.env.DATABASE_BACKUPS_ENABLED === "true",
    remoteStorageEnabled,
    latestBackupHasRemoteCopy,
    latestBackupVerified,
    isHealthy,
    latestBackup,
    latestBackupAgeHours,
    recentFailures,
    retentionDays: getRetentionDays(),
  };
}
