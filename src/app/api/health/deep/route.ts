import { NextResponse } from "next/server";
import { getOperationsHealth } from "@/server/services/operations-health.service";
import { getSystemMaintenanceMode } from "@/server/services/system-maintenance-mode.service";
import { assertHealthcheckToken } from "@/server/utils/healthcheck-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await assertHealthcheckToken();

    const health = await getOperationsHealth();
    const maintenanceMode = await getSystemMaintenanceMode();

    return NextResponse.json(
      {
        ok: health.isHealthy,
        timestamp: new Date().toISOString(),
        maintenanceMode,
        redis: health.redis,
        database: health.database,
        databaseBackups: health.databaseBackups,
        queues: health.queues,
        workerHeartbeats: {
          staleAfterSeconds: health.workerHeartbeats.staleAfterSeconds,
          expectedWorkers: health.workerHeartbeats.expectedWorkers.map(
            (worker) => ({
              workerName: worker.workerName,
              status: worker.status,
              isMissing: worker.isMissing,
              isStale: worker.isStale,
              isHealthy: worker.isHealthy,
              lastHeartbeatAt: worker.lastHeartbeatAt,
              lastError: worker.lastError,
            }),
          ),
          missingWorkers: health.workerHeartbeats.missingWorkers.length,
          unhealthyWorkers: health.workerHeartbeats.unhealthyWorkers.length,
        },
        recentFailedMaintenanceJobs: health.recentJobs.filter(
          (job) => job.status === "FAILED",
        ).length,
      },
      {
        status: health.isHealthy ? 200 : 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Healthcheck failed",
        timestamp: new Date().toISOString(),
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
