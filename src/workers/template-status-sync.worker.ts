import "dotenv/config";

import { syncPendingTemplateStatusesFromMeta } from "@/server/services/meta-template.service";
import { createWorkerHeartbeat } from "@/server/services/worker-heartbeat.service";

const intervalMs = Number(
  process.env.TEMPLATE_STATUS_SYNC_INTERVAL_MS ?? 5 * 60 * 1000,
);

let isRunning = false;
const heartbeat = createWorkerHeartbeat({
  workerName: "template-status-sync-worker",
});

async function runOnce() {
  if (isRunning) return;

  isRunning = true;

  try {
    const results = await syncPendingTemplateStatusesFromMeta();
    console.log("Template status sync completed", {
      companies: results.length,
      failed: results.filter((result) => !result.ok).length,
    });
  } catch (error) {
    console.error(
      "Template status sync failed",
      error instanceof Error ? error.message : error,
    );
  } finally {
    isRunning = false;
  }
}

heartbeat.start().catch((error) => {
  console.error("Template status sync heartbeat failed", error);
});
void runOnce();
setInterval(() => {
  void runOnce();
}, intervalMs);
