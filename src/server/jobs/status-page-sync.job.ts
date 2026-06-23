import {
  completeMaintenanceJobRun,
  failMaintenanceJobRun,
  startMaintenanceJobRun,
} from "@/server/services/maintenance-job.service";
import { syncStatusPageComponentsFromUptime } from "@/server/services/status-page.service";

export const STATUS_PAGE_SYNC_JOB = "status-page-sync";

export async function runStatusPageSyncJob() {
  const jobRun = await startMaintenanceJobRun(STATUS_PAGE_SYNC_JOB);

  try {
    const result = await syncStatusPageComponentsFromUptime();

    await completeMaintenanceJobRun({
      jobRunId: jobRun.id,
      checkedCount: (!result.skipped && "synced" in result && typeof result.synced === "number") ? result.synced : 0,
      recoveredCount: 0,
    });

    return result;
  } catch (error) {
    await failMaintenanceJobRun({
      jobRunId: jobRun.id,
      errorMessage:
        error instanceof Error ? error.message : "Unknown status page sync error",
    });

    throw error;
  }
}
