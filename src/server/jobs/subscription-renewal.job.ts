import {
  completeMaintenanceJobRun,
  failMaintenanceJobRun,
  startMaintenanceJobRun,
} from "@/server/services/maintenance-job.service";
import { scanSubscriptionRenewals } from "@/server/services/subscription-renewal.service";

export const SUBSCRIPTION_RENEWAL_JOB = "subscription-renewal-scan";

export async function runSubscriptionRenewalJob() {
  const jobRun = await startMaintenanceJobRun(SUBSCRIPTION_RENEWAL_JOB);

  try {
    const result = await scanSubscriptionRenewals();
    const checkedCount =
      "checked" in result && typeof result.checked === "number"
        ? result.checked
        : 0;
    const recoveredCount =
      "remindersSent" in result &&
      typeof result.remindersSent === "number" &&
      typeof result.markedPastDue === "number" &&
      typeof result.downgraded === "number"
        ? result.remindersSent + result.markedPastDue + result.downgraded
        : 0;

    await completeMaintenanceJobRun({
      jobRunId: jobRun.id,
      checkedCount,
      recoveredCount,
    });

    return result;
  } catch (error) {
    await failMaintenanceJobRun({
      jobRunId: jobRun.id,
      errorMessage:
        error instanceof Error
          ? error.message
          : "Unknown subscription renewal scan error",
    });

    throw error;
  }
}
