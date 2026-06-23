import {
  completeMaintenanceJobRun,
  failMaintenanceJobRun,
  startMaintenanceJobRun,
} from "@/server/services/maintenance-job.service";
import {
  cleanupOldUptimeChecks,
  runDueUptimeMonitorChecks,
} from "@/server/services/uptime-monitoring.service";

export const UPTIME_MONITORING_JOB = "uptime-monitoring";

export async function runUptimeMonitoringJob() {
  const jobRun = await startMaintenanceJobRun(UPTIME_MONITORING_JOB);

  try {
    const result = await runDueUptimeMonitorChecks();

    await completeMaintenanceJobRun({
      jobRunId: jobRun.id,
      checkedCount: result.checked ?? 0,
      recoveredCount: 0,
    });

    return result;
  } catch (error) {
    await failMaintenanceJobRun({
      jobRunId: jobRun.id,
      errorMessage:
        error instanceof Error ? error.message : "Unknown uptime monitor error",
    });

    throw error;
  }
}

export const UPTIME_MONITORING_RETENTION_JOB = "uptime-monitoring-retention";

export async function runUptimeMonitoringRetentionJob() {
  const jobRun = await startMaintenanceJobRun(UPTIME_MONITORING_RETENTION_JOB);

  try {
    const deleted = await cleanupOldUptimeChecks();

    await completeMaintenanceJobRun({
      jobRunId: jobRun.id,
      checkedCount: deleted.count,
      recoveredCount: deleted.count,
    });

    return {
      deleted: deleted.count,
    };
  } catch (error) {
    await failMaintenanceJobRun({
      jobRunId: jobRun.id,
      errorMessage:
        error instanceof Error
          ? error.message
          : "Unknown uptime monitor retention error",
    });

    throw error;
  }
}
