import {
  completeMaintenanceJobRun,
  failMaintenanceJobRun,
  startMaintenanceJobRun,
} from "@/server/services/maintenance-job.service";
import { cleanupExpiredComplianceEvidenceExports } from "@/server/services/compliance-evidence.service";

export const COMPLIANCE_EVIDENCE_CLEANUP_JOB =
  "compliance-evidence-cleanup";

export async function runComplianceEvidenceCleanupJob() {
  const jobRun = await startMaintenanceJobRun(
    COMPLIANCE_EVIDENCE_CLEANUP_JOB,
  );

  try {
    const result = await cleanupExpiredComplianceEvidenceExports();

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
          : "Unknown compliance evidence cleanup error",
    });

    throw error;
  }
}
