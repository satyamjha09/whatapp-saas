import "dotenv/config";
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { prisma } from "@/lib/prisma";
import { createDatabaseBackup } from "@/server/services/database-backup.service";
import { verifyDatabaseBackup } from "@/server/services/database-backup-verification.service";
import { setSystemMaintenanceMode } from "@/server/services/system-maintenance-mode.service";

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
      shell: false,
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
    return;
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

async function main() {
  const startedAt = Date.now();

  const commitSha = getCommandOutput("git", ["rev-parse", "--short", "HEAD"]);
  const gitStatus = getCommandOutput("git", ["status", "--short"]);

  console.log("Starting production deploy:", {
    commitSha,
    appUrl: getAppUrl(),
  });

  if (gitStatus) {
    console.warn("Working tree has local changes:");
    console.warn(gitStatus);
  }

  await enableMaintenanceMode();

  try {
    await createAndVerifyBackup();

    await run(npxCommand, ["prisma", "migrate", "deploy"]);
    await run(npxCommand, ["prisma", "generate"]);

    await run(npmCommand, ["run", "build"]);

    await restartPm2();

    await waitForJsonHealth({
      path: "/api/health",
    });

    if (!process.env.HEALTHCHECK_TOKEN) {
      throw new Error("HEALTHCHECK_TOKEN is required for deep deploy health check");
    }

    await waitForJsonHealth({
      path: "/api/health/deep",
      headers: {
        "x-healthcheck-token": process.env.HEALTHCHECK_TOKEN,
      },
    });

    await disableMaintenanceMode();

    await waitForJsonHealth({
      path: "/api/health",
    });

    const durationSeconds = Math.round((Date.now() - startedAt) / 1000);

    console.log("Production deploy completed successfully:", {
      commitSha,
      durationSeconds,
    });
  } catch (error) {
    console.error("Production deploy failed:", error);

    if (process.env.DEPLOY_DISABLE_MAINTENANCE_ON_FAILURE === "true") {
      await disableMaintenanceMode();
    } else {
      console.error(
        "Maintenance mode remains ENABLED because deploy failed. Review logs, fix the issue, then disable it manually from /dashboard/system/health.",
      );
    }

    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
