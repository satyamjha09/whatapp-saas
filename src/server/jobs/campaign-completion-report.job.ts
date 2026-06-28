import {
  completeMaintenanceJobRun,
  failMaintenanceJobRun,
  startMaintenanceJobRun,
} from "@/server/services/maintenance-job.service";
import { autoGenerateCampaignCompletionReports } from "@/server/services/campaign-completion-report.service";

export const CAMPAIGN_COMPLETION_REPORT_JOB = "campaign-completion-report";

export async function runCampaignCompletionReportJob() {
  const jobRun = await startMaintenanceJobRun(CAMPAIGN_COMPLETION_REPORT_JOB);

  try {
    const result = await autoGenerateCampaignCompletionReports();

    await completeMaintenanceJobRun({
      checkedCount: result.checked ?? 0,
      jobRunId: jobRun.id,
      recoveredCount: result.generated ?? 0,
    });

    return result;
  } catch (error) {
    await failMaintenanceJobRun({
      errorMessage:
        error instanceof Error
          ? error.message
          : "Unknown campaign completion report error",
      jobRunId: jobRun.id,
    });

    throw error;
  }
}
