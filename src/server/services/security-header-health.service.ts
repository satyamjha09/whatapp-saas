import { getSecurityHeaderSummary } from "@/lib/security-headers";

export function getSecurityHeaderHealth() {
  const summary = getSecurityHeaderSummary();
  return {
    ...summary,
    isHealthy: summary.enabled && summary.headerCount > 0,
  };
}
