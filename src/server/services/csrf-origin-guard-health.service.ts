import { getCsrfOriginGuardSummary } from "@/lib/csrf-origin-guard";

export function getCsrfOriginGuardHealth() {
  const summary = getCsrfOriginGuardSummary();

  return {
    ...summary,
    isHealthy: summary.enabled && summary.trustedOrigins.length > 0,
  };
}
