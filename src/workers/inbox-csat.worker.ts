import "dotenv/config";
import { dispatchPendingInboxCsatSurveys } from "@/server/services/inbox-csat.service";
import { createWorkerHeartbeat } from "@/server/services/worker-heartbeat.service";

const CHECK_INTERVAL_MS = 60 * 1000;

let isRunning = false;
const heartbeat = createWorkerHeartbeat({
  workerName: "inbox-csat-worker",
});

async function processPendingCsatSurveys() {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    const result = await dispatchPendingInboxCsatSurveys({ limit: 100 });

    if (result.dispatched > 0) {
      console.log(
        `[inbox-csat-worker] Dispatched ${result.dispatched} of ${result.checked} pending CSAT survey(s).`,
      );
    }
  } catch (error) {
    await heartbeat.markError(error);
    console.error("[inbox-csat-worker] Failed to process CSAT surveys:", error);
  } finally {
    isRunning = false;
  }
}

console.log("[inbox-csat-worker] Started.");

void heartbeat.start();
void processPendingCsatSurveys();

const interval = setInterval(() => {
  void processPendingCsatSurveys();
}, CHECK_INTERVAL_MS);

function shutdown() {
  console.log("[inbox-csat-worker] Shutting down.");
  clearInterval(interval);
  heartbeat
    .stop()
    .catch(console.error)
    .finally(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
