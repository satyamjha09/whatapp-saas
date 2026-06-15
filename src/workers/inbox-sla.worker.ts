import "dotenv/config";
import { processInboxSlaBreaches } from "@/server/services/inbox-sla-escalation.service";

const CHECK_INTERVAL_MS = 60_000;

let isRunning = false;

async function runSlaBreachCheck() {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    const result = await processInboxSlaBreaches({
      limit: 100,
    });

    if (result.breached > 0) {
      console.log(
        `[inbox-sla-worker] Marked ${result.breached} SLA breach(es).`,
      );
    }
  } catch (error) {
    console.error("[inbox-sla-worker] Failed to process SLA breaches:", error);
  } finally {
    isRunning = false;
  }
}

console.log("[inbox-sla-worker] Started.");

void runSlaBreachCheck();

const interval = setInterval(() => {
  void runSlaBreachCheck();
}, CHECK_INTERVAL_MS);

function shutdown() {
  console.log("[inbox-sla-worker] Shutting down.");
  clearInterval(interval);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
