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

worker.on("completed", (job) => {
  console.log(`Developer webhook outbox job completed: ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Developer webhook outbox job failed: ${job?.id}`, error);
});

async function start() {
  const recovered = await enqueueRecoverableDeveloperWebhookOutboxEvents();
  console.log(
    `Developer webhook outbox worker started; recovered ${recovered} event(s)`,
  );
}

async function shutdown() {
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

void start();
