export const WHATSAPP_CATALOG_ANALYTICS_METRICS = {
  automationResumed: {
    description:
      "Catalog interactions that resumed a linked waiting automation session.",
    label: "Automation resumed",
  },
  delivered: {
    description:
      "Catalog template messages that reached delivered or read status.",
    label: "Delivered",
  },
  productEnquiryRate: {
    description:
      "Unique catalog messages with a product reply or order divided by sent catalog messages.",
    label: "Product enquiry rate",
  },
  productInteractions: {
    description:
      "Product replies and order messages captured from WhatsApp webhooks.",
    label: "Product interactions",
  },
  read: {
    description: "Catalog template messages that reached read status.",
    label: "Read",
  },
  sent: {
    description: "Catalog template messages accepted by Meta in the selected period.",
    label: "Sent",
  },
  uniqueInteractedMessages: {
    description:
      "Unique outbound catalog messages that received at least one product interaction.",
    label: "Unique interacted",
  },
} as const;

export type WhatsAppCatalogAnalyticsMetricKey =
  keyof typeof WHATSAPP_CATALOG_ANALYTICS_METRICS;

export function safePercent(numerator: number, denominator: number) {
  if (denominator <= 0) return null;

  return Number(((numerator / denominator) * 100).toFixed(1));
}
