import {
  completeMaintenanceJobRun,
  failMaintenanceJobRun,
  startMaintenanceJobRun,
} from "@/server/services/maintenance-job.service";
import {
  cleanupExpiredPrivacyExports,
  cleanupOldPrivacyRequests,
} from "@/server/services/privacy-center.service";

export const PRIVACY_EXPORT_CLEANUP_JOB = "privacy-export-cleanup";
export const PRIVACY_REQUEST_RETENTION_JOB = "privacy-request-retention";

export async function runPrivacyExportCleanupJob() {
  const jobRun = await startMaintenanceJobRun(PRIVACY_EXPORT_CLEANUP_JOB);

  try {
    const result = await cleanupExpiredPrivacyExports();
    await completeMaintenanceJobRun({
      jobRunId: jobRun.id,
      checkedCount: result.deleted,
      recoveredCount: result.deleted,
    });
    return result;
  } catch (error) {
    await failMaintenanceJobRun({
      jobRunId: jobRun.id,
      errorMessage:
        error instanceof Error
          ? error.message
          : "Unknown privacy export cleanup error",
    });
    throw error;
  }
}

export async function runPrivacyRequestRetentionJob() {
  const jobRun = await startMaintenanceJobRun(PRIVACY_REQUEST_RETENTION_JOB);

  try {
    const result = await cleanupOldPrivacyRequests();
    await completeMaintenanceJobRun({
      jobRunId: jobRun.id,
      checkedCount: result.count,
      recoveredCount: result.count,
    });
    return { deleted: result.count };
  } catch (error) {
    await failMaintenanceJobRun({
      jobRunId: jobRun.id,
      errorMessage:
        error instanceof Error
          ? error.message
          : "Unknown privacy request retention error",
    });
    throw error;
  }
}
