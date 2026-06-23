import "dotenv/config";
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { prisma } from "@/lib/prisma";
import { createDatabaseBackup } from "@/server/services/database-backup.service";
import { verifyDatabaseBackup } from "@/server/services/database-backup-verification.service";
import {
  completeProductionRollback,
  failProductionRollback,
  markProductionRollbackStep,
  startProductionRollback,
} from "@/server/services/production-rollback.service";
import { setSystemMaintenanceMode } from "@/server/services/system-maintenance-mode.service";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

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

function getCommandOutput(command: string, args: string[]) {
  return execFileSync(command, args, {
    encoding: "utf8",
    env: process.env,
  }).trim();
}

function safeOutput(command: string, args: string[]) {
  try {
    return getCommandOutput(command, args);
  } catch {
    return null;
  }
}

function getAppUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;

  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL or APP_URL is required");
  }

  return appUrl.replace(/\/+$/, "");
}

function getRollbackTargetRef() {
  const targetRef = process.env.ROLLBACK_TARGET_REF ?? process.argv[2];

  if (!targetRef) {
    throw new Error(
      "Rollback target is required. Use: npm run rollback:production -- <commit-or-tag>",
    );
  }

  return targetRef;
}

async function waitForJsonHealth({
  path,
  headers,
  attempts = 30,
  delayMs = 5000,
}: {
  path: string;
  headers?: Record<string, string>;
  attempts?: number;
  delayMs?: number;
}) {
  const url = `${getAppUrl()}${path}`;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      console.log(`Health check attempt ${attempt}/${attempts}: ${url}`);

      const response = await fetch(url, {
        cache: "no-store",
        headers,
      });

      const data = await response.json().catch(() => null);

      if (response.ok && data?.ok) {
        console.log("Health check passed:", path);
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

  throw new Error(`Health check failed after ${attempts} attempts: ${path}`);
}

async function enableMaintenanceMode() {
  await setSystemMaintenanceMode({
    enabled: true,
    message:
      "TallyKonnect is being rolled back. Sending and billing actions are temporarily paused.",
    updatedByUserId: null,
  });
}

async function disableMaintenanceMode() {
  await setSystemMaintenanceMode({
    enabled: false,
    updatedByUserId: null,
  });
}

async function createAndVerifyBackup() {
  if (process.env.DATABASE_BACKUPS_ENABLED !== "true") {
    if (process.env.ROLLBACK_REQUIRE_BACKUP !== "false") {
      throw new Error(
        "DATABASE_BACKUPS_ENABLED is not true. Refusing rollback because backup is required.",
      );
    }

    console.warn("Skipping rollback backup because ROLLBACK_REQUIRE_BACKUP=false.");
    return null;
  }

  const backup = await createDatabaseBackup();

  return verifyDatabaseBackup({
    backupId: backup.id,
  });
}

async function restartPm2() {
  try {
    await run(npmCommand, ["run", "pm2:restart"]);
  } catch {
    console.warn("PM2 restart failed. Trying PM2 start instead.");
    await run(npmCommand, ["run", "pm2:start"]);
  }
}

async function main() {
  const targetRef = getRollbackTargetRef();
  const startedAt = Date.now();

  const fromCommitSha = safeOutput("git", ["rev-parse", "--short", "HEAD"]);
  const branch = safeOutput("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  const gitStatus = safeOutput("git", ["status", "--short"]);

  if (gitStatus && process.env.ROLLBACK_ALLOW_DIRTY !== "true") {
    throw new Error(
      "Working tree has local changes. Commit/stash them or set ROLLBACK_ALLOW_DIRTY=true.",
    );
  }

  console.log("Starting production rollback:", {
    fromCommitSha,
    targetRef,
    branch,
    appUrl: getAppUrl(),
  });

  await run("git", ["fetch", "--all", "--tags"]);

  const toCommitSha = safeOutput("git", ["rev-parse", "--short", targetRef]);

  const rollback = await startProductionRollback({
    fromCommitSha,
    toCommitSha,
    toRef: targetRef,
    branch,
    appUrl: getAppUrl(),
  });

  let currentStage = "starting";

  try {
    currentStage = "maintenance_mode_enable";
    await enableMaintenanceMode();
    await markProductionRollbackStep({
      rollbackId: rollback.id,
      step: "maintenanceEnabledAt",
    });

    currentStage = "backup";
    const backup = await createAndVerifyBackup();

    if (backup?.id) {
      await markProductionRollbackStep({
        rollbackId: rollback.id,
        step: "backupCompletedAt",
        backupRunId: backup.id,
      });
    }

    currentStage = "checkout";
    await run("git", ["checkout", targetRef]);
    await markProductionRollbackStep({
      rollbackId: rollback.id,
      step: "checkoutCompletedAt",
    });

    currentStage = "install";
    await run(npmCommand, ["install"]);
    await markProductionRollbackStep({
      rollbackId: rollback.id,
      step: "installCompletedAt",
    });

    currentStage = "prisma_generate";
    await run(npxCommand, ["prisma", "generate"]);
    await markProductionRollbackStep({
      rollbackId: rollback.id,
      step: "prismaGeneratedAt",
    });

    currentStage = "build";
    await run(npmCommand, ["run", "build"]);
    await markProductionRollbackStep({
      rollbackId: rollback.id,
      step: "buildCompletedAt",
    });

    currentStage = "pm2_restart";
    await restartPm2();
    await markProductionRollbackStep({
      rollbackId: rollback.id,
      step: "pm2RestartedAt",
    });

    currentStage = "public_healthcheck";
    await waitForJsonHealth({
      path: "/api/health",
    });
    await markProductionRollbackStep({
      rollbackId: rollback.id,
      step: "healthCheckPassedAt",
    });

    if (!process.env.HEALTHCHECK_TOKEN) {
      throw new Error("HEALTHCHECK_TOKEN is required for deep health check");
    }

    currentStage = "deep_healthcheck";
    await waitForJsonHealth({
      path: "/api/health/deep",
      headers: {
        "x-healthcheck-token": process.env.HEALTHCHECK_TOKEN,
      },
    });
    await markProductionRollbackStep({
      rollbackId: rollback.id,
      step: "deepHealthCheckPassedAt",
    });

    currentStage = "maintenance_mode_disable";
    await disableMaintenanceMode();
    await markProductionRollbackStep({
      rollbackId: rollback.id,
      step: "maintenanceDisabledAt",
    });

    await completeProductionRollback({
      rollbackId: rollback.id,
    });

    const durationSeconds = Math.round((Date.now() - startedAt) / 1000);

    console.log("Production rollback completed:", {
      fromCommitSha,
      toCommitSha,
      targetRef,
      durationSeconds,
    });
  } catch (error) {
    console.error("Production rollback failed:", error);

    await failProductionRollback({
      rollbackId: rollback.id,
      errorStage: currentStage,
      errorMessage:
        error instanceof Error ? error.message : "Unknown rollback error",
    }).catch((rollbackError) => {
      console.error("Unable to mark rollback as failed:", rollbackError);
    });

    if (process.env.ROLLBACK_DISABLE_MAINTENANCE_ON_FAILURE === "true") {
      await disableMaintenanceMode();
    } else {
      console.error(
        "Maintenance mode remains ENABLED because rollback failed. Review logs and fix manually.",
      );
    }

    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
