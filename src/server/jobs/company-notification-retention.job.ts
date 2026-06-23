import {
  completeMaintenanceJobRun,
  failMaintenanceJobRun,
  startMaintenanceJobRun,
} from "@/server/services/maintenance-job.service";
import { cleanupCompanyNotificationRetentionForAllCompanies } from "@/server/services/company-notification-retention.service";

export const COMPANY_NOTIFICATION_RETENTION_JOB =
  "company-notification-retention-cleanup";

export async function runCompanyNotificationRetentionJob() {
  const jobRun = await startMaintenanceJobRun(
    COMPANY_NOTIFICATION_RETENTION_JOB,
  );

  try {
    const result = await cleanupCompanyNotificationRetentionForAllCompanies({
      limit: 500,
    });
    await completeMaintenanceJobRun({
      jobRunId: jobRun.id,
      checkedCount: result.checkedCount,
      recoveredCount: result.recoveredCount,
    });
    return result;
  } catch (error) {
    await failMaintenanceJobRun({
      jobRunId: jobRun.id,
      errorMessage:
        error instanceof Error
          ? error.message
          : "Unknown notification retention error",
    });
    throw error;
  }
}
