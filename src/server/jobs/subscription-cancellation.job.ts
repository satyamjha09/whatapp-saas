import {
  completeMaintenanceJobRun,
  failMaintenanceJobRun,
  startMaintenanceJobRun,
} from "@/server/services/maintenance-job.service";
import { applyDueSubscriptionCancellations } from "@/server/services/subscription-cancellation.service";

export const SUBSCRIPTION_CANCELLATION_JOB =
  "subscription-cancellation-check";

export async function runSubscriptionCancellationJob({
  companyId,
  limit = 500,
}: {
  companyId?: string;
  limit?: number;
} = {}) {
  const jobRun = await startMaintenanceJobRun(
    SUBSCRIPTION_CANCELLATION_JOB,
    companyId,
  );

  try {
    const result = await applyDueSubscriptionCancellations({ companyId, limit });
    await completeMaintenanceJobRun({
      jobRunId: jobRun.id,
      checkedCount: result.checkedCount,
      recoveredCount: result.recoveredCount,
    });

    if (!companyId) {
      for (const item of result.results) {
        const companyRun = await startMaintenanceJobRun(
          SUBSCRIPTION_CANCELLATION_JOB,
          item.companyId,
        );
        await completeMaintenanceJobRun({
          jobRunId: companyRun.id,
          checkedCount: 1,
          recoveredCount: 1,
        });
      }
    }

    return result;
  } catch (error) {
    await failMaintenanceJobRun({
      jobRunId: jobRun.id,
      errorMessage:
        error instanceof Error ? error.message : "Unknown cancellation error",
    });
    throw error;
  }
}
