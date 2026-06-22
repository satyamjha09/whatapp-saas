import "dotenv/config";
import { Worker } from "bullmq";
import { getMaintenanceQueue } from "@/lib/queue";
import { getRedisConnection } from "@/lib/redis";
import { runSubscriptionExpiryJob } from "@/server/jobs/subscription-expiry.job";
import {
  runSubscriptionCancellationJob,
  SUBSCRIPTION_CANCELLATION_JOB,
} from "@/server/jobs/subscription-cancellation.job";
import { SUBSCRIPTION_EXPIRY_JOB } from "@/server/services/subscription-expiry.service";

async function ensureRepeatableJobs() {
  await getMaintenanceQueue().add(
    SUBSCRIPTION_EXPIRY_JOB,
    {},
    {
      repeat: { every: 60 * 60 * 1000 },
      jobId: SUBSCRIPTION_EXPIRY_JOB,
      removeOnComplete: { age: 24 * 60 * 60, count: 100 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 200 },
    },
  );
  await getMaintenanceQueue().add(
    SUBSCRIPTION_CANCELLATION_JOB,
    {},
    {
      repeat: { every: 60 * 60 * 1000 },
      jobId: SUBSCRIPTION_CANCELLATION_JOB,
      removeOnComplete: { age: 24 * 60 * 60, count: 100 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 200 },
    },
  );
}

const worker = new Worker(
  "maintenance-queue",
  async (job) => {
    if (job.name === SUBSCRIPTION_EXPIRY_JOB) {
      const result = await runSubscriptionExpiryJob();
      console.log("Subscription expiry check completed", result);
      return result;
    }

    if (job.name === SUBSCRIPTION_CANCELLATION_JOB) {
      const result = await runSubscriptionCancellationJob();
      console.log("Subscription cancellation check completed", result);
      return result;
    }

    throw new Error(`Unknown maintenance job: ${job.name}`);
  },
  { connection: getRedisConnection() },
);

worker.on("failed", (job, error) => {
  console.error(`[maintenance-worker] ${job?.name ?? "job"} failed:`, error);
});

void ensureRepeatableJobs()
  .then(() => {
    console.log("[maintenance-worker] Started.");
  })
  .catch((error) => {
    console.error("[maintenance-worker] Unable to schedule jobs:", error);
  });

async function shutdown() {
  console.log("[maintenance-worker] Shutting down.");
  await worker.close();
  await getMaintenanceQueue().close();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
