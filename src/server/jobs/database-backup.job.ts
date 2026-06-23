import { prisma } from "@/lib/prisma";
import { createCompanyNotification } from "@/server/services/company-notification.service";
import {
  cleanupOldDatabaseBackups,
  createDatabaseBackup,
} from "@/server/services/database-backup.service";
import { verifyDatabaseBackup } from "@/server/services/database-backup-verification.service";
import {
  completeMaintenanceJobRun,
  failMaintenanceJobRun,
  startMaintenanceJobRun,
} from "@/server/services/maintenance-job.service";

export const DATABASE_BACKUP_JOB = "database-backup";

export async function runDatabaseBackupJob() {
  const jobRun = await startMaintenanceJobRun(DATABASE_BACKUP_JOB);

  try {
    if (process.env.DATABASE_BACKUPS_ENABLED !== "true") {
      await completeMaintenanceJobRun({
        jobRunId: jobRun.id,
        checkedCount: 1,
        recoveredCount: 0,
      });

      return {
        skipped: true,
        reason: "Database backups are disabled",
      };
    }

    const backup = await createDatabaseBackup();
    const cleanup = await cleanupOldDatabaseBackups();
    const verifiedBackup = await verifyDatabaseBackup({
      backupId: backup.id,
    });

    await completeMaintenanceJobRun({
      jobRunId: jobRun.id,
      checkedCount: 1,
      recoveredCount: 1,
    });

    return {
      backup: verifiedBackup,
      cleanup,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown database backup error";

    await failMaintenanceJobRun({
      jobRunId: jobRun.id,
      errorMessage,
    });

    const companies = await prisma.company.findMany({
      select: {
        id: true,
      },
      take: 500,
    });

    for (const company of companies) {
      await createCompanyNotification({
        companyId: company.id,
        type: "SYSTEM",
        severity: "ERROR",
        title: "Database backup failed",
        message:
          "The scheduled PostgreSQL backup, remote upload, or backup verification failed. Check the system health page and server logs.",
        actionHref: "/dashboard/system/health",
        idempotencyKey: `database-backup-failed:${new Date()
          .toISOString()
          .slice(0, 10)}`,
        metadata: {
          errorMessage,
        },
      });
    }

    throw error;
  }
}
