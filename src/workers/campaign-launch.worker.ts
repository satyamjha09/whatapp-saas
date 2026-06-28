import "dotenv/config";
import { Worker } from "bullmq";
import {
  getCampaignLaunchQueue,
  getCampaignLaunchQueueName,
} from "@/server/queues/campaign-launch.queue";
import { queueCampaignMessagesFromLaunch } from "@/server/services/campaign-launch-orchestrator.service";
import { createWorkerHeartbeat } from "@/server/services/worker-heartbeat.service";
import { getRedisConnection } from "@/lib/redis";

const heartbeat = createWorkerHeartbeat({
  workerName: "campaign-launch-worker",
});

const worker = new Worker(
  getCampaignLaunchQueueName(),
  async (job) => {
    return queueCampaignMessagesFromLaunch({
      companyId: job.data.companyId,
      launchRunId: job.data.launchRunId,
    });
  },
  {
    connection: getRedisConnection(),
    concurrency: 2,
  },
);

void heartbeat.start();

worker.on("completed", (job) => {
  console.log(`Campaign launch job completed: ${job.id}`);
});

worker.on("failed", async (job, error) => {
  console.error(`Campaign launch job failed: ${job?.id}`, error);
  await heartbeat.markError(error);
});

console.log("Campaign launch worker started");

async function shutdown() {
  console.log("Campaign launch worker shutting down");
  await worker.close();
  await getCampaignLaunchQueue().close();
  await heartbeat.stop();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

export default worker;
