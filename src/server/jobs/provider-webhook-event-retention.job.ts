import {
  completeMaintenanceJobRun,
  failMaintenanceJobRun,
  startMaintenanceJobRun,
} from "@/server/services/maintenance-job.service";
import { cleanupOldProviderWebhookEvents } from "@/server/services/provider-webhook-event-retention.service";

export const PROVIDER_WEBHOOK_EVENT_RETENTION_JOB =
  "provider-webhook-event-retention";

export async function runProviderWebhookEventRetentionJob() {
  const jobRun = await startMaintenanceJobRun(
    PROVIDER_WEBHOOK_EVENT_RETENTION_JOB,
  );

  try {
    const cleanup = await cleanupOldProviderWebhookEvents();

    await completeMaintenanceJobRun({
      jobRunId: jobRun.id,
      checkedCount: cleanup.succeededDeleted + cleanup.failedDeleted,
      recoveredCount: cleanup.succeededDeleted + cleanup.failedDeleted,
    });

    return cleanup;
  } catch (error) {
    await failMaintenanceJobRun({
      jobRunId: jobRun.id,
      errorMessage:
        error instanceof Error
          ? error.message
          : "Unknown provider webhook retention error",
    });

    throw error;
  }
}
