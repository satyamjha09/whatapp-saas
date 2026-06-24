import {
  completeMaintenanceJobRun,
  failMaintenanceJobRun,
  startMaintenanceJobRun,
} from "@/server/services/maintenance-job.service";
import { scanScheduledPlanChanges } from "@/server/services/scheduled-plan-change.service";

export const SCHEDULED_PLAN_CHANGE_JOB = "scheduled-plan-change-scan";

export async function runScheduledPlanChangeJob() {
  const jobRun = await startMaintenanceJobRun(SCHEDULED_PLAN_CHANGE_JOB);

  try {
    const result = await scanScheduledPlanChanges();
    const checkedCount =
      "checked" in result && typeof result.checked === "number"
        ? result.checked
        : 0;
    const recoveredCount =
      "applied" in result && typeof result.applied === "number"
        ? result.applied
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
          : "Unknown scheduled plan change scan error",
    });

    throw error;
  }
}
