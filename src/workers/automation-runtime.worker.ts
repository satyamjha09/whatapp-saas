import "dotenv/config";
import { Worker } from "bullmq";
import {
  getAutomationRuntimeQueue,
  type AutomationRuntimeJobData,
} from "@/lib/queue";
import { getRedisConnection } from "@/lib/redis";
import { runAutomationForInboundMessage } from "@/server/services/automation-runtime.service";
import { createWorkerHeartbeat } from "@/server/services/worker-heartbeat.service";

const heartbeat = createWorkerHeartbeat({
  workerName: "automation-runtime-worker",
});

const worker = new Worker<AutomationRuntimeJobData>(
  "automation-runtime-queue",
  async (job) => {
    console.log("Automation runtime job started:", job.id);
    await runAutomationForInboundMessage(job.data);
  },
  {
    concurrency: 5,
    connection: getRedisConnection(),
  },
);

void heartbeat.start();

worker.on("completed", (job) => {
  console.log("Automation runtime job completed:", job.id);
});

worker.on("failed", async (job, error) => {
  console.error("Automation runtime job failed:", job?.id, error);
  await heartbeat.markError(error);
});

console.log("Automation runtime worker started");

async function shutdown() {
  console.log("Automation runtime worker shutting down");
  await worker.close();
  await getAutomationRuntimeQueue().close();
  await heartbeat.stop();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

export default worker;
