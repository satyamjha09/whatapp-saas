import {
  completeMaintenanceJobRun,
  failMaintenanceJobRun,
  startMaintenanceJobRun,
} from "@/server/services/maintenance-job.service";
import { scanUsageQuotaAlerts } from "@/server/services/usage-quota-alert.service";

export const USAGE_QUOTA_ALERT_JOB = "usage-quota-alert-scan";

export async function runUsageQuotaAlertJob() {
  const jobRun = await startMaintenanceJobRun(USAGE_QUOTA_ALERT_JOB);

  try {
    const result = await scanUsageQuotaAlerts();
    const checkedCount =
      "checked" in result && typeof result.checked === "number"
        ? result.checked
        : 0;
    const createdCount =
      "created" in result && typeof result.created === "number"
        ? result.created
        : 0;

    await completeMaintenanceJobRun({
      jobRunId: jobRun.id,
      checkedCount,
      recoveredCount: createdCount,
    });

    return result;
  } catch (error) {
    await failMaintenanceJobRun({
      jobRunId: jobRun.id,
      errorMessage:
        error instanceof Error ? error.message : "Unknown usage quota alert error",
    });

    throw error;
  }
}
