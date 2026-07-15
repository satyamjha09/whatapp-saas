import { Worker } from "bullmq";
import { getRedisConnection } from "@/lib/redis";
import type { InboxAiJobData } from "@/lib/queue";
import { generateInboxConversationSummary } from "@/server/services/inbox-ai-summary.service";
import {
  generateInboxAiSuggestion,
  normalizeInboxAiTone,
} from "@/server/services/inbox-ai-suggestion.service";
import { translateInboxMessage } from "@/server/services/inbox-translation.service";
import { createWorkerHeartbeat } from "@/server/services/worker-heartbeat.service";

const heartbeat = createWorkerHeartbeat({
  workerName: "inbox-ai-worker",
});

const worker = new Worker<InboxAiJobData>(
  "inbox-ai-queue",
  async (job) => {
    if (job.data.kind === "SUMMARY") {
      await generateInboxConversationSummary(job.data);
      return;
    }

    if (job.data.kind === "SUGGESTION") {
      await generateInboxAiSuggestion({
        ...job.data,
        tone: normalizeInboxAiTone(job.data.tone),
      });
      return;
    }

    await translateInboxMessage(job.data);
  },
  {
    connection: getRedisConnection(),
    concurrency: Number(process.env.INBOX_AI_WORKER_CONCURRENCY || 2),
  },
);

worker.on("failed", (_job, error) => {
  void heartbeat.markError(error);
  console.error("[inbox-ai-worker] Job failed:", error);
});

console.log("[inbox-ai-worker] Started.");
void heartbeat.start();

async function shutdown() {
  console.log("[inbox-ai-worker] Shutting down.");
  await worker.close();
  await heartbeat.stop();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});
