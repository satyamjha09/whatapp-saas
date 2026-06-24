import {
  completeMaintenanceJobRun,
  failMaintenanceJobRun,
  startMaintenanceJobRun,
} from "@/server/services/maintenance-job.service";
import { scanPlanCheckoutReconciliation } from "@/server/services/plan-checkout-reconciliation.service";

export const PLAN_CHECKOUT_RECONCILIATION_JOB =
  "plan-checkout-reconciliation-scan";

export async function runPlanCheckoutReconciliationJob() {
  const jobRun = await startMaintenanceJobRun(PLAN_CHECKOUT_RECONCILIATION_JOB);

  try {
    const result = await scanPlanCheckoutReconciliation();

    if ("skipped" in result) {
      await completeMaintenanceJobRun({
        jobRunId: jobRun.id,
        checkedCount: 0,
        recoveredCount: 0,
      });
      return result;
    }

    await completeMaintenanceJobRun({
      jobRunId: jobRun.id,
      checkedCount: result.checked,
      recoveredCount: result.expired + result.manualReview,
    });

    return result;
  } catch (error) {
    await failMaintenanceJobRun({
      jobRunId: jobRun.id,
      errorMessage:
        error instanceof Error
          ? error.message
          : "Unknown plan checkout reconciliation error",
    });

    throw error;
  }
}
