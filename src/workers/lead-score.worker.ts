import "dotenv/config";
import { Worker } from "bullmq";
import { getLeadScoreQueue } from "@/lib/queue";
import { calculateLeadScore } from "@/server/services/lead-scoring.service";
import { createWorkerHeartbeat } from "@/server/services/worker-heartbeat.service";
import { getRedisConnection } from "@/lib/redis";

const heartbeat = createWorkerHeartbeat({
  workerName: "lead-score-worker",
});

const worker = new Worker(
  "lead-score-queue",
  async (job) => {
    const { companyId, contactId } = job.data;
    await calculateLeadScore(companyId, contactId);
  },
  {
    connection: getRedisConnection(),
    concurrency: 5,
  },
);

void heartbeat.start();

worker.on("completed", (job) => {
  console.log(`Lead score job completed: ${job.id}`);
});

worker.on("failed", async (job, error) => {
  console.error(`Lead score job failed: ${job?.id}`, error);
  await heartbeat.markError(error);
});

console.log("Lead score worker started");

async function shutdown() {
  console.log("Lead score worker shutting down");
  await worker.close();
  await getLeadScoreQueue().close();
  await heartbeat.stop();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

export default worker;
