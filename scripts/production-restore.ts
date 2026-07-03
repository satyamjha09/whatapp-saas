import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { prisma } from "@/lib/prisma";
import { createDatabaseBackup } from "@/server/services/database-backup.service";
import { verifyDatabaseBackup } from "@/server/services/database-backup-verification.service";
import { recordDatabaseRestoreRun } from "@/server/services/database-restore.service";
import {
  acquireProductionFileLock,
  releaseProductionFileLock,
} from "@/server/services/production-file-lock.service";
import {
  acquireProductionOperationLock,
  releaseProductionOperationLock,
} from "@/server/services/production-operation-lock.service";
import { setSystemMaintenanceMode } from "@/server/services/system-maintenance-mode.service";
import { getProductionEnvAudit } from "@/server/services/production-env-audit.service";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const pgRestoreCommand = process.env.PG_RESTORE_PATH ?? "pg_restore";

type RestoreTelemetry = {
  status: "RUNNING" | "SUCCEEDED" | "FAILED";
  sourceFileName?: string | null;
  sourceFilePath?: string | null;
  checksumSha256?: string | null;
  preRestoreBackupRunId?: string | null;
  operationLockOwner?: string | null;
  localLogPath?: string | null;
  maintenanceEnabledAt?: Date | null;
  preRestoreBackupCreatedAt?: Date | null;
  checksumVerifiedAt?: Date | null;
  pm2StoppedAt?: Date | null;
  restoreStartedAt?: Date | null;
  restoreCompletedAt?: Date | null;
  migrationCompletedAt?: Date | null;
  prismaGeneratedAt?: Date | null;
  pm2RestartedAt?: Date | null;
  healthCheckPassedAt?: Date | null;
  deepHealthCheckPassedAt?: Date | null;
  maintenanceDisabledAt?: Date | null;
  errorStage?: string | null;
  errorMessage?: string | null;
  startedAt: Date;
  completedAt?: Date | null;
};

function getAppUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;

  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL or APP_URL is required");
  }

  return appUrl.replace(/\/+$/, "");
}

function getRestoreBackupFile() {
  const filePath = process.env.RESTORE_BACKUP_FILE ?? process.argv[2];

  if (!filePath) {
    throw new Error(
      "RESTORE_BACKUP_FILE is required. Example: RESTORE_BACKUP_FILE=./backups/postgres/file.dump npm run restore:production",
    );
  }

  return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
}

