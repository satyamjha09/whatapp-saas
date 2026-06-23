import { getTenantGuardSummary } from "@/server/auth/tenant-guard";

export function getTenantGuardHealth() {
  const summary = getTenantGuardSummary();

  return {
    ...summary,
    isHealthy: summary.enabled && summary.protectedEntities.length > 0,
  };
}
