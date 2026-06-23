import { getRequestBodyGuardSummary } from "@/server/utils/request-body-guard";

export function getRequestBodyGuardHealth() {
  const summary = getRequestBodyGuardSummary();

  return {
    ...summary,
    isHealthy: summary.enabled,
  };
}
