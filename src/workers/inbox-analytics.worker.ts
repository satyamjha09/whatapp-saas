import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { aggregateInboxAgentMetricsDaily } from "@/server/services/inbox-analytics.service";
import { createWorkerHeartbeat } from "@/server/services/worker-heartbeat.service";

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

let isRunning = false;
const heartbeat = createWorkerHeartbeat({
  workerName: "inbox-analytics-worker",
});

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

async function aggregateRecentInboxMetrics() {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    const companies = await prisma.company.findMany({
      select: {
        id: true,
      },
    });
    const today = startOfUtcDay(new Date());
    const yesterday = addUtcDays(today, -1);
    let metricsWritten = 0;

    for (const company of companies) {
      const [todayResult, yesterdayResult] = await Promise.all([
        aggregateInboxAgentMetricsDaily({
          companyId: company.id,
          date: today,
        }),
        aggregateInboxAgentMetricsDaily({
          companyId: company.id,
          date: yesterday,
        }),
      ]);

      metricsWritten += todayResult.metricsWritten + yesterdayResult.metricsWritten;
    }

    if (metricsWritten > 0) {
      console.log(
        `[inbox-analytics-worker] Rebuilt ${metricsWritten} daily inbox metric row(s).`,
      );
    }
  } catch (error) {
    await heartbeat.markError(error);
    console.error("[inbox-analytics-worker] Failed to aggregate metrics:", error);
  } finally {
    isRunning = false;
  }
}

console.log("[inbox-analytics-worker] Started.");

void heartbeat.start();
void aggregateRecentInboxMetrics();

const interval = setInterval(() => {
  void aggregateRecentInboxMetrics();
}, CHECK_INTERVAL_MS);

function shutdown() {
  console.log("[inbox-analytics-worker] Shutting down.");
  clearInterval(interval);
  heartbeat
    .stop()
    .catch(console.error)
    .finally(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
