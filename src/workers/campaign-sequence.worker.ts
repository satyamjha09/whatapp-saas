import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { processCampaignSequences } from "@/server/services/campaign-sequence.service";
import { createWorkerHeartbeat } from "@/server/services/worker-heartbeat.service";

const workerName = "campaign-sequence-worker";
const heartbeat = createWorkerHeartbeat({
  workerName,
});

const intervalMs = Number(
  process.env.CAMPAIGN_SEQUENCE_INTERVAL_MS ?? 60_000,
);
const batchSize = Number(
  process.env.CAMPAIGN_SEQUENCE_BATCH_SIZE ?? 100,
);

let isRunning = false;
let shouldStop = false;

async function runOnce() {
  if (isRunning) return;

  isRunning = true;

  try {
    const result = await processCampaignSequences({ batchSize });
    console.log("Campaign sequence run completed", result);
  } catch (error) {
    console.error("Campaign sequence run failed", error);
    await heartbeat.markError(
      error instanceof Error
        ? error
        : new Error("Campaign sequence run failed"),
    );
  } finally {
    isRunning = false;
  }
}

async function main() {
  console.log("Campaign sequence worker started");
  await heartbeat.start();

  while (!shouldStop) {
    await runOnce();
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

async function shutdown() {
  console.log("Campaign sequence worker shutting down");
  shouldStop = true;
  await heartbeat.stop();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

void main().catch(async (error) => {
  console.error("Campaign sequence worker crashed", error);
  await heartbeat.markError(error instanceof Error ? error : new Error("Crash"));
  await prisma.$disconnect();
  process.exit(1);
});
