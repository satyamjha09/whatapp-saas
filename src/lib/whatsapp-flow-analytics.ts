export const WHATSAPP_FLOW_ANALYTICS_METRICS = {
  automationResumed: {
    description:
      "The exact waiting automation continuation was persistently queued after a Flow response.",
    label: "Automation resumed",
  },
  businessConverted: {
    description:
      "An explicit configured business goal node was reached for the linked automation execution.",
    label: "Business converted",
  },
  completed: {
    description:
      "A valid WhatsApp Flow response was correlated to the exact Flow interaction.",
    label: "Completed",
  },
  delivered: {
    description:
      "WhatsApp delivery status webhook recorded delivery, or read status proves delivery.",
    label: "Delivered",
  },
  failed: {
    description: "The Flow message or interaction reached an authoritative failed state.",
    label: "Failed",
  },
  processed: {
    description:
      "The captured Flow response was successfully processed by response mapping.",
    label: "Processed",
  },
  read: {
    description: "WhatsApp read status webhook recorded the Flow message as read.",
    label: "Read",
  },
  sent: {
    description: "Meta accepted the outbound Flow message and the interaction has sentAt.",
    label: "Sent",
  },
} as const;

export type WhatsAppFlowAnalyticsMetricKey =
  keyof typeof WHATSAPP_FLOW_ANALYTICS_METRICS;

export function safePercent(numerator: number, denominator: number) {
  if (denominator <= 0) return null;

  return Number(((numerator / denominator) * 100).toFixed(1));
}
