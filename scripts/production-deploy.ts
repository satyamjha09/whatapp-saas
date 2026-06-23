import "dotenv/config";
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { prisma } from "@/lib/prisma";
import { createDatabaseBackup } from "@/server/services/database-backup.service";
import { verifyDatabaseBackup } from "@/server/services/database-backup-verification.service";
import { setSystemMaintenanceMode } from "@/server/services/system-maintenance-mode.service";
import {
  completeProductionDeployment,
  failProductionDeployment,
  markProductionDeploymentStep,
  startProductionDeployment,
} from "@/server/services/production-deployment.service";
import {
  acquireProductionOperationLock,
  releaseProductionOperationLock,
} from "@/server/services/production-operation-lock.service";
import { getProductionEnvAudit } from "@/server/services/production-env-audit.service";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

function getAppUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;

  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL or APP_URL is required for deploy health checks");
  }

  return appUrl.replace(/\/+$/, "");
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

async function enableMaintenanceMode() {
  console.log("Enabling maintenance mode...");

  await setSystemMaintenanceMode({
    enabled: true,
    message:
      "TallyKonnect is being updated. Sending and billing actions are temporarily paused.",
    updatedByUserId: null,
  });
}

async function disableMaintenanceMode() {
  console.log("Disabling maintenance mode...");

  await setSystemMaintenanceMode({
    enabled: false,
    updatedByUserId: null,
  });
}

async function createAndVerifyBackup() {
  if (process.env.DATABASE_BACKUPS_ENABLED !== "true") {
    if (process.env.DEPLOY_REQUIRE_BACKUP === "true") {
      throw new Error(
        "DATABASE_BACKUPS_ENABLED is not true. Refusing production deploy because DEPLOY_REQUIRE_BACKUP=true.",
      );
    }

    console.warn("Skipping database backup because DATABASE_BACKUPS_ENABLED is not true.");
    return null;
  }

  console.log("Creating database backup...");
  const backup = await createDatabaseBackup();

  console.log("Verifying database backup...");
  const verifiedBackup = await verifyDatabaseBackup({
    backupId: backup.id,
  });

  console.log("Backup verified:", {
    id: verifiedBackup.id,
    fileName: verifiedBackup.fileName,
    verificationStatus: verifiedBackup.verificationStatus,
  });

  return verifiedBackup;
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

async function restartPm2() {
  try {
    await run(npmCommand, ["run", "pm2:restart"]);
  } catch {
    console.warn("PM2 restart failed. Trying PM2 start instead.");
    await run(npmCommand, ["run", "pm2:start"]);
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
  const startedAt = Date.now();

  const commitSha = safeOutput("git", ["rev-parse", "--short", "HEAD"]);
  const commitMessage = safeOutput("git", ["log", "-1", "--pretty=%s"]);
  const branch = safeOutput("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  const gitStatus = safeOutput("git", ["status", "--short"]);

  console.log("Starting production deploy:", {
    commitSha,
    appUrl: getAppUrl(),
  });

  if (gitStatus) {
    console.warn("Working tree has local changes:");
    console.warn(gitStatus);
  }

  const deployment = await startProductionDeployment({
    commitSha,
    commitMessage,
    branch,
    appUrl: getAppUrl(),
  });

  let operationLockAcquired = false;
  let currentStage = "starting";

  try {
    currentStage = "production_env_audit";
    assertProductionEnvAuditPassed();

    currentStage = "operation_lock";

    await acquireProductionOperationLock({
      operationType: "DEPLOY",
      lockOwner: commitSha,
      ttlMinutes: 120,
      metadata: {
        commitSha,
        commitMessage,
        branch,
        appUrl: getAppUrl(),
        startedBy: "scripts/production-deploy.ts",
      },
    });

    operationLockAcquired = true;

    currentStage = "maintenance_mode_enable";
    await enableMaintenanceMode();
    await markProductionDeploymentStep({
      deploymentId: deployment.id,
      step: "maintenanceEnabledAt",
    });

    currentStage = "backup";
    const backup = await createAndVerifyBackup();

    if (backup?.id) {
      await markProductionDeploymentStep({
        deploymentId: deployment.id,
        step: "backupCompletedAt",
        backupRunId: backup.id,
      });
    }

    currentStage = "prisma_migrate";
    await run(npxCommand, ["prisma", "migrate", "deploy"]);
    await markProductionDeploymentStep({
      deploymentId: deployment.id,
      step: "migrationCompletedAt",
    });

    currentStage = "prisma_generate";
    await run(npxCommand, ["prisma", "generate"]);
    await markProductionDeploymentStep({
      deploymentId: deployment.id,
      step: "prismaGeneratedAt",
    });

    currentStage = "build";
    await run(npmCommand, ["run", "build"]);
    await markProductionDeploymentStep({
      deploymentId: deployment.id,
      step: "buildCompletedAt",
    });

    currentStage = "pm2_restart";
    await restartPm2();
    await markProductionDeploymentStep({
      deploymentId: deployment.id,
      step: "pm2RestartedAt",
    });

    currentStage = "public_healthcheck";
    await waitForJsonHealth({
      path: "/api/health",
    });
    await markProductionDeploymentStep({
      deploymentId: deployment.id,
      step: "healthCheckPassedAt",
    });

    if (!process.env.HEALTHCHECK_TOKEN) {
      throw new Error("HEALTHCHECK_TOKEN is required for deep deploy health check");
    }

    currentStage = "deep_healthcheck";
    await waitForJsonHealth({
      path: "/api/health/deep",
      headers: {
        "x-healthcheck-token": process.env.HEALTHCHECK_TOKEN,
      },
    });
    await markProductionDeploymentStep({
      deploymentId: deployment.id,
      step: "deepHealthCheckPassedAt",
    });

    currentStage = "maintenance_mode_disable";
    await disableMaintenanceMode();
    await markProductionDeploymentStep({
      deploymentId: deployment.id,
      step: "maintenanceDisabledAt",
    });

    await waitForJsonHealth({
      path: "/api/health",
    });

    await completeProductionDeployment({
      deploymentId: deployment.id,
    });

    const durationSeconds = Math.round((Date.now() - startedAt) / 1000);

    console.log("Production deploy completed successfully:", {
      commitSha,
      durationSeconds,
    });
  } catch (error) {
    console.error("Production deploy failed:", error);

    await failProductionDeployment({
      deploymentId: deployment.id,
      errorStage: currentStage,
      errorMessage:
        error instanceof Error ? error.message : "Unknown deploy error",
    }).catch((deployError) => {
      console.error("Unable to mark deployment as failed:", deployError);
    });

    if (process.env.DEPLOY_DISABLE_MAINTENANCE_ON_FAILURE === "true") {
      await disableMaintenanceMode();
    } else {
      console.error(
        "Maintenance mode remains ENABLED because deploy failed. Review logs, fix the issue, then disable it manually from /dashboard/system/health.",
      );
    }

    process.exitCode = 1;
  } finally {
    if (operationLockAcquired) {
      await releaseProductionOperationLock({
        operationType: "DEPLOY",
      }).catch((error) => {
        console.error("Unable to release production operation lock:", error);
      });
    }
    await prisma.$disconnect();
  }
}

void main();
