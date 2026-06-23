import { getSafeLoggerSummary } from "@/server/utils/safe-logger";

export function getSafeLoggerHealth() {
  const summary = getSafeLoggerSummary();

  return {
    ...summary,
    isHealthy: summary.redactionEnabled,
  };
}
