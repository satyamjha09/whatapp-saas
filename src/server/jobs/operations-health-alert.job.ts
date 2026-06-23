import { prisma } from "@/lib/prisma";
import {
  completeMaintenanceJobRun,
  failMaintenanceJobRun,
  startMaintenanceJobRun,
} from "@/server/services/maintenance-job.service";
import { createCompanyNotification } from "@/server/services/company-notification.service";
import { getOperationsHealth } from "@/server/services/operations-health.service";

export const OPERATIONS_HEALTH_ALERT_JOB = "operations-health-alert-check";

export async function runOperationsHealthAlertJob() {
  const jobRun = await startMaintenanceJobRun(OPERATIONS_HEALTH_ALERT_JOB);

  try {
    const health = await getOperationsHealth();

    const companies = await prisma.company.findMany({
      select: {
        id: true,
      },
      take: 500,
    });

    let alertCount = 0;
    const dayKey = new Date().toISOString().slice(0, 10);

    for (const company of companies) {
      if (!health.redis.ok) {
        await createCompanyNotification({
          companyId: company.id,
          type: "SYSTEM",
          severity: "ERROR",
          title: "Redis connection issue",
          message:
            health.redis.error ??
            "Redis health check failed. Background workers may be affected.",
          actionHref: "/dashboard/system/health",
          idempotencyKey: `system-health:redis:${dayKey}`,
        });

        alertCount += 1;
      }

      if (!health.database.ok) {
        await createCompanyNotification({
          companyId: company.id,
          type: "SYSTEM",
          severity: "ERROR",
          title: "Database connection issue",
          message:
            health.database.error ??
            "Database health check failed. Dashboard and workers may be affected.",
          actionHref: "/dashboard/system/health",
          idempotencyKey: `system-health:database:${dayKey}`,
        });

        alertCount += 1;
      }

      for (const queue of health.queues) {
        if (
          queue.failed >= 20 ||
          queue.waiting >= 1000 ||
          queue.paused ||
          queue.error
        ) {
          await createCompanyNotification({
            companyId: company.id,
            type: "SYSTEM",
            severity: "WARNING",
            title: `Queue needs attention: ${queue.name}`,
            message: `Queue ${queue.name} has waiting=${queue.waiting}, failed=${queue.failed}, paused=${queue.paused}.${
              queue.error ? ` Error: ${queue.error}` : ""
            }`,
            actionHref: "/dashboard/system/health",
            idempotencyKey: `system-health:queue:${queue.name}:${dayKey}`,
            metadata: {
              queue,
            },
          });

          alertCount += 1;
        }
      }

      for (const worker of health.workerHeartbeats.unhealthyWorkers) {
        await createCompanyNotification({
          companyId: company.id,
          type: "SYSTEM",
          severity: "ERROR",
          title: `Worker unhealthy: ${worker.workerName}`,
          message: worker.isStale
            ? `Worker ${worker.workerName} has not sent a heartbeat since ${
                worker.lastHeartbeatAt?.toISOString() ?? "an unknown time"
              }.`
            : worker.isMissing
              ? `Worker ${worker.workerName} has not reported a heartbeat yet.`
              : `Worker ${worker.workerName} status is ${worker.status}.`,
          actionHref: "/dashboard/system/health",
          idempotencyKey: `system-health:worker:${worker.workerName}:${dayKey}`,
          metadata: {
            workerName: worker.workerName,
            instanceId: worker.instanceId,
            status: worker.status,
            lastHeartbeatAt: worker.lastHeartbeatAt,
            lastError: worker.lastError,
          },
        });

        alertCount += 1;
      }
    }

    await completeMaintenanceJobRun({
      jobRunId: jobRun.id,
      checkedCount: health.queues.length + health.workerHeartbeats.workers.length + 2,
      recoveredCount: alertCount,
    });

    return {
      health,
      alertCount,
    };
  } catch (error) {
    await failMaintenanceJobRun({
      jobRunId: jobRun.id,
      errorMessage:
        error instanceof Error ? error.message : "Unknown health alert error",
    });

    throw error;
  }
}
