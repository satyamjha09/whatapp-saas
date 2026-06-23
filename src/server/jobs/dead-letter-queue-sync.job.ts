import {
  completeMaintenanceJobRun,
  failMaintenanceJobRun,
  startMaintenanceJobRun,
} from "@/server/services/maintenance-job.service";
import { syncAllFailedQueueJobs } from "@/server/services/dead-letter-queue.service";

export const DEAD_LETTER_QUEUE_SYNC_JOB = "dead-letter-queue-sync";

export async function runDeadLetterQueueSyncJob() {
  const jobRun = await startMaintenanceJobRun(DEAD_LETTER_QUEUE_SYNC_JOB);

  try {
    const results = await syncAllFailedQueueJobs();
    const checkedCount = results.length;
    const recoveredCount = results.reduce(
      (sum, result) => sum + result.synced,
      0,
    );

    await completeMaintenanceJobRun({
      jobRunId: jobRun.id,
      checkedCount,
      recoveredCount,
    });

    return results;
  } catch (error) {
    await failMaintenanceJobRun({
      jobRunId: jobRun.id,
      errorMessage:
        error instanceof Error
          ? error.message
          : "Unknown dead letter queue sync error",
    });

    throw error;
  }
}
