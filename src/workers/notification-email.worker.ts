import "dotenv/config";
import { Worker } from "bullmq";
import {
  NOTIFICATION_EMAIL_QUEUE,
  closeNotificationEmailQueue,
  getNotificationEmailConnection,
} from "@/server/queues/notification-email.queue";
import { processCompanyNotificationEmailDelivery } from "@/server/services/company-notification-email.service";
import { createWorkerHeartbeat } from "@/server/services/worker-heartbeat.service";

const heartbeat = createWorkerHeartbeat({
  workerName: "notification-email-worker",
});

const worker = new Worker(
  NOTIFICATION_EMAIL_QUEUE,
  async (job) => {
    const deliveryId = job.data.deliveryId as string;

    return processCompanyNotificationEmailDelivery(deliveryId);
  },
  {
    connection: getNotificationEmailConnection(),
    concurrency: 5,
  },
);

void heartbeat.start();

worker.on("completed", (job) => {
  console.log(`Notification email job completed: ${job.id}`);
});

worker.on("failed", async (job, error) => {
  console.error(`Notification email job failed: ${job?.id}`, error);
  await heartbeat.markError(error);
});

console.log("Notification email worker started");

async function shutdown() {
  console.log("Notification email worker shutting down");
  await worker.close();
  await closeNotificationEmailQueue();
  await heartbeat.stop();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
