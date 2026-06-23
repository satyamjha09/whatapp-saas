import "dotenv/config";
import { Worker } from "bullmq";
import {
  DEVELOPER_WEBHOOK_OUTBOX_QUEUE,
  getDeveloperWebhookOutboxConnection,
} from "@/server/queues/developer-webhook-outbox.queue";
import {
  enqueueRecoverableDeveloperWebhookOutboxEvents,
} from "@/server/services/developer-webhook-outbox.service";
import { processDeveloperWebhookOutboxEvent } from "@/server/services/developer-webhook-outbox-processor.service";
import { createWorkerHeartbeat } from "@/server/services/worker-heartbeat.service";

const heartbeat = createWorkerHeartbeat({
  workerName: "developer-webhook-outbox-worker",
});

type DeveloperWebhookOutboxJob = {
  outboxEventId: string;
};

const worker = new Worker<DeveloperWebhookOutboxJob>(
  DEVELOPER_WEBHOOK_OUTBOX_QUEUE,
  async (job) => processDeveloperWebhookOutboxEvent(job.data.outboxEventId),
  {
    connection: getDeveloperWebhookOutboxConnection(),
    concurrency: 5,
  },
);

void heartbeat.start();

worker.on("completed", (job) => {
  console.log(`Developer webhook outbox job completed: ${job.id}`);
});

worker.on("failed", async (job, error) => {
  console.error(`Developer webhook outbox job failed: ${job?.id}`, error);
  await heartbeat.markError(error);
});

async function start() {
  const recovered = await enqueueRecoverableDeveloperWebhookOutboxEvents();
  console.log(
    `Developer webhook outbox worker started; recovered ${recovered} event(s)`,
  );
}

async function shutdown() {
  await worker.close();
  await heartbeat.stop();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

void start();
