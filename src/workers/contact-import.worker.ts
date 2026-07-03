import "dotenv/config";
import { Worker } from "bullmq";
import { getContactImportQueue, type ContactImportQueueJobData } from "@/lib/queue";
import { processContactImportJob } from "@/server/services/contact-import.service";
import { createWorkerHeartbeat } from "@/server/services/worker-heartbeat.service";
import { getRedisConnection } from "@/lib/redis";

const heartbeat = createWorkerHeartbeat({
  workerName: "contact-import-worker",
});

const worker = new Worker<ContactImportQueueJobData>(
  "contact-import-queue",
  async (job) => {
    const { companyId, importId } = job.data;
    await processContactImportJob({ companyId, importId });
  },
  {
    connection: getRedisConnection(),
    concurrency: 2,
  },
);

void heartbeat.start();

worker.on("completed", (job) => {
  console.log(`Contact import job completed: ${job.id}`);
});

worker.on("failed", async (job, error) => {
  console.error(`Contact import job failed: ${job?.id}`, error);
  await heartbeat.markError(error);
});

console.log("Contact import worker started");

async function shutdown() {
  console.log("Contact import worker shutting down");
  await worker.close();
  await getContactImportQueue().close();
  await heartbeat.stop();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

export default worker;
