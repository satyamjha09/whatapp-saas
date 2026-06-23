import { getPlatformAdminSummary } from "@/server/auth/platform-admin";

export function getPlatformAdminHealth() {
  const summary = getPlatformAdminSummary();

  return {
    ...summary,
    isHealthy: summary.enabled && summary.configuredAdminCount > 0,
  };
}
