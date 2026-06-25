import {
  completeMaintenanceJobRun,
  failMaintenanceJobRun,
  startMaintenanceJobRun,
} from "@/server/services/maintenance-job.service";
import { generateCurrentBillingSnapshots } from "@/server/services/billing-analytics.service";

export const BILLING_ANALYTICS_JOB = "billing-analytics-snapshot";

export async function runBillingAnalyticsJob() {
  const jobRun = await startMaintenanceJobRun(BILLING_ANALYTICS_JOB);

  try {
    const result = await generateCurrentBillingSnapshots();

    await completeMaintenanceJobRun({
      jobRunId: jobRun.id,
      checkedCount: 2,
      recoveredCount: 2,
    });

    return result;
  } catch (error) {
    await failMaintenanceJobRun({
      jobRunId: jobRun.id,
      errorMessage:
        error instanceof Error
          ? error.message
          : "Unknown billing analytics snapshot error",
    });

    throw error;
  }
}
