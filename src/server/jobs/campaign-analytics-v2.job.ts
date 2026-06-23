import {
  completeMaintenanceJobRun,
  failMaintenanceJobRun,
  startMaintenanceJobRun,
} from "@/server/services/maintenance-job.service";
import { syncRecentCampaignAnalytics } from "@/server/services/campaign-analytics-v2.service";

export const CAMPAIGN_ANALYTICS_V2_JOB = "campaign-analytics-v2-sync";

export async function runCampaignAnalyticsV2Job() {
  const jobRun = await startMaintenanceJobRun(CAMPAIGN_ANALYTICS_V2_JOB);

  try {
    const result = await syncRecentCampaignAnalytics();

    await completeMaintenanceJobRun({
      jobRunId: jobRun.id,
      checkedCount: result.checked,
      recoveredCount: result.results.filter((item) => !item.skipped).length,
    });

    return result;
  } catch (error) {
    await failMaintenanceJobRun({
      jobRunId: jobRun.id,
      errorMessage:
        error instanceof Error
          ? error.message
          : "Unknown campaign analytics sync error",
    });

    throw error;
  }
}
