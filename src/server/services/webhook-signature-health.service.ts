import { getWebhookSignatureHealth } from "@/server/services/webhook-signature.service";

export function getWebhookSignatureSecurityHealth() {
  const health = getWebhookSignatureHealth();

  return {
    ...health,
    isHealthy:
      health.enabled && health.meta.configured && health.razorpay.configured,
  };
}
