import { RATE_LIMIT_RULES } from "@/server/config/rate-limits";

export function getRateLimitHealth() {
  const rules = Object.values(RATE_LIMIT_RULES);

  return {
    enabled: true,
    ruleCount: rules.length,
    rules,
  };
}
