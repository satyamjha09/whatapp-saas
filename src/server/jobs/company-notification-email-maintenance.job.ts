import {
  completeMaintenanceJobRun,
  failMaintenanceJobRun,
  startMaintenanceJobRun,
} from "@/server/services/maintenance-job.service";
import { runNotificationEmailDeliveryMaintenance } from "@/server/services/company-notification-email-maintenance.service";

export const COMPANY_NOTIFICATION_EMAIL_MAINTENANCE_JOB =
  "company-notification-email-maintenance";

export async function runCompanyNotificationEmailMaintenanceJob() {
  const jobRun = await startMaintenanceJobRun(
    COMPANY_NOTIFICATION_EMAIL_MAINTENANCE_JOB,
  );

  try {
    const result = await runNotificationEmailDeliveryMaintenance();

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
        error instanceof Error
          ? error.message
          : "Unknown notification email maintenance error",
    });

    throw error;
  }
}
