import "dotenv/config";
import { Worker } from "bullmq";
import { getAutomationMonitoringQueue } from "@/lib/queue";
import { getRedisConnection } from "@/lib/redis";
import { runAutomationMonitoringChecks } from "@/server/services/automation-monitoring.service";
import { createWorkerHeartbeat } from "@/server/services/worker-heartbeat.service";

const AUTOMATION_MONITORING_JOB = "automation-monitoring:checks";

const heartbeat = createWorkerHeartbeat({
  workerName: "automation-monitoring-worker",
});

async function ensureRepeatableJobs() {
  await getAutomationMonitoringQueue().add(
    AUTOMATION_MONITORING_JOB,
    {},
    {
      jobId: AUTOMATION_MONITORING_JOB,
      repeat: {
        every: 5 * 60 * 1000,
      },
      removeOnComplete: {
        age: 24 * 60 * 60,
        count: 200,
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60,
        count: 500,
      },
    },
  );
}

const worker = new Worker(
  "automation-monitoring-queue",
  async (job) => {
    if (job.name !== AUTOMATION_MONITORING_JOB) {
      return { skipped: true, reason: "Unknown monitoring job" };
    }

    console.log("Automation monitoring checks started:", job.id);
    const result = await runAutomationMonitoringChecks();
    console.log("Automation monitoring checks completed:", result);
    return result;
  },
  {
    concurrency: 1,
    connection: getRedisConnection(),
  },
);

void heartbeat.start();
void ensureRepeatableJobs();

worker.on("failed", async (job, error) => {
  console.error("Automation monitoring worker failed:", job?.id, error);
  await heartbeat.markError(error);
});

worker.on("completed", (job) => {
  console.log("Automation monitoring worker completed:", job.id);
});

console.log("Automation monitoring worker started");

async function shutdown() {
  console.log("Automation monitoring worker shutting down");
  await worker.close();
  await getAutomationMonitoringQueue().close();
  await heartbeat.stop();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

export default worker;
