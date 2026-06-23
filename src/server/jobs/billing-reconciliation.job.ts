import {
  completeMaintenanceJobRun,
  failMaintenanceJobRun,
  startMaintenanceJobRun,
} from "@/server/services/maintenance-job.service";
import { runBillingReconciliation } from "@/server/services/billing-reconciliation.service";

export const BILLING_RECONCILIATION_JOB = "billing-reconciliation";

export async function runBillingReconciliationJob() {
  const jobRun = await startMaintenanceJobRun(BILLING_RECONCILIATION_JOB);

  try {
    const result = await runBillingReconciliation();
    const checkedCount = "checkedCompanies" in result ? result.checkedCompanies : 0;
    const recoveredCount = "issueCount" in result ? result.issueCount : 0;

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
          : "Unknown billing reconciliation error",
    });
    throw error;
  }
}
