import {
  completeMaintenanceJobRun,
  failMaintenanceJobRun,
  startMaintenanceJobRun,
} from "@/server/services/maintenance-job.service";
import { runDataRetentionPolicies } from "@/server/services/data-retention.service";

export const DATA_RETENTION_JOB = "data-retention";

export async function runDataRetentionJob() {
  const jobRun = await startMaintenanceJobRun(DATA_RETENTION_JOB);

  try {
    const result = await runDataRetentionPolicies();

    await completeMaintenanceJobRun({
      jobRunId: jobRun.id,
      checkedCount: "checkedCount" in result ? result.checkedCount : 0,
      recoveredCount: "deletedCount" in result ? result.deletedCount : 0,
    });

    return result;
  } catch (error) {
    await failMaintenanceJobRun({
      jobRunId: jobRun.id,
      errorMessage:
        error instanceof Error ? error.message : "Unknown data retention error",
    });

    throw error;
  }
}
