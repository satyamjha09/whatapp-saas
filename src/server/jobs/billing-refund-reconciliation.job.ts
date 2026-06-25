import {
  completeMaintenanceJobRun,
  failMaintenanceJobRun,
  startMaintenanceJobRun,
} from "@/server/services/maintenance-job.service";
import { scanBillingRefundReconciliation } from "@/server/services/billing-refund-reconciliation.service";

export const BILLING_REFUND_RECONCILIATION_JOB = "billing-refund-reconciliation-scan";

export async function runBillingRefundReconciliationJob() {
  const jobRun = await startMaintenanceJobRun(BILLING_REFUND_RECONCILIATION_JOB);

  try {
    const result = await scanBillingRefundReconciliation();

    await completeMaintenanceJobRun({
      jobRunId: jobRun.id,
      checkedCount: ("checked" in result && typeof result.checked === "number") ? result.checked : 0,
      recoveredCount: ("processed" in result && typeof result.processed === "number") ? result.processed : 0,
    });

    return result;
  } catch (error) {
    await failMaintenanceJobRun({
      jobRunId: jobRun.id,
      errorMessage: error instanceof Error ? error.message : "Unknown billing refund reconciliation error",
    });
    throw error;
  }
}
