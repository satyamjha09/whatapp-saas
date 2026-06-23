import {
  completeMaintenanceJobRun,
  failMaintenanceJobRun,
  startMaintenanceJobRun,
} from "@/server/services/maintenance-job.service";
import { cleanupDeveloperDataRetentionForAllCompanies } from "@/server/services/developer-data-retention.service";

export const DEVELOPER_DATA_RETENTION_JOB =
  "developer-data-retention-cleanup";

export async function runDeveloperDataRetentionJob() {
  const jobRun = await startMaintenanceJobRun(DEVELOPER_DATA_RETENTION_JOB);

  try {
    const result = await cleanupDeveloperDataRetentionForAllCompanies({
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
          : "Unknown developer data retention error",
    });
    throw error;
  }
}
