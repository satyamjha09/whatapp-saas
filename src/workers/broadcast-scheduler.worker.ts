import "dotenv/config";
import { createWorkerHeartbeat } from "@/server/services/worker-heartbeat.service";
import { processDueBroadcastSchedules } from "@/server/services/broadcast-scheduler.service";

const intervalMs = Math.max(
  Number(process.env.BROADCAST_SCHEDULER_INTERVAL_MS || 60_000),
  15_000,
);

const heartbeat = createWorkerHeartbeat({
  workerName: "broadcast-scheduler-worker",
});

let isRunning = false;
let timer: NodeJS.Timeout | null = null;

async function tick() {
  if (isRunning) return;
  isRunning = true;

  try {
    const result = await processDueBroadcastSchedules();
    if (result.due > 0 || result.errors.length > 0) {
      console.log("Broadcast scheduler tick", result);
    }
  } catch (error) {
    console.error("Broadcast scheduler failed", error);
    await heartbeat.markError(error);
  } finally {
    isRunning = false;
  }
}

async function start() {
  await heartbeat.start();
  await tick();
  timer = setInterval(() => void tick(), intervalMs);
  console.log(`Broadcast scheduler worker started every ${intervalMs}ms`);
}

async function shutdown() {
  console.log("Broadcast scheduler worker shutting down");
  if (timer) clearInterval(timer);
  await heartbeat.stop();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

void start();