function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    console.log(`\n$ ${command} ${args.join(" ")}\n`);

    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: process.env,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command failed: ${command} ${args.join(" ")}`));
    });

    child.on("error", reject);
  });
}

async function runOptional(command: string, args: string[]) {
  try {
    await run(command, args);
  } catch (error) {
    console.warn(
      "Optional command failed:",
      error instanceof Error ? error.message : error,
    );
  }
}

async function sha256File(filePath: string) {
  const fileBuffer = await fs.readFile(filePath);

  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

async function getExpectedChecksum(filePath: string) {
  if (process.env.RESTORE_BACKUP_SHA256) {
    return process.env.RESTORE_BACKUP_SHA256.trim();
  }

  const checksumFilePath = `${filePath}.sha256`;

  try {
    const raw = await fs.readFile(checksumFilePath, "utf8");
    return raw.trim().split(/\s+/)[0] ?? null;
  } catch {
    return null;
  }
}

async function verifyRestoreBackupFile(filePath: string) {
  await fs.access(filePath);

  const actualChecksum = await sha256File(filePath);
  const expectedChecksum = await getExpectedChecksum(filePath);

  if (!expectedChecksum) {
    if (process.env.RESTORE_REQUIRE_CHECKSUM === "true") {
      throw new Error(
        "Backup checksum is required. Set RESTORE_BACKUP_SHA256 or place a .sha256 file next to the backup.",
      );
    }

    console.warn("No expected checksum provided. Continuing because RESTORE_REQUIRE_CHECKSUM is not true.");
    return actualChecksum;
  }

  if (actualChecksum !== expectedChecksum) {
    throw new Error("Backup checksum mismatch. Refusing restore.");
  }

  return actualChecksum;
}

async function writeLocalRestoreLog(telemetry: RestoreTelemetry) {
  const logsDir = path.join(process.cwd(), "logs", "restores");
  await fs.mkdir(logsDir, { recursive: true });

  if (!telemetry.localLogPath) {
    const timestamp = telemetry.startedAt
      .toISOString()
      .replaceAll(":", "-")
      .replaceAll(".", "-");

    telemetry.localLogPath = path.join(logsDir, `restore-${timestamp}.json`);
  }

  await fs.writeFile(
    telemetry.localLogPath,
    JSON.stringify(
      {
        ...telemetry,
        startedAt: telemetry.startedAt.toISOString(),
        completedAt: telemetry.completedAt?.toISOString() ?? null,
      },
      null,
      2,
    ),
  );
}

async function enableMaintenanceMode() {
  await setSystemMaintenanceMode({
    enabled: true,
    message:
      "metawhat database restore is in progress. Sending and billing actions are temporarily paused.",
    updatedByUserId: null,
  });
}

async function disableMaintenanceMode() {
  await setSystemMaintenanceMode({
    enabled: false,
    updatedByUserId: null,
  });
}

async function createPreRestoreBackup() {
  if (process.env.RESTORE_CREATE_PRE_RESTORE_BACKUP === "false") {
    console.warn("Skipping pre-restore backup because RESTORE_CREATE_PRE_RESTORE_BACKUP=false.");
    return null;
  }

  if (process.env.DATABASE_BACKUPS_ENABLED !== "true") {
    if (process.env.RESTORE_REQUIRE_PRE_RESTORE_BACKUP !== "false") {
      throw new Error(
        "DATABASE_BACKUPS_ENABLED is not true. Refusing restore because pre-restore backup is required.",
      );
    }

    console.warn("Skipping pre-restore backup because DATABASE_BACKUPS_ENABLED is not true.");
    return null;
  }

  const backup = await createDatabaseBackup();

  return verifyDatabaseBackup({
    backupId: backup.id,
  });
}

async function waitForJsonHealth({
  path: healthPath,
  headers,
  attempts = 30,
  delayMs = 5000,
}: {
  path: string;
  headers?: Record<string, string>;
  attempts?: number;
  delayMs?: number;
}) {
  const url = `${getAppUrl()}${healthPath}`;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      console.log(`Health check attempt ${attempt}/${attempts}: ${url}`);

      const response = await fetch(url, {
        cache: "no-store",
        headers,
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.ok) {
        console.log("Health check passed:", healthPath);
        return data;
      }

      console.warn("Health check not ready:", {
        status: response.status,
        data,
      });
    } catch (error) {
      console.warn(
        "Health check failed:",
        error instanceof Error ? error.message : error,
      );
    }

    await sleep(delayMs);
  }

  throw new Error(`Health check failed after ${attempts} attempts: ${healthPath}`);
}

async function restartPm2() {
  try {
    await run(npmCommand, ["run", "pm2:restart"]);
  } catch {
    console.warn("PM2 restart failed. Trying PM2 start instead.");
    await run(npmCommand, ["run", "pm2:start"]);
  }
}

async function tryRecordRestoreRun(telemetry: RestoreTelemetry) {
  try {
    await recordDatabaseRestoreRun(telemetry);
  } catch (error) {
    console.error("Unable to record database restore run:", error);
    console.error("Local restore log:", telemetry.localLogPath);
  }
}

function assertProductionEnvAuditPassed() {
  const audit = getProductionEnvAudit();

  if (audit.isHealthy) {
    console.log("Production environment audit passed");
    return;
  }

  console.error("Production environment audit failed:");
  for (const item of audit.items.filter((auditItem) => auditItem.severity === "FAIL")) {
    console.error(`- ${item.title}: ${item.message}`);
  }

  throw new Error("Production environment audit failed");
}

async function main() {
  if (process.env.RESTORE_CONFIRMATION !== "RESTORE_PRODUCTION_DATABASE") {
    throw new Error(
      'Refusing restore. Set RESTORE_CONFIRMATION="RESTORE_PRODUCTION_DATABASE" to continue.',
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  if (!process.env.HEALTHCHECK_TOKEN) {
    throw new Error("HEALTHCHECK_TOKEN is required");
  }

  const sourceFilePath = getRestoreBackupFile();
  const sourceFileName = path.basename(sourceFilePath);
  const lockOwner = `restore:${sourceFileName}:${Date.now()}`;

  const telemetry: RestoreTelemetry = {
    status: "RUNNING",
    sourceFileName,
    sourceFilePath,
    operationLockOwner: lockOwner,
    startedAt: new Date(),
  };

  let currentStage = "starting";
  let dbOperationLockAcquired = false;
  let fileLockAcquired = false;

  try {
    await writeLocalRestoreLog(telemetry);

    currentStage = "production_env_audit";
    assertProductionEnvAuditPassed();

    currentStage = "file_operation_lock";
    await acquireProductionFileLock({
      operationType: "RESTORE",
      lockOwner,
      ttlMinutes: 180,
      metadata: {
        sourceFileName,
        sourceFilePath,
        appUrl: getAppUrl(),
      },
    });
    fileLockAcquired = true;

    currentStage = "database_operation_lock";
    await acquireProductionOperationLock({
      operationType: "RESTORE",
      lockOwner,
      ttlMinutes: 180,
      metadata: {
        sourceFileName,
        sourceFilePath,
        startedBy: "scripts/production-restore.ts",
      },
    });
    dbOperationLockAcquired = true;

    currentStage = "maintenance_mode_enable";
    await enableMaintenanceMode();
    telemetry.maintenanceEnabledAt = new Date();
    await writeLocalRestoreLog(telemetry);

    currentStage = "pre_restore_backup";
    const preRestoreBackup = await createPreRestoreBackup();

    if (preRestoreBackup) {
      telemetry.preRestoreBackupRunId = preRestoreBackup.id;
      telemetry.preRestoreBackupCreatedAt = new Date();
    }

    await writeLocalRestoreLog(telemetry);

    currentStage = "checksum_verify";
    telemetry.checksumSha256 = await verifyRestoreBackupFile(sourceFilePath);
    telemetry.checksumVerifiedAt = new Date();
    await writeLocalRestoreLog(telemetry);

    currentStage = "pm2_stop";
    await runOptional(npmCommand, ["run", "pm2:stop"]);
    telemetry.pm2StoppedAt = new Date();
    await writeLocalRestoreLog(telemetry);

    /*
      Disconnect Prisma before pg_restore because the restore may drop/recreate
      tables currently used by this Node process.
    */
    await prisma.$disconnect();

    currentStage = "pg_restore";
    telemetry.restoreStartedAt = new Date();
    await writeLocalRestoreLog(telemetry);

    await run(pgRestoreCommand, [
      "--dbname",
      process.env.DATABASE_URL,
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-acl",
      "--exit-on-error",
      sourceFilePath,
    ]);

    telemetry.restoreCompletedAt = new Date();
    await writeLocalRestoreLog(telemetry);

    currentStage = "prisma_migrate_after_restore";
    await run(npxCommand, ["prisma", "migrate", "deploy"]);
    telemetry.migrationCompletedAt = new Date();
    await writeLocalRestoreLog(telemetry);

    currentStage = "prisma_generate";
    await run(npxCommand, ["prisma", "generate"]);
    telemetry.prismaGeneratedAt = new Date();
    await writeLocalRestoreLog(telemetry);

    currentStage = "pm2_restart";
    await restartPm2();
    telemetry.pm2RestartedAt = new Date();
    await writeLocalRestoreLog(telemetry);

    currentStage = "public_healthcheck";
    await waitForJsonHealth({
      path: "/api/health",
    });
    telemetry.healthCheckPassedAt = new Date();
    await writeLocalRestoreLog(telemetry);

    currentStage = "deep_healthcheck";
    await waitForJsonHealth({
      path: "/api/health/deep",
      headers: {
        "x-healthcheck-token": process.env.HEALTHCHECK_TOKEN,
      },
    });
    telemetry.deepHealthCheckPassedAt = new Date();
    await writeLocalRestoreLog(telemetry);

    currentStage = "maintenance_mode_disable";
    await disableMaintenanceMode();
    telemetry.maintenanceDisabledAt = new Date();

    telemetry.status = "SUCCEEDED";
    telemetry.completedAt = new Date();
    await writeLocalRestoreLog(telemetry);

    await tryRecordRestoreRun(telemetry);

    console.log("Production database restore completed successfully:", {
      sourceFileName,
      checksumSha256: telemetry.checksumSha256,
      localLogPath: telemetry.localLogPath,
    });
  } catch (error) {
    telemetry.status = "FAILED";
    telemetry.errorStage = currentStage;
    telemetry.errorMessage =
      error instanceof Error ? error.message : "Unknown restore error";
    telemetry.completedAt = new Date();

    await writeLocalRestoreLog(telemetry).catch(() => undefined);
    await tryRecordRestoreRun(telemetry);

    console.error("Production database restore failed:", error);

    if (process.env.RESTORE_DISABLE_MAINTENANCE_ON_FAILURE === "true") {
      await disableMaintenanceMode().catch(() => undefined);
    } else {
      console.error(
        "Maintenance mode remains ENABLED because restore failed. Review logs before resuming production.",
      );
    }

    process.exitCode = 1;
  } finally {
    if (dbOperationLockAcquired) {
      await releaseProductionOperationLock({
        operationType: "RESTORE",
      }).catch((error) => {
        console.error("Unable to release DB operation lock:", error);
      });
    }

    if (fileLockAcquired) {
      await releaseProductionFileLock().catch((error) => {
        console.error("Unable to release file operation lock:", error);
      });
    }

    await prisma.$disconnect().catch(() => undefined);
  }
}

void main();
