import {
  completeMaintenanceJobRun,
  failMaintenanceJobRun,
  startMaintenanceJobRun,
} from "@/server/services/maintenance-job.service";
import {
  expirePastDueSubscriptions,
  SUBSCRIPTION_EXPIRY_JOB,
} from "@/server/services/subscription-expiry.service";

export async function runSubscriptionExpiryJob({
  companyId,
  limit = 500,
}: {
  companyId?: string;
  limit?: number;
} = {}) {
  const jobRun = await startMaintenanceJobRun(
    SUBSCRIPTION_EXPIRY_JOB,
    companyId,
  );

  try {
    const result = await expirePastDueSubscriptions({ companyId, limit });
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
        error instanceof Error ? error.message : "Unknown subscription error",
    });
    throw error;
  }
}
