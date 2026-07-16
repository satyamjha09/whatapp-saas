import { aggregatePartnerUsageForDate } from "@/server/services/partner-usage.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const loopEnabled = process.env.PARTNER_USAGE_WORKER_LOOP === "true";
const intervalMs = Number(process.env.PARTNER_USAGE_WORKER_INTERVAL_MS ?? 60 * 60 * 1000);

async function runOnce() {
  const dates = [new Date(), new Date(Date.now() - DAY_MS)];

  for (const date of dates) {
    const result = await aggregatePartnerUsageForDate({ date });
    console.log(
      `Partner usage aggregated for ${result.date.toISOString()}: ${result.createdOrUpdated} rows, ${result.openAlerts} alerts`,
    );
  }
}

async function main() {
  await runOnce();

  if (!loopEnabled) return;

  setInterval(() => {
    runOnce().catch((error) => {
      console.error("Partner usage aggregation failed", error);
    });
  }, Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 60 * 60 * 1000);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
